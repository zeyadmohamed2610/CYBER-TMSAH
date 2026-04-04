-- ===========================================================
-- migration_all_fixes.sql
-- University Attendance System – Comprehensive Fix Migration
-- Run AFTER all existing SQL files (schema, functions, rls, permissions)
-- ===========================================================

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Add 'ta' to user_role enum
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block.
-- Run this statement on its own if your client wraps in BEGIN/COMMIT.
-- ─────────────────────────────────────────────────────────────
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ta';

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Update chk_subject_per_role to include 'ta' role
-- (must run AFTER the enum value is committed above)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS chk_subject_per_role;

ALTER TABLE public.users
  ADD CONSTRAINT chk_subject_per_role CHECK (
    (role = 'owner'   AND subject_id IS NULL)     OR
    (role = 'doctor'  AND subject_id IS NOT NULL) OR
    (role = 'student' AND subject_id IS NULL)     OR
    (role = 'ta'      AND subject_id IS NOT NULL)
  );

-- ─────────────────────────────────────────────────────────────
-- STEP 3: Add 'section' column to sessions table
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS section TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_section
  ON public.sessions (section)
  WHERE section IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 4: Drop old 6-parameter generate_rotating_hash and
--         replace with 7-parameter version (adds p_section)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.generate_rotating_hash(UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, UUID);

CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_subject_id       UUID,
  p_duration_minutes INTEGER,
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

  v_short_code := lpad(floor(random() * 1000000)::text, 6, '0');

  INSERT INTO public.sessions (
    subject_id, rotating_hash, short_code, expires_at,
    latitude, longitude, radius_meters, lecture_id, section
  )
  VALUES (
    p_subject_id, v_hash, v_short_code,
    now() + make_interval(mins => p_duration_minutes),
    p_latitude, p_longitude, p_radius_meters, p_lecture_id, p_section
  )
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format(
      'generate_session: created session %s for subject %s (%s minutes, GPS: %s, code: %s, section: %s)',
      v_session.id, p_subject_id, p_duration_minutes,
      p_latitude IS NOT NULL, v_short_code,
      COALESCE(p_section, 'none')
    )
  );

  RETURN v_session;
END;
$$;

-- Update the 1-param wrapper to call the new 7-param version
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

