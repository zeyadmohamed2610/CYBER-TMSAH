BEGIN;

CREATE OR REPLACE FUNCTION private.guard_session_gps() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL
     OR NOT (NEW.latitude BETWEEN -90 AND 90) OR NOT (NEW.longitude BETWEEN -180 AND 180)
     OR NEW.radius_meters IS NULL OR NOT (NEW.radius_meters BETWEEN 10 AND 500) THEN
    RAISE EXCEPTION 'location_denied: session requires GPS coordinates and a radius between 10 and 500 meters';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_session_gps() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_session_gps BEFORE INSERT OR UPDATE OF latitude,longitude,radius_meters
ON public.sessions FOR EACH ROW EXECUTE FUNCTION private.guard_session_gps();

CREATE OR REPLACE FUNCTION private.attendance_set_session_duration(p_session_id uuid, p_duration_minutes integer)
 RETURNS sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject((SELECT subject_id FROM public.sessions WHERE id=p_session_id)),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may update session duration';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 180 THEN
    RAISE EXCEPTION 'validation_error: duration must be between 1 and 180 minutes';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  -- Assignment authorization is enforced by private.can_manage_subject above.

  UPDATE public.sessions
  SET expires_at = now() + make_interval(mins => p_duration_minutes)
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format('set_session_duration: session %s -> %s minutes', p_session_id, p_duration_minutes)
  );

  RETURN v_session;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.account_submit_attendance(p_hash text, p_device_fingerprint text DEFAULT NULL::text, p_student_latitude double precision DEFAULT NULL::double precision, p_student_longitude double precision DEFAULT NULL::double precision, p_biometric_credential_id text DEFAULT NULL::text)
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'extensions'
AS $function$
DECLARE
  v_caller            public.users;
  v_session           public.sessions;
  v_record            public.attendance;
  v_fp                TEXT;
  v_ip                TEXT;
  v_recent            INTEGER;
  v_distance          DOUBLE PRECISION;
  v_window            BIGINT;
  v_gps_verified      BOOLEAN := FALSE;
  v_existing_auth     UUID;
  v_existing_fp       TEXT;
  v_biometric_ok      BOOLEAN;
  v_verified_credential TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permission_denied: login required'; END IF;
  -- 1. Identify and authenticate caller
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  -- 2. Anti-spam rate limiting (maximum 10 attempts per minute)
  SELECT COUNT(*) INTO v_recent
  FROM public.system_logs
  WHERE actor_id = v_caller.id
    AND action LIKE 'submit_attendance:%'
    AND created_at > now() - INTERVAL '1 minute';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'rate_limited: too many submission attempts, please wait';
  END IF;

  -- 3. Validate attendance hash
  IF p_hash IS NULL OR length(trim(p_hash)) = 0 THEN
    RAISE EXCEPTION 'validation_error: attendance hash cannot be empty';
  END IF;

  -- 4. Derive device fingerprint (fallback to SHA256 of UA + IP if not provided)
  v_fp := trim(COALESCE(p_device_fingerprint, ''));
  IF v_fp = '' THEN
    v_fp := encode(
      digest(
        COALESCE(private.current_request_user_agent(), '') || '|' ||
        COALESCE(private.current_request_ip(), ''),
        'sha256'
      ),
      'hex'
    );
  END IF;

  v_ip := private.current_request_ip();
  v_window := EXTRACT(EPOCH FROM now())::bigint / 10;

  -- 5. Validate session and rolling TOTP token / short_code
  SELECT * INTO v_session
  FROM public.sessions
  WHERE expires_at > now()
    AND (
      trim(p_hash) = public.generate_totp(rotating_hash, v_window)
      OR
      trim(p_hash) = public.generate_totp(rotating_hash, v_window - 1)
      OR
      trim(p_hash) = short_code
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired: attendance hash is invalid or has expired';
  END IF;

  -- Fail closed for missing, non-finite or impossible locations.
  IF v_session.latitude IS NULL OR v_session.longitude IS NULL
     OR NOT (v_session.latitude BETWEEN -90 AND 90)
     OR NOT (v_session.longitude BETWEEN -180 AND 180)
     OR v_session.radius_meters IS NULL OR NOT (v_session.radius_meters BETWEEN 10 AND 500) THEN
    RAISE EXCEPTION 'location_denied: session requires a valid GPS boundary';
  END IF;
  IF p_student_latitude IS NULL OR p_student_longitude IS NULL
     OR NOT (p_student_latitude BETWEEN -90 AND 90)
     OR NOT (p_student_longitude BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'location_denied: enable location and provide valid GPS coordinates';
  END IF;

  -- 6. GPS Geofence validation
  IF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
     AND p_student_latitude IS NOT NULL AND p_student_longitude IS NOT NULL THEN
    v_distance := public.gps_distance_meters(
      v_session.latitude, v_session.longitude,
      p_student_latitude, p_student_longitude
    );
    IF v_distance > COALESCE(v_session.radius_meters, 50) THEN
      RAISE EXCEPTION 'location_denied: you are %.0f meters away from the session location (max: %m)',
        v_distance, COALESCE(v_session.radius_meters, 50);
    END IF;
    v_gps_verified := TRUE;
  ELSIF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
        AND (p_student_latitude IS NULL OR p_student_longitude IS NULL) THEN
    RAISE EXCEPTION 'location_denied: this session requires GPS verification, please enable location.';
  END IF;

  -- 7. Device Binding with Transaction-Scoped Advisory Locking
  IF v_caller.auth_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_caller.auth_id::text));

    SELECT student_auth_id INTO v_existing_auth
    FROM public.device_locks
    WHERE device_fingerprint = v_fp
    LIMIT 1;

    IF v_existing_auth IS NOT NULL AND v_existing_auth <> v_caller.auth_id THEN
      RAISE EXCEPTION 'device_conflict: this device is registered to another student account';
    END IF;

    SELECT device_fingerprint INTO v_existing_fp
    FROM public.device_locks
    WHERE student_auth_id = v_caller.auth_id;

    IF v_existing_fp IS NOT NULL THEN
      IF v_existing_fp IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION 'device_mismatch: this account is already bound to another device. Contact administrator to reset device binding.';
      END IF;
      UPDATE public.device_locks
      SET locked_at = now()
      WHERE student_auth_id = v_caller.auth_id;
    ELSE
      INSERT INTO public.device_locks (student_auth_id, device_fingerprint, device_label, locked_at)
      VALUES (v_caller.auth_id, v_fp, 'جهاز معتمد', now());
    END IF;
  END IF;

  -- Synchronize legacy student_devices table
  BEGIN
    INSERT INTO public.student_devices (student_id, device_fingerprint, ip_address, bound_at, last_seen_at)
    VALUES (v_caller.id, v_fp, v_ip, now(), now())
    ON CONFLICT (student_id) DO UPDATE
      SET last_seen_at = now(),
          ip_address = EXCLUDED.ip_address
      WHERE public.student_devices.device_fingerprint = v_fp;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 8. Prevent duplicate attendance in the same session
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'already_recorded: your attendance has already been recorded for this session';
  END IF;

  -- 9. Determine biometric status
  -- The argument carries an opaque receipt, never a client-asserted credential ID.
  DELETE FROM public.attendance_biometric_proofs
  WHERE id::text = p_biometric_credential_id
    AND auth_id = auth.uid()
    AND attendance_hash = trim(p_hash)
    AND device_fingerprint = v_fp
    AND expires_at > now()
  RETURNING credential_id INTO v_verified_credential;
  IF v_verified_credential IS NULL THEN
    RAISE EXCEPTION 'biometric_required: verify attendance with a fresh server-validated assertion';
  END IF;
  v_biometric_ok := TRUE;

  -- 10. Insert attendance record with biometric_credential_id
  INSERT INTO public.attendance (
    student_id,
    session_id,
    device_fingerprint,
    student_latitude,
    student_longitude,
    biometric_credential_id,
    metadata
  )
  VALUES (
    v_caller.id,
    v_session.id,
    v_fp,
    p_student_latitude,
    p_student_longitude,
    v_verified_credential,
    jsonb_build_object(
      'ip', v_ip,
      'gps_verified', v_gps_verified,
      'distance_meters', CASE WHEN v_gps_verified THEN v_distance ELSE NULL END,
      'user_agent', private.current_request_user_agent(),
      'biometric_verified', v_biometric_ok,
      'biometric_credential_id', v_verified_credential,
      'submitted_at', now()
    )
  )
  RETURNING * INTO v_record;

  -- 11. System log audit trail (includes biometric status)
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format(
      'submit_attendance: success student %s in session %s (device bound, GPS: %s, biometric: %s)',
      v_caller.id,
      v_session.id,
      CASE WHEN v_gps_verified THEN 'yes' ELSE 'no' END,
      CASE WHEN v_biometric_ok THEN 'yes' ELSE 'no' END
    )
  );

  RETURN v_record;
END;
$function$
;
REVOKE ALL ON FUNCTION private.account_submit_attendance(text,text,double precision,double precision,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_submit_attendance(text,text,double precision,double precision,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_attendance(p_hash text, p_device_fingerprint text DEFAULT NULL::text, p_student_latitude double precision DEFAULT NULL::double precision, p_student_longitude double precision DEFAULT NULL::double precision, p_biometric_credential_id text DEFAULT NULL::text) RETURNS attendance LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT private.account_submit_attendance(p_hash,p_device_fingerprint,p_student_latitude,p_student_longitude,p_biometric_credential_id); $body$;

COMMIT;
