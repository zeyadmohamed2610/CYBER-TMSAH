-- ===========================================================
-- Structured Logging - Add metadata JSONB column to system_logs
-- Run order: 6 of 6  (run AFTER all previous migrations)
-- ===========================================================

-- Add metadata JSONB column to system_logs for structured logging
ALTER TABLE public.system_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_system_logs_metadata_gin
  ON public.system_logs USING GIN (metadata);

-- Add comment explaining the metadata structure
COMMENT ON COLUMN public.system_logs.metadata IS 'Structured metadata for log analysis. Example: {"function": "submit_attendance", "session_id": "uuid", "student_id": "uuid", "ip": "1.2.3.4", "user_agent": "Mozilla/5.0...", "gps_verified": true, "distance_meters": 12.5}';

-- Update log_login_session to include metadata
CREATE OR REPLACE FUNCTION public.log_login_session()
RETURNS public.login_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller   public.users;
  v_ip       TEXT;
  v_agent    TEXT;
  v_existing public.login_sessions;
  v_row      public.login_sessions;
  v_metadata JSONB;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'permission_denied: authenticated user required';
  END IF;

  v_ip := private.current_request_ip();
  v_agent := private.current_request_user_agent();

  SELECT * INTO v_existing
  FROM public.login_sessions
  WHERE user_id = v_caller.id
    AND ip_address IS NOT DISTINCT FROM v_ip
    AND user_agent IS NOT DISTINCT FROM v_agent
    AND created_at > now() - INTERVAL '10 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  v_metadata := jsonb_build_object(
    'function', 'log_login_session',
    'ip', v_ip,
    'user_agent', v_agent
  );

  INSERT INTO public.login_sessions (user_id, ip_address, user_agent)
  VALUES (v_caller.id, v_ip, v_agent)
  RETURNING * INTO v_row;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (v_caller.id, format('log_login_session: user %s logged in', v_caller.id), v_metadata);

  RETURN v_row;
END;
$$;

-- Update create_user to include metadata
CREATE OR REPLACE FUNCTION public.create_user(
  p_auth_id    UUID,
  p_full_name  TEXT,
  p_role       public.user_role,
  p_subject_id UUID DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
  v_new    public.users;
  v_metadata JSONB;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may create users';
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'validation_error: full_name cannot be empty';
  END IF;

  IF p_role = 'doctor' AND p_subject_id IS NULL THEN
    RAISE EXCEPTION 'validation_error: doctors require a subject_id';
  END IF;

  IF p_role = 'owner' AND p_subject_id IS NOT NULL THEN
    RAISE EXCEPTION 'validation_error: owners cannot have a subject_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_id) THEN
    RAISE EXCEPTION 'not_found: auth_id % does not exist in auth.users', p_auth_id;
  END IF;

  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subjects WHERE id = p_subject_id
  ) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE auth_id = p_auth_id) THEN
    RAISE EXCEPTION 'conflict: auth_id % already mapped to a user', p_auth_id;
  END IF;

  INSERT INTO public.users (auth_id, full_name, role, subject_id)
  VALUES (p_auth_id, trim(p_full_name), p_role, p_subject_id)
  RETURNING * INTO v_new;

  v_metadata := jsonb_build_object(
    'function', 'create_user',
    'created_user_id', v_new.id,
    'auth_id', p_auth_id,
    'role', p_role,
    'subject_id', p_subject_id
  );

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('create_user: created %s (auth_id=%s, role=%s)', v_new.id, p_auth_id, p_role),
    v_metadata
  );

  RETURN v_new;
END;
$$;

