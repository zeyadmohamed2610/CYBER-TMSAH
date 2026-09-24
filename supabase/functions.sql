-- ===========================================================
-- functions.sql
-- University Attendance System
-- Run order: 2 of 4  (must run BEFORE rls.sql)
-- ===========================================================
-- All functions: SECURITY DEFINER + pinned search_path.
-- Private helpers are used by RLS policies to read caller
-- state without causing recursive RLS on public.users.
-- ===========================================================

-- ─────────────────────────────────────────────
-- PRIVATE HELPERS (RLS-safe, no recursion)
-- SECURITY DEFINER bypasses RLS on public.users.
-- NOT callable by any client role (revoked in permissions.sql).
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_totp(p_secret TEXT, p_window BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lpad((
    ('x' || substring(encode(digest(p_secret || p_window::text, 'sha256'), 'hex') from 1 for 8))::bit(32)::bigint % 1000000
  )::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION private.get_caller_user()
RETURNS public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_user_subject_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT subject_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;


-- ─────────────────────────────────────────────
-- 1. create_user
--    Only OWNER may call this.
--    Caller must first create the auth.users record via
--    the Supabase Admin API, then pass its UUID here.
-- ─────────────────────────────────────────────
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
BEGIN
  -- 1. Resolve caller
  v_caller := private.get_caller_user();

  -- 2. Enforce owner-only
  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may create users';
  END IF;

  -- 3. Validate input
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'validation_error: full_name cannot be empty';
  END IF;

  -- Students don't need a subject_id (they can attend any subject)
  -- Only doctors require a subject_id
  IF p_role = 'doctor' AND p_subject_id IS NULL THEN
    RAISE EXCEPTION 'validation_error: doctors require a subject_id';
  END IF;

  IF p_role = 'owner' AND p_subject_id IS NOT NULL THEN
    RAISE EXCEPTION 'validation_error: owners cannot have a subject_id';
  END IF;

  -- 4. Validate auth_id exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_id) THEN
    RAISE EXCEPTION 'not_found: auth_id % does not exist in auth.users', p_auth_id;
  END IF;

  -- 5. Ensure subject exists (if provided)
  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subjects WHERE id = p_subject_id
  ) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  -- 6. Ensure auth_id not already mapped
  IF EXISTS (SELECT 1 FROM public.users WHERE auth_id = p_auth_id) THEN
    RAISE EXCEPTION 'conflict: auth_id % already mapped to a user', p_auth_id;
  END IF;

  -- 7. Insert
  INSERT INTO public.users (auth_id, full_name, role, subject_id)
  VALUES (p_auth_id, trim(p_full_name), p_role, p_subject_id)
  RETURNING * INTO v_new;

   -- 8. Audit log (structured JSONB metadata)
   INSERT INTO public.system_logs (actor_id, action, metadata)
   VALUES (
     v_caller.id,
     format('create_user: created %s (auth_id=%s, role=%s)', v_new.id, p_auth_id, p_role),
     jsonb_build_object(
       'user_id', v_new.id::text,
       'auth_id', p_auth_id::text,
       'role', p_role::text
     )
   );

  RETURN v_new;
END;
$$;


