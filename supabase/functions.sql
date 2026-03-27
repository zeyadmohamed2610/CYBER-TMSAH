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

  -- 8. Audit log
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format('create_user: created %s (auth_id=%s, role=%s)', v_new.id, p_auth_id, p_role)
  );

  RETURN v_new;
END;
$$;


-- ─────────────────────────────────────────────
-- 2. generate_rotating_hash
--    Only OWNER may call this.
--    Creates a session with a 256-bit random hash,
--    valid for exactly 2 minutes.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_subject_id UUID
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_hash    TEXT;
  v_session public.sessions;
BEGIN
  -- 1. Resolve caller
  SELECT * INTO v_caller
  FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  -- 2. Enforce owner-only
  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may generate sessions';
  END IF;

  -- 3. Ensure subject exists
  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  -- 4. Generate random hash using built-in gen_random_uuid() — no pgcrypto needed
  v_hash := replace(gen_random_uuid()::text, '-', '') ||
            replace(gen_random_uuid()::text, '-', '');

  -- 5. Insert session (2-minute window)
  INSERT INTO public.sessions (subject_id, rotating_hash, expires_at)
  VALUES (p_subject_id, v_hash, now() + INTERVAL '2 minutes')
  RETURNING * INTO v_session;

  -- 6. Audit log
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format('generate_session: created session %s for subject %s', v_session.id, p_subject_id)
  );

  RETURN v_session;
END;
$$;


-- ─────────────────────────────────────────────
-- 3. submit_attendance
--    Only STUDENT may call this.
--    Only valid write path to the attendance table.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_hash TEXT
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
  v_record  public.attendance;
BEGIN
  -- 1. Resolve caller
  v_caller := private.get_caller_user();

  -- 2. Enforce student-only
  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  -- 3. Validate hash input
  IF p_hash IS NULL OR length(trim(p_hash)) = 0 THEN
    RAISE EXCEPTION 'validation_error: attendance hash cannot be empty';
  END IF;

  -- 4. Look up session by hash AND expiry in one query.
  --    "not found" and "expired" return the same error to
  --    prevent session-existence oracle attacks.
  SELECT * INTO v_session
  FROM public.sessions
  WHERE rotating_hash = trim(p_hash)
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired: attendance hash is invalid or has expired';
  END IF;

  -- 5. Cross-subject check
  IF v_caller.subject_id IS DISTINCT FROM v_session.subject_id THEN
    RAISE EXCEPTION 'permission_denied: session does not belong to your subject';
  END IF;

  -- 6. Duplicate check (UNIQUE constraint is the hard stop;
  --    this gives a clean error message before hitting it)
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'conflict: attendance already submitted for this session';
  END IF;

  -- 7. Insert — only valid write path to attendance
  INSERT INTO public.attendance (student_id, session_id)
  VALUES (v_caller.id, v_session.id)
  RETURNING * INTO v_record;

  -- 8. Audit log
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format('submit_attendance: student %s -> session %s', v_caller.id, v_session.id)
  );

  RETURN v_record;
END;
$$;


-- ─────────────────────────────────────────────
-- 4. cleanup_expired_sessions
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
-- Attendance system reconciliation
-- These functions align the database API with the frontend code.
-- ===========================================================

-- Remove legacy overloads that confuse PostgREST RPC resolution.
DROP FUNCTION IF EXISTS public.log_login_session(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_attendance(TEXT, TEXT, TEXT, TEXT);

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


CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_subject_id UUID,
  p_duration_minutes INTEGER
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_hash    TEXT;
  v_session public.sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor') THEN
    RAISE EXCEPTION 'permission_denied: only owners and doctors may generate sessions';
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

  INSERT INTO public.sessions (subject_id, rotating_hash, expires_at)
  VALUES (p_subject_id, v_hash, now() + make_interval(mins => p_duration_minutes))
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format(
      'generate_session: created session %s for subject %s (%s minutes)',
      v_session.id,
      p_subject_id,
      p_duration_minutes
    )
  );

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_subject_id UUID
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  RETURN public.generate_rotating_hash(p_subject_id, 10);
END;
$$;


CREATE OR REPLACE FUNCTION public.refresh_session_hash(
  p_session_id UUID
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
  v_hash    TEXT;
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

  UPDATE public.sessions
  SET rotating_hash = v_hash
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id, format('refresh_session_hash: refreshed session %s', p_session_id));

  RETURN v_session;
END;
$$;


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


CREATE OR REPLACE FUNCTION public.set_session_duration(
  p_session_id UUID,
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


CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_hash TEXT,
  p_device_fingerprint TEXT
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
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  IF p_hash IS NULL OR length(trim(p_hash)) = 0 THEN
    RAISE EXCEPTION 'validation_error: attendance hash cannot be empty';
  END IF;

  v_fp := trim(COALESCE(p_device_fingerprint, ''));
  IF v_fp = '' THEN
    RAISE EXCEPTION 'validation_error: device fingerprint cannot be empty';
  END IF;

  v_ip := private.current_request_ip();

  SELECT * INTO v_session
  FROM public.sessions
  WHERE rotating_hash = trim(p_hash)
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired: attendance hash is invalid or has expired';
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
    SELECT 1
    FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'conflict: attendance already submitted for this session';
  END IF;

  INSERT INTO public.attendance (student_id, session_id)
  VALUES (v_caller.id, v_session.id)
  RETURNING * INTO v_record;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format(
      'submit_attendance: student %s -> session %s (device bound)',
      v_caller.id,
      v_session.id
    )
  );

  RETURN v_record;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'device_conflict: this device is already linked to another student';
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_hash TEXT
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_fingerprint TEXT;
BEGIN
  v_fingerprint := encode(
    digest(
      COALESCE(private.current_request_user_agent(), '') || '|' ||
      COALESCE(private.current_request_ip(), ''),
      'sha256'
    ),
    'hex'
  );

  RETURN public.submit_attendance(p_hash, v_fingerprint);
END;
$$;


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
