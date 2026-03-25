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

  IF p_role IN ('doctor', 'student') AND p_subject_id IS NULL THEN
    RAISE EXCEPTION 'validation_error: doctors and students require a subject_id';
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
  v_caller := private.get_caller_user();

  -- 2. Enforce owner-only
  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may generate sessions';
  END IF;

  -- 3. Ensure subject exists
  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  -- 4. Generate 256-bit cryptographically random hash
  v_hash := encode(gen_random_bytes(32), 'hex');

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