-- ─────────────────────────────────────────────
-- 2. generate_rotating_hash (CONSOLIDATED)
--    Creates a session with a 256-bit random hash.
--    Signature matches the frontend RPC call exactly:
--      p_subject_id, p_duration_minutes, p_latitude, p_longitude,
--      p_radius_meters, p_lecture_id (optional), p_section (optional)
--    Callable by: OWNER, DOCTOR (own subject), TA (own subject)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_subject_id       UUID,
  p_duration_minutes INTEGER          DEFAULT 10,
  p_latitude         DOUBLE PRECISION DEFAULT NULL,
  p_longitude        DOUBLE PRECISION DEFAULT NULL,
  p_radius_meters    INTEGER          DEFAULT 50,
  p_lecture_id       UUID             DEFAULT NULL,
  p_section          TEXT             DEFAULT NULL
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

  IF v_caller.role = 'doctor' AND v_caller.subject_id IS DISTINCT FROM p_subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only create sessions for their assigned subject';
  END IF;

  v_hash := replace(gen_random_uuid()::text, '-', '') ||
            replace(gen_random_uuid()::text, '-', '');

  -- Generate random 6-digit numeric short_code
  v_short_code := lpad(floor(random() * 1000000)::text, 6, '0');

  INSERT INTO public.sessions (
    subject_id, rotating_hash, short_code, expires_at, latitude, longitude, radius_meters, lecture_id, section
  )
  VALUES (
    p_subject_id, v_hash, v_short_code, now() + make_interval(mins => p_duration_minutes),
    p_latitude, p_longitude, p_radius_meters, p_lecture_id, p_section
  )
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format(
      'generate_session: created session %s for subject %s (%s minutes, GPS enabled: %s, code: %s, section: %s)',
      v_session.id, p_subject_id, p_duration_minutes, p_latitude IS NOT NULL, v_short_code,
      COALESCE(p_section, 'none')
    ),
    jsonb_build_object(
      'session_id', v_session.id::text,
      'subject_id', p_subject_id::text,
      'duration_minutes', p_duration_minutes,
      'gps_enabled', p_latitude IS NOT NULL,
      'short_code', v_short_code,
      'lecture_id', p_lecture_id::text,
      'section', p_section
    )
  );

  RETURN v_session;
END;
$$;


-- ─────────────────────────────────────────────
-- 3. refresh_session_hash
--    Refreshes the rotating_hash and short_code for an active session.
--    Callable by: OWNER, DOCTOR (for their assigned subject)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_session_hash(
  p_session_id UUID
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller     public.users;
  v_session    public.sessions;
  v_hash       TEXT;
  v_short_code TEXT;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor') THEN
    RAISE EXCEPTION 'permission_denied: only owners and doctors may refresh sessions';
  END IF;

  SELECT * INTO v_session
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only refresh their assigned subject sessions';
  END IF;

  IF v_session.expires_at <= now() THEN
    RAISE EXCEPTION 'conflict: session is already expired';
  END IF;

  v_hash := replace(gen_random_uuid()::text, '-', '') ||
            replace(gen_random_uuid()::text, '-', '');

  -- Generate new 6-digit numeric short_code
  v_short_code := lpad(floor(random() * 1000000)::text, 6, '0');

  UPDATE public.sessions
  SET rotating_hash = v_hash,
      short_code = v_short_code
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id, format('refresh_session_hash: refreshed session %s (code: %s)', p_session_id, v_short_code));

  RETURN v_session;
END;
$$;


-- ─────────────────────────────────────────────
-- 4. stop_session
--    Immediately expires a session.
--    Callable by: OWNER, DOCTOR (for their assigned subject)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stop_session(
  p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor') THEN
    RAISE EXCEPTION 'permission_denied: only owners and doctors may stop sessions';
  END IF;

  SELECT * INTO v_session
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only stop their assigned subject sessions';
  END IF;

  UPDATE public.sessions
  SET expires_at = now()
  WHERE id = p_session_id;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id, format('stop_session: stopped session %s', p_session_id));
END;
$$;