-- ─────────────────────────────────────────────────────────────
-- STEP 5: fetch_lectures – returns lectures with counts
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fetch_lectures(
  p_subject_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  subject_id     UUID,
  title          TEXT,
  lecture_date   DATE,
  created_by     UUID,
  created_at     TIMESTAMPTZ,
  subject_name   TEXT,
  session_count  BIGINT,
  attendee_count BIGINT,
  is_ended       BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    l.id,
    l.subject_id,
    l.title,
    l.lecture_date,
    l.created_by,
    l.created_at,
    s.name                                       AS subject_name,
    COUNT(DISTINCT se.id)                        AS session_count,
    COUNT(DISTINCT a.id)                         AS attendee_count,
    -- is_ended = true when no sessions exist OR all sessions are expired
    COALESCE(BOOL_AND(se.expires_at <= now()), true) AS is_ended
  FROM   public.lectures  l
  JOIN   public.subjects  s  ON s.id  = l.subject_id
  LEFT JOIN public.sessions  se ON se.lecture_id = l.id
  LEFT JOIN public.attendance a  ON a.session_id  = se.id
  WHERE  (p_subject_id IS NULL OR l.subject_id = p_subject_id)
  GROUP  BY l.id, l.subject_id, l.title, l.lecture_date,
            l.created_by, l.created_at, s.name
  ORDER  BY l.lecture_date DESC, l.created_at DESC;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 6: create_lecture
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_lecture(
  p_subject_id UUID,
  p_title      TEXT DEFAULT 'محاضرة'
)
RETURNS public.lectures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_lecture public.lectures;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may create lectures';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_caller.subject_id IS DISTINCT FROM p_subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only create lectures for their assigned subject';
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

-- ─────────────────────────────────────────────────────────────
-- STEP 7: get_lecture_attendees
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lecture_attendees(
  p_lecture_id UUID
)
RETURNS TABLE (
  attendance_id     UUID,
  student_name      TEXT,
  national_id       TEXT,
  session_id        UUID,
  short_code        TEXT,
  submitted_at      TIMESTAMPTZ,
  ip_address        TEXT,
  student_latitude  DOUBLE PRECISION,
  student_longitude DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    a.id            AS attendance_id,
    u.full_name     AS student_name,
    u.national_id,
    a.session_id,
    se.short_code,
    a.created_at    AS submitted_at,
    sd.ip_address,
    a.student_latitude,
    a.student_longitude
  FROM public.attendance     a
  JOIN public.sessions       se ON se.id         = a.session_id
  JOIN public.users          u  ON u.id          = a.student_id
  LEFT JOIN public.student_devices sd ON sd.student_id = a.student_id
  WHERE se.lecture_id = p_lecture_id
  ORDER BY a.created_at DESC;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 8: end_lecture – expires all active sessions for a lecture
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.end_lecture(
  p_lecture_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may end lectures';
  END IF;

  UPDATE public.sessions
  SET    expires_at = now()
  WHERE  lecture_id = p_lecture_id
    AND  expires_at > now();

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('end_lecture: ended all sessions for lecture %s', p_lecture_id));
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 9: delete_lecture – permanently removes lecture + sessions + attendance
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_lecture(
  p_lecture_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may delete lectures';
  END IF;

  -- Delete attendance for all sessions of this lecture
  DELETE FROM public.attendance
  WHERE session_id IN (
    SELECT id FROM public.sessions WHERE lecture_id = p_lecture_id
  );

  -- Delete all sessions of this lecture
  DELETE FROM public.sessions WHERE lecture_id = p_lecture_id;

  -- Delete the lecture itself
  DELETE FROM public.lectures WHERE id = p_lecture_id;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('delete_lecture: permanently deleted lecture %s with all sessions and attendance', p_lecture_id));
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 10: clear_system_logs
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_system_logs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may clear system logs';
  END IF;

  DELETE FROM public.system_logs;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id, 'clear_system_logs: all previous logs cleared by owner');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 11: delete_user_by_id
-- Deletes the public.users row (cascades to attendance, devices, login_sessions).
-- The orphan auth.users record is cleaned up separately via Admin API.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_by_id(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_caller public.users;
  v_target public.users;
  v_auth_id uuid;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may delete users';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  IF v_target.role = 'owner' AND v_caller.id = p_user_id THEN
    RAISE EXCEPTION 'validation_error: owners cannot delete themselves';
  END IF;

  v_auth_id := v_target.auth_id;

  DELETE FROM public.users WHERE id = p_user_id;
  
  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('delete_user: deleted user %s (role=%s, name=%s)',
      p_user_id, v_target.role, v_target.full_name));
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 12: add_manual_attendance (owner / doctor only)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_manual_attendance(
  p_student_id UUID,
  p_session_id UUID
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_student public.users;
  v_session public.sessions;
  v_record  public.attendance;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may add manual attendance';
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

  INSERT INTO public.attendance (student_id, session_id)
  VALUES (p_student_id, p_session_id)
  RETURNING * INTO v_record;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('add_manual_attendance: student %s -> session %s (by %s)',
      p_student_id, p_session_id, v_caller.id));

  RETURN v_record;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 13: update_user – owner-only profile update via RPC
-- Replaces direct PATCH /users which is not permitted.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_user(
  p_user_id     UUID,
  p_full_name   TEXT,
  p_national_id TEXT DEFAULT NULL,
  p_subject_id  UUID DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_target  public.users;
  v_updated public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may update user profiles';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) < 5 THEN
    RAISE EXCEPTION 'validation_error: full_name must be at least 5 characters';
  END IF;

  UPDATE public.users
  SET
    full_name   = trim(p_full_name),
    national_id = CASE WHEN v_target.role = 'student'            THEN p_national_id  ELSE v_target.national_id END,
    subject_id  = CASE WHEN v_target.role IN ('doctor', 'ta')    THEN p_subject_id   ELSE v_target.subject_id  END
  WHERE id = p_user_id
  RETURNING * INTO v_updated;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('update_user: updated user %s (role=%s)', p_user_id, v_target.role));

  RETURN v_updated;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 14: update_session_duration – alias matching frontend call name
-- Frontend calls "update_session_duration" with "p_new_duration_minutes".
-- The underlying function is set_session_duration(UUID, INTEGER).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_session_duration(
  p_session_id           UUID,
  p_new_duration_minutes INTEGER
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  RETURN public.set_session_duration(p_session_id, p_new_duration_minutes);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 15: set_session_expiry – allows owner/doctor to set
-- a session's expiry to an exact timestamp (used by toggle open/close).
-- Replaces the broken direct PATCH on sessions.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_session_expiry(
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
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may modify sessions';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only modify their assigned subject sessions';
  END IF;

  UPDATE public.sessions
  SET    expires_at = p_expires_at
  WHERE  id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('set_session_expiry: session %s expires_at -> %s', p_session_id, p_expires_at));

  RETURN v_session;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 16: RLS – enable for lectures + add policies
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_lectures"  ON public.lectures;
DROP POLICY IF EXISTS "doctor_own_lectures" ON public.lectures;
DROP POLICY IF EXISTS "ta_own_lectures"     ON public.lectures;

CREATE POLICY "owner_all_lectures"
  ON public.lectures
  FOR ALL
  USING      ( private.current_user_role() = 'owner' )
  WITH CHECK ( private.current_user_role() = 'owner' );

CREATE POLICY "doctor_own_lectures"
  ON public.lectures
  FOR SELECT
  USING (
    private.current_user_role() = 'doctor'
    AND subject_id = private.current_user_subject_id()
  );

CREATE POLICY "ta_own_lectures"
  ON public.lectures
  FOR SELECT
  USING (
    private.current_user_role() = 'ta'
    AND subject_id = private.current_user_subject_id()
  );

-- ─────────────────────────────────────────────────────────────
-- STEP 17: Table-level GRANTs
-- ─────────────────────────────────────────────────────────────
GRANT SELECT ON public.lectures TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- STEP 18: Function GRANTs for all new functions
-- ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.fetch_lectures(UUID)                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_lecture(UUID, TEXT)                         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_lecture_attendees(UUID)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.end_lecture(UUID)                                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_lecture(UUID)                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clear_system_logs()                                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_by_id(UUID)                            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_manual_attendance(UUID, UUID)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_user(UUID, TEXT, TEXT, UUID)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_session_duration(UUID, INTEGER)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_session_expiry(UUID, TIMESTAMPTZ)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_rotating_hash(UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, UUID, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fetch_lectures(UUID)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_lecture(UUID, TEXT)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lecture_attendees(UUID)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_lecture(UUID)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_lecture(UUID)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_system_logs()                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_id(UUID)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_manual_attendance(UUID, UUID)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user(UUID, TEXT, TEXT, UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_duration(UUID, INTEGER)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_session_expiry(UUID, TIMESTAMPTZ)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rotating_hash(UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, UUID, TEXT)
  TO authenticated;