-- Update generate_rotating_hash to include metadata
CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_subject_id       UUID,
  p_duration_minutes INTEGER DEFAULT 10,
  p_latitude         DOUBLE PRECISION DEFAULT NULL,
  p_longitude        DOUBLE PRECISION DEFAULT NULL,
  p_radius_meters    INTEGER DEFAULT 50,
  p_lecture_id       UUID DEFAULT NULL,
  p_section          TEXT DEFAULT NULL
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller     public.users;
  v_hash       TEXT;
  v_short_code TEXT;
  v_session    public.sessions;
  v_metadata   JSONB;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may generate sessions';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 180 THEN
    RAISE EXCEPTION 'validation_error: duration must be between 1 and 180 minutes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF v_caller.role IN ('doctor', 'ta') AND v_caller.subject_id IS DISTINCT FROM p_subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors and TAs may only create sessions for their assigned subject';
  END IF;

  v_hash := replace(gen_random_uuid()::text, '-', '') ||
            replace(gen_random_uuid()::text, '-', '');

  v_short_code := lpad(floor(random() * 1000000)::text, 6, '0');

  INSERT INTO public.sessions (
    subject_id, rotating_hash, short_code, expires_at, latitude, longitude, radius_meters, lecture_id, section
  )
  VALUES (
    p_subject_id, v_hash, v_short_code, now() + make_interval(mins => p_duration_minutes),
    p_latitude, p_longitude, p_radius_meters, p_lecture_id, p_section
  )
  RETURNING * INTO v_session;

  v_metadata := jsonb_build_object(
    'function', 'generate_rotating_hash',
    'session_id', v_session.id,
    'subject_id', p_subject_id,
    'duration_minutes', p_duration_minutes,
    'gps_enabled', p_latitude IS NOT NULL,
    'short_code', v_short_code,
    'lecture_id', p_lecture_id,
    'section', p_section
  );

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format(
      'generate_session: created session %s for subject %s (%s minutes, GPS enabled: %s, code: %s, section: %s)',
      v_session.id, p_subject_id, p_duration_minutes, p_latitude IS NOT NULL, v_short_code,
      COALESCE(p_section, 'none')
    ),
    v_metadata
  );

  RETURN v_session;
END;
$$;

-- Update submit_attendance to include metadata
CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_hash                   TEXT,
  p_device_fingerprint     TEXT DEFAULT NULL,
  p_student_latitude       DOUBLE PRECISION DEFAULT NULL,
  p_student_longitude      DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller   public.users;
  v_session  public.sessions;
  v_record   public.attendance;
  v_device   public.student_devices;
  v_fp       TEXT;
  v_ip       TEXT;
  v_recent   INTEGER;
  v_distance DOUBLE PRECISION;
  v_window   BIGINT;
  v_metadata JSONB;
  v_gps_verified BOOLEAN := FALSE;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  SELECT COUNT(*) INTO v_recent
  FROM public.system_logs
  WHERE actor_id = v_caller.id
    AND action LIKE 'submit_attendance:%'
    AND created_at > now() - INTERVAL '1 minute';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'rate_limited: too many submission attempts, please wait';
  END IF;

  IF p_hash IS NULL OR length(trim(p_hash)) = 0 THEN
    RAISE EXCEPTION 'validation_error: attendance hash cannot be empty';
  END IF;

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

  IF v_caller.subject_id IS DISTINCT FROM v_session.subject_id THEN
    RAISE EXCEPTION 'permission_denied: session does not belong to your subject';
  END IF;

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

  SELECT * INTO v_device
  FROM public.student_devices
  WHERE student_id = v_caller.id;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.student_devices
      WHERE device_fingerprint = v_fp
        AND student_id <> v_caller.id
    ) THEN
      RAISE EXCEPTION 'device_conflict: this device is already linked to another student';
    END IF;

    INSERT INTO public.student_devices (
      student_id,
      device_fingerprint,
      ip_address,
      bound_at,
      last_seen_at
    )
    VALUES (
      v_caller.id,
      v_fp,
      v_ip,
      now(),
      now()
    );
  ELSIF v_device.device_fingerprint IS DISTINCT FROM v_fp THEN
    RAISE EXCEPTION 'device_mismatch: this account is already linked to another device';
  ELSE
    UPDATE public.student_devices
    SET ip_address = v_ip,
        last_seen_at = now()
    WHERE student_id = v_caller.id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'conflict: attendance already submitted for this session';
  END IF;

  INSERT INTO public.attendance (student_id, session_id, student_latitude, student_longitude)
  VALUES (v_caller.id, v_session.id, p_student_latitude, p_student_longitude)
  RETURNING * INTO v_record;

  v_metadata := jsonb_build_object(
    'function', 'submit_attendance',
    'session_id', v_session.id,
    'student_id', v_caller.id,
    'attendance_id', v_record.id,
    'ip', v_ip,
    'device_fingerprint', v_fp,
    'gps_verified', v_gps_verified,
    'distance_meters', CASE WHEN v_gps_verified THEN v_distance ELSE NULL END,
    'student_latitude', p_student_latitude,
    'student_longitude', p_student_longitude
  );

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format(
      'submit_attendance: student %s -> session %s (device bound, GPS: %s)',
      v_caller.id,
      v_session.id,
      CASE WHEN p_student_latitude IS NOT NULL THEN 'yes' ELSE 'no' END
    ),
    v_metadata
  );

  RETURN v_record;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'device_conflict: this device is already linked to another student';
END;
$$;