-- ─────────────────────────────────────────────
-- 5. set_session_duration
--    Updates session expiry to a new duration from now.
--    Callable by: OWNER, DOCTOR (for their assigned subject)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_session_duration(
  p_session_id       UUID,
  p_duration_minutes INTEGER
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor') THEN
    RAISE EXCEPTION 'permission_denied: only owners and doctors may update session duration';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 180 THEN
    RAISE EXCEPTION 'validation_error: duration must be between 1 and 180 minutes';
  END IF;

  SELECT * INTO v_session
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only update their assigned subject sessions';
  END IF;

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
$$;


-- ─────────────────────────────────────────────
-- 6. cleanup_expired_sessions
--    M7: Purges sessions expired more than 1 hour ago.
--    Schedule via pg_cron:
--    SELECT cron.schedule('cleanup-sessions','0 * * * *',
--      'SELECT public.cleanup_expired_sessions();');
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.sessions
  WHERE expires_at < now() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Grant execute to authenticated so owners can trigger it manually if needed.
-- The function only deletes expired rows so it is safe to expose.
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO authenticated;


-- ===========================================================
-- Request context helpers (for audit logging)
-- ===========================================================
CREATE OR REPLACE FUNCTION private.request_headers()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb;
$$;

CREATE OR REPLACE FUNCTION private.current_request_ip()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_headers   JSONB;
  v_forwarded TEXT;
BEGIN
  v_headers := private.request_headers();
  v_forwarded := COALESCE(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', '');

  IF btrim(v_forwarded) <> '' THEN
    RETURN btrim(split_part(v_forwarded, ',', 1));
  END IF;

  RETURN COALESCE(NULLIF(inet_client_addr()::text, ''), 'unknown');
END;
$$;

CREATE OR REPLACE FUNCTION private.current_request_user_agent()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT NULLIF(btrim(COALESCE(private.request_headers()->>'user-agent', '')), '');
$$;


-- ─────────────────────────────────────────────
-- 7. log_login_session
--    Logs the current user's login session (IP + User-Agent).
--    Deduplicates within 10 minutes.
-- ─────────────────────────────────────────────
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

  INSERT INTO public.login_sessions (user_id, ip_address, user_agent)
  VALUES (v_caller.id, v_ip, v_agent)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


-- ─────────────────────────────────────────────
-- 8. submit_attendance (CONSOLIDATED)
--    Only STUDENT may call this.
--    Supports: TOTP hash or short_code, device fingerprint binding, GPS verification.
--    All parameters optional for backward compatibility; fingerprint auto-generated if not provided.
-- ─────────────────────────────────────────────
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
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  -- Rate limiting: max 10 submissions per minute per student
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

  -- Auto-generate fingerprint from request headers if not provided
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

  -- Match by TOTP (current/previous window) OR short_code
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

  -- Cross-subject check
  IF v_caller.subject_id IS DISTINCT FROM v_session.subject_id THEN
    RAISE EXCEPTION 'permission_denied: session does not belong to your subject';
  END IF;

  -- GPS verification: check student is within session radius
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
  ELSIF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
        AND (p_student_latitude IS NULL OR p_student_longitude IS NULL) THEN
    RAISE EXCEPTION 'location_denied: this session requires GPS verification, please enable location.';
  END IF;

  -- Device binding
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

  -- Duplicate check (UNIQUE constraint is the hard stop)
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'conflict: attendance already submitted for this session';
  END IF;

  -- Insert attendance with optional GPS coordinates + audit context.
  -- ip_address / section are populated from the request and the
  -- source session so the frontend attendance records resolve.
  INSERT INTO public.attendance (
    student_id, session_id,
    student_latitude, student_longitude,
    ip_address, section
  )
  VALUES (
    v_caller.id, v_session.id,
    p_student_latitude, p_student_longitude,
    v_ip, v_session.section
  )
  RETURNING * INTO v_record;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format(
      'submit_attendance: student %s -> session %s (device bound, GPS: %s)',
      v_caller.id,
      v_session.id,
      CASE WHEN p_student_latitude IS NOT NULL THEN 'yes' ELSE 'no' END
    ),
    jsonb_build_object(
      'session_id', v_session.id::text,
      'device_bound', TRUE,
      'gps_enabled', p_student_latitude IS NOT NULL
    )
  );

  RETURN v_record;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'device_conflict: this device is already linked to another student';
END;
$$;


-- ─────────────────────────────────────────────
-- 9. delete_student_device
--    Only OWNER may call this.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_student_device(
  p_student_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
  v_target public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may clear student devices';
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

  DELETE FROM public.student_devices
  WHERE student_id = p_student_id;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format('delete_student_device: cleared device binding for student %s', p_student_id)
  );
END;
$$;


-- ─────────────────────────────────────────────
-- 10. update_session_expiry
--    For closing/reopening sessions.
--    Callable by: OWNER, DOCTOR, TA (for their assigned subject)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_session_expiry(
  p_session_id UUID,
  p_expires_at TIMESTAMPTZ
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may update sessions';
  END IF;

  SELECT * INTO v_session
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role IN ('doctor', 'ta') AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: you may only update sessions for your assigned subject';
  END IF;

  UPDATE public.sessions
  SET expires_at = p_expires_at
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format('update_session_expiry: session %s -> %s', p_session_id, p_expires_at)
  );

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_session_expiry TO authenticated;