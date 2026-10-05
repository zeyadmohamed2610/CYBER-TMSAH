BEGIN;

-- Keep schedule history and current device locks; removed notification/device tables
-- must not remain runtime dependencies.
CREATE OR REPLACE FUNCTION private.academic_replace_schedule(p_department text, p_year text, p_entries jsonb, p_expected_revision text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE n integer; sc jsonb; d text; y text; previous_batch text; BEGIN
 sc:=private.academic_scope(p_department,p_year,true);d:=sc->>'department';y:=sc->>'academic_year';
 PERFORM pg_advisory_xact_lock(hashtextextended(d||':'||y,0));
 PERFORM private.schedule_checkpoint(d,y,'قبل الاستيراد');
 previous_batch:=current_setting('app.schedule_bulk',true);
 PERFORM set_config('app.schedule_bulk','on',true);
 n:=private.academic_replace_schedule_core(d,y,p_entries,p_expected_revision);
 PERFORM set_config('app.schedule_bulk',COALESCE(previous_batch,''),true);
 PERFORM private.schedule_checkpoint(d,y,'استيراد جدول الجامعة');
 RETURN n; END $function$
;

REVOKE ALL ON FUNCTION private.academic_replace_schedule(text,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.academic_replace_schedule(text,text,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.academic_import_entries(p_department text, p_year text, p_entries jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE sc jsonb; item jsonb; existing uuid; n integer:=0; d text; y text; previous_batch text; BEGIN
 sc:=private.academic_scope(p_department,p_year,true);d:=sc->>'department';y:=sc->>'academic_year';
 IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 1200 THEN RAISE EXCEPTION 'validation_error: import size'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(d||':'||y,0)); PERFORM private.schedule_checkpoint(d,y,'قبل الاستيراد');
 previous_batch:=current_setting('app.schedule_bulk',true);PERFORM set_config('app.schedule_bulk','on',true);
 FOR item IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
 SELECT id INTO existing FROM public.academic_schedule_entries WHERE department=d AND academic_year=y AND section=(item->>'section')::integer AND day_index=(item->>'day_index')::integer AND period=(item->>'period')::integer AND week_pattern=COALESCE((item->>'week_pattern')::integer,0);
 item:=item-'id';IF existing IS NOT NULL THEN item:=item||jsonb_build_object('id',existing);END IF;
 PERFORM private.academic_save_entry(d,y,item);n:=n+1; END LOOP;
 PERFORM set_config('app.schedule_bulk',COALESCE(previous_batch,''),true);PERFORM private.schedule_checkpoint(d,y,'استيراد مواعيد');
 INSERT INTO public.system_logs(actor_id,action,metadata) VALUES((private.get_caller_user()).id,'import_academic_schedule',jsonb_build_object('department',d,'year',y,'count',n));RETURN n; END $function$
;

REVOKE ALL ON FUNCTION private.academic_import_entries(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.academic_import_entries(text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION private.account_lock_student_device(p_fingerprint text, p_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_existing TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT device_fingerprint INTO v_existing
  FROM public.device_locks
  WHERE student_auth_id = v_uid;

  IF v_existing IS NOT NULL THEN
    IF v_existing = p_fingerprint THEN
      RETURN jsonb_build_object('success', true, 'message', 'Device already locked');
    ELSE
      RAISE EXCEPTION 'الحساب مقترن بالفعل بجهاز آخر. يرجى مراجعة إدارة الكلية.';
    END IF;
  END IF;

  INSERT INTO public.device_locks (student_auth_id, device_fingerprint, device_label, locked_at)
  VALUES (v_uid, p_fingerprint, COALESCE(p_label, 'جهاز معتمد'), now())
  ON CONFLICT (student_auth_id)
  DO UPDATE SET
    device_fingerprint = EXCLUDED.device_fingerprint,
    device_label = EXCLUDED.device_label,
    locked_at = now()
  WHERE public.device_locks.device_fingerprint = p_fingerprint;


  RETURN jsonb_build_object('success', true);
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

COMMIT;
