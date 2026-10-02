-- Verified one-use attendance receipts, restricted to the server.
ALTER TABLE public.webauthn_challenges ADD COLUMN IF NOT EXISTS attendance_hash text;
CREATE TABLE public.attendance_biometric_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_hash text NOT NULL,
  device_fingerprint text NOT NULL,
  credential_id text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes')
);
ALTER TABLE public.attendance_biometric_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_biometric_proofs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.attendance_biometric_proofs TO service_role;
CREATE INDEX attendance_biometric_proofs_expiry ON public.attendance_biometric_proofs(expires_at);
-- No client write policy: only the verification endpoint can issue a receipt.

CREATE OR REPLACE FUNCTION public.add_manual_attendance(p_student_id uuid, p_session_id uuid)
  RETURNS attendance
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_student     public.users;
  v_session     public.sessions;
  v_record      public.attendance;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may add manual attendance';
  END IF;

  SELECT * INTO v_student FROM public.users WHERE id = p_student_id AND role = 'student';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: student % does not exist', p_student_id;
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = p_student_id AND session_id = p_session_id
  ) THEN
    RAISE EXCEPTION 'conflict: attendance already recorded for this student/session';
  END IF;

  INSERT INTO public.attendance (student_id, session_id, metadata)
  VALUES (p_student_id, p_session_id, jsonb_build_object('manual', true, 'recorded_by', v_caller.id, 'recorded_at', now()))
  RETURNING * INTO v_record;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('add_manual_attendance: student %s -> session %s', p_student_id, p_session_id));

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_user_subjects(p_user_id uuid, p_subject_ids uuid[])
  RETURNS SETOF user_subjects
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private, auth
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_target      public.users;
  v_sid         UUID;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may assign subjects to users';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  IF v_target.role NOT IN ('doctor', 'ta', 'coordinator') THEN
    RAISE EXCEPTION 'validation_error: only doctors, TAs, and coordinators can have subject assignments';
  END IF;

  DELETE FROM public.user_subjects WHERE user_id = p_user_id;

  IF p_subject_ids IS NOT NULL THEN
    FOREACH v_sid IN ARRAY p_subject_ids LOOP
      IF v_sid IS NOT NULL THEN
        INSERT INTO public.user_subjects (user_id, subject_id)
        VALUES (p_user_id, v_sid)
        ON CONFLICT (user_id, subject_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.users
  SET subject_id = (
    SELECT subject_id FROM public.user_subjects
    WHERE user_id = p_user_id
    ORDER BY assigned_at ASC
    LIMIT 1
  )
  WHERE id = p_user_id;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('assign_user_subjects: set %s subjects for user %s', array_length(p_subject_ids, 1), p_user_id));

  RETURN QUERY
    SELECT * FROM public.user_subjects WHERE user_id = p_user_id ORDER BY assigned_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_lecture(p_subject_id uuid, p_title text DEFAULT 'محاضرة')
  RETURNS lectures
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_lecture     public.lectures;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may create lectures';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF v_caller_role IN ('doctor', 'ta') AND v_caller.subject_id IS DISTINCT FROM p_subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors and TAs may only create lectures for their assigned subject';
  END IF;

  INSERT INTO public.lectures (subject_id, title, created_by)
  VALUES (p_subject_id, COALESCE(NULLIF(trim(p_title), ''), 'محاضرة'), v_caller.id)
  RETURNING * INTO v_lecture;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('create_lecture: created lecture %s for subject %s', v_lecture.id, p_subject_id));

  RETURN v_lecture;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_lecture(p_lecture_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may delete lectures';
  END IF;

  DELETE FROM public.attendance
  WHERE session_id IN (SELECT id FROM public.sessions WHERE lecture_id = p_lecture_id);

  DELETE FROM public.sessions WHERE lecture_id = p_lecture_id;
  DELETE FROM public.lectures WHERE id = p_lecture_id;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('delete_lecture: permanently deleted lecture %s', p_lecture_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_student_device(p_student_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private, auth
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_target      public.users;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR (v_caller_role <> 'owner' AND v_caller_role <> 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may clear student devices';
  END IF;

  SELECT * INTO v_target
  FROM public.users
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: student % does not exist', p_student_id;
  END IF;

  IF v_target.role <> 'student' THEN
    RAISE EXCEPTION 'validation_error: target user must be a student';
  END IF;

  -- Clear device_locks (student_devices table has been dropped)
  IF v_target.auth_id IS NOT NULL THEN
    DELETE FROM public.device_locks
    WHERE student_auth_id = v_target.auth_id;
  END IF;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('delete_student_device: cleared device locks for student %s (%s)', v_target.full_name, p_student_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.end_lecture(p_lecture_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may end lectures';
  END IF;

  UPDATE public.sessions
  SET expires_at = now()
  WHERE lecture_id = p_lecture_id AND expires_at > now();

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('end_lecture: ended all sessions for lecture %s', p_lecture_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_subject_id       uuid,
  p_duration_minutes integer           DEFAULT 10,
  p_latitude         double precision  DEFAULT NULL,
  p_longitude        double precision  DEFAULT NULL,
  p_radius_meters    integer           DEFAULT 50,
  p_lecture_id       uuid              DEFAULT NULL,
  p_section          text              DEFAULT NULL
)
  RETURNS sessions
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private, extensions
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_hash        TEXT;
  v_short_code  TEXT;
  v_session     public.sessions;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may generate sessions';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 180 THEN
    RAISE EXCEPTION 'validation_error: duration must be between 1 and 180 minutes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF v_caller_role IN ('doctor', 'ta') AND v_caller.subject_id IS DISTINCT FROM p_subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors and TAs may only generate sessions for their assigned subject';
  END IF;

  v_hash := encode(extensions.gen_random_bytes(32), 'hex');
  v_short_code := lpad((floor(random() * 900000) + 100000)::text, 6, '0');

  INSERT INTO public.sessions (
    subject_id,
    lecture_id,
    section,
    rotating_hash,
    short_code,
    expires_at,
    latitude,
    longitude,
    radius_meters,
    created_by
  )
  VALUES (
    p_subject_id,
    p_lecture_id,
    p_section,
    v_hash,
    v_short_code,
    now() + (p_duration_minutes || ' minutes')::interval,
    p_latitude,
    p_longitude,
    COALESCE(p_radius_meters, 50),
    v_caller.id
  )
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('generate_rotating_hash: created session %s for subject %s', v_session.id, p_subject_id));

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_subjects(p_user_id uuid)
  RETURNS TABLE(subject_id uuid, subject_name text, department text, assigned_at timestamptz)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private, auth
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied: authentication required';
  END IF;

  IF v_caller_role NOT IN ('owner', 'coordinator') AND v_caller.id <> p_user_id THEN
    RAISE EXCEPTION 'permission_denied: you may only view your own subject assignments';
  END IF;

  RETURN QUERY
    SELECT
      s.id          AS subject_id,
      s.name        AS subject_name,
      s.department  AS department,
      us.assigned_at
    FROM public.user_subjects us
    JOIN public.subjects s ON s.id = us.subject_id
    WHERE us.user_id = p_user_id
    ORDER BY s.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_join_request(p_request_id uuid, p_note text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private, auth
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR (v_caller_role <> 'owner' AND v_caller_role <> 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may reject join requests';
  END IF;

  UPDATE public.join_requests
  SET status         = 'rejected',
      rejection_note = p_note,
      reviewed_at    = now(),
      reviewed_by    = COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
      password       = NULL
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: join request not found or not pending';
  END IF;

  RETURN jsonb_build_object('success', true, 'id', p_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.stop_session(p_session_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_session     public.sessions;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may stop sessions';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  UPDATE public.sessions SET expires_at = now() WHERE id = p_session_id;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('stop_session: stopped session %s', p_session_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user(
  p_user_id        uuid,
  p_full_name      text,
  p_national_id    text    DEFAULT NULL,
  p_subject_id     uuid    DEFAULT NULL,
  p_department     text    DEFAULT NULL,
  p_academic_year  text    DEFAULT NULL,
  p_section_number integer DEFAULT NULL
)
  RETURNS users
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_target      public.users;
  v_updated     public.users;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may update user profiles';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) < 3 THEN
    RAISE EXCEPTION 'validation_error: full_name must be at least 3 characters';
  END IF;

  UPDATE public.users
  SET
    full_name      = trim(p_full_name),
    national_id    = COALESCE(p_national_id, national_id),
    subject_id     = p_subject_id,
    department     = COALESCE(p_department, department),
    academic_year  = COALESCE(p_academic_year, academic_year),
    section_number = COALESCE(p_section_number, section_number)
  WHERE id = p_user_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_hash                      TEXT,
  p_device_fingerprint        TEXT DEFAULT NULL,
  p_student_latitude          DOUBLE PRECISION DEFAULT NULL,
  p_student_longitude         DOUBLE PRECISION DEFAULT NULL,
  p_biometric_credential_id   TEXT DEFAULT NULL
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, extensions
AS $$
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
$$;
REVOKE EXECUTE ON FUNCTION public.submit_attendance(text,text,double precision,double precision,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_attendance(text,text,double precision,double precision,text) TO authenticated;
-- Older overloads must never bypass verification.
DO $$ BEGIN
  IF to_regprocedure('public.submit_attendance(text,text,double precision,double precision)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.submit_attendance(text,text,double precision,double precision) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
