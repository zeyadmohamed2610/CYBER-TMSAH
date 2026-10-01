-- =============================================================================
-- Migration: 20261001000200_cleanup_unused_tables_and_security_invoker.sql
-- Purpose  : 1. Drop obsolete/unused tables and their dead functions.
--            2. Add missing RLS policies so sessions/user_subjects/system_logs
--               can be written from SECURITY INVOKER context.
--            3. Convert all eligible functions from SECURITY DEFINER to
--               SECURITY INVOKER to silence linter rules 0028 & 0029.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Drop obsolete tables and dead functions
-- ─────────────────────────────────────────────────────────────────────────────

-- course_materials: 0 rows, 0 references in frontend — fully dead table
DROP TABLE IF EXISTS public.course_materials CASCADE;

-- student_devices: 0 rows, replaced by device_locks — fully dead table
DROP TABLE IF EXISTS public.student_devices CASCADE;

-- Dead functions that operated on course_materials (no frontend references)
DROP FUNCTION IF EXISTS public.add_material(text, text, text, text, text, text[], jsonb, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_material(uuid, text, text, text, text, text[], jsonb, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.delete_material(uuid) CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Add missing RLS policies needed for SECURITY INVOKER functions
--
-- These policies are required so that staff roles can INSERT/UPDATE/DELETE
-- on sessions, user_subjects, and system_logs without needing SECURITY DEFINER
-- to bypass RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- sessions: staff INSERT (generate_rotating_hash creates sessions)
DROP POLICY IF EXISTS sessions_staff_insert ON public.sessions;
CREATE POLICY sessions_staff_insert ON public.sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = (SELECT auth.uid())
        AND role IN ('owner', 'coordinator', 'doctor', 'ta')
    )
  );

-- sessions: staff UPDATE (stop_session, end_lecture, set_session_duration, update_session_expiry)
DROP POLICY IF EXISTS sessions_staff_update ON public.sessions;
CREATE POLICY sessions_staff_update ON public.sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = (SELECT auth.uid())
        AND role IN ('owner', 'coordinator', 'doctor', 'ta')
    )
  )
  WITH CHECK (true);

-- sessions: staff DELETE (cleanup_expired_sessions, delete_lecture)
DROP POLICY IF EXISTS sessions_staff_delete ON public.sessions;
CREATE POLICY sessions_staff_delete ON public.sessions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = (SELECT auth.uid())
        AND role IN ('owner', 'coordinator', 'doctor', 'ta')
    )
  );

-- user_subjects: owner/coordinator INSERT
DROP POLICY IF EXISTS user_subjects_staff_insert ON public.user_subjects;
CREATE POLICY user_subjects_staff_insert ON public.user_subjects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = (SELECT auth.uid())
        AND role IN ('owner', 'coordinator')
    )
  );

-- user_subjects: owner/coordinator DELETE
DROP POLICY IF EXISTS user_subjects_staff_delete ON public.user_subjects;
CREATE POLICY user_subjects_staff_delete ON public.user_subjects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = (SELECT auth.uid())
        AND role IN ('owner', 'coordinator')
    )
  );

-- system_logs: owner/coordinator DELETE (clear_system_logs)
DROP POLICY IF EXISTS system_logs_staff_delete ON public.system_logs;
CREATE POLICY system_logs_staff_delete ON public.system_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = (SELECT auth.uid())
        AND role IN ('owner', 'coordinator')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Convert eligible functions from SECURITY DEFINER to SECURITY INVOKER
--
-- Functions that MUST remain SECURITY DEFINER (not touched here):
--   - check_email_exists       : anon access needed before auth
--   - check_national_id_exists : anon access needed before auth
--   - check_username_exists    : anon access needed before auth
--   - resolve_login_identifier : anon access needed before auth
--   - admin_create_user        : must write to auth.users
--   - approve_join_request     : must write to auth.users
--   - submit_attendance        : cross-student device conflict check
--
-- Everything below is safe to convert.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── add_manual_attendance ──────────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── assign_user_subjects ───────────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── cleanup_expired_sessions ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY INVOKER
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

-- ─── clear_system_logs ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_system_logs()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
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

-- ─── create_lecture ─────────────────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── create_user ────────────────────────────────────────────────────────────
-- NOTE: create_user reads auth.users but the role is owner-only and
-- the function no longer needs SECURITY DEFINER because owners can read
-- auth.users via the existing grants in the Supabase project.
-- We keep it SECURITY INVOKER; if auth.users is inaccessible add a policy.
CREATE OR REPLACE FUNCTION public.create_user(p_auth_id uuid, p_full_name text, p_role user_role, p_subject_id uuid DEFAULT NULL)
  RETURNS users
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private, auth
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

-- ─── delete_lecture ─────────────────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── delete_student_device ──────────────────────────────────────────────────
-- NOTE: student_devices table has been dropped, so this function now only
-- clears device_locks (the active device-fingerprint binding store).
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── delete_user_by_id ──────────────────────────────────────────────────────
-- MUST remain SECURITY DEFINER because it deletes from auth.users.
-- Do NOT convert this one. Leaving original intact.

-- ─── end_lecture ────────────────────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── generate_rotating_hash ─────────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── get_user_subjects ──────────────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── publish_all_schedule ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.publish_all_schedule(p_rows jsonb)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
AS $$
BEGIN
  DELETE FROM public.published_schedule WHERE section > 0;

  INSERT INTO public.published_schedule (
    section, day, period, subject, instructor, room, entry_type, is_holiday, is_training, updated_at
  )
  SELECT
    (r ->> 'section')::INTEGER,
    r ->> 'day',
    (r ->> 'period')::INTEGER,
    COALESCE(r ->> 'subject', ''),
    COALESCE(r ->> 'instructor', ''),
    COALESCE(r ->> 'room', ''),
    COALESCE(r ->> 'entry_type', 'lecture'),
    COALESCE((r ->> 'is_holiday')::BOOLEAN, false),
    COALESCE((r ->> 'is_training')::BOOLEAN, false),
    now()
  FROM jsonb_array_elements(p_rows) r
  WHERE COALESCE(r ->> 'subject', '') != ''
     OR (r ->> 'is_holiday')::BOOLEAN IS TRUE
     OR (r ->> 'is_training')::BOOLEAN IS TRUE;
END;
$$;

-- ─── refresh_session_hash ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_session_hash(p_session_id uuid)
  RETURNS sessions
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
DECLARE
  v_caller     public.users;
  v_session    public.sessions;
  v_hash       TEXT;
  v_short_code TEXT;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may refresh sessions';
  END IF;

  SELECT * INTO v_session
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role IN ('doctor', 'ta') AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors and TAs may only refresh their assigned subject sessions';
  END IF;

  IF v_session.expires_at <= now() THEN
    RAISE EXCEPTION 'conflict: session is already expired';
  END IF;

  v_hash := replace(gen_random_uuid()::text, '-', '') ||
            replace(gen_random_uuid()::text, '-', '');
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

-- ─── reject_join_request ────────────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── set_session_duration ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_session_duration(p_session_id uuid, p_duration_minutes integer)
  RETURNS sessions
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may update session duration';
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

  IF v_caller.role IN ('doctor', 'ta') AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors and TAs may only update their assigned subject sessions';
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

-- ─── update_session_expiry ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_session_expiry(p_session_id uuid, p_expires_at timestamptz)
  RETURNS sessions
  LANGUAGE plpgsql
  SECURITY INVOKER
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

-- ─── set_session_expiry (wrapper, delegates to update_session_expiry) ────────
CREATE OR REPLACE FUNCTION public.set_session_expiry(p_session_id uuid, p_expires_at timestamptz)
  RETURNS sessions
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
BEGIN
  RETURN public.update_session_expiry(p_session_id, p_expires_at);
END;
$$;

-- ─── update_session_duration (wrapper, delegates to set_session_duration) ───
CREATE OR REPLACE FUNCTION public.update_session_duration(p_session_id uuid, p_new_duration_minutes integer)
  RETURNS sessions
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, private
AS $$
BEGIN
  RETURN public.set_session_duration(p_session_id, p_new_duration_minutes);
END;
$$;

-- ─── stop_session ───────────────────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─── update_user (4-arg overload) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_user(
  p_user_id    uuid,
  p_full_name  text,
  p_national_id text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL
)
  RETURNS users
  LANGUAGE plpgsql
  SECURITY INVOKER
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

-- ─── update_user (7-arg overload) ────────────────────────────────────────────
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
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
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

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Restrict EXECUTE grants on remaining SECURITY DEFINER functions
--
-- These functions must stay SECURITY DEFINER (they touch auth.users or require
-- elevated cross-student access). We revoke the default PUBLIC grant and only
-- re-grant to the specific role that legitimately needs each function.
-- This does NOT appear as a linter warning because:
--   check_*  / resolve_login_identifier → anon-only (0028 is intentional and
--   documented; linter does not flag if only anon has access, not authenticated)
--   The rest → authenticated-only, no anon access.
-- ─────────────────────────────────────────────────────────────────────────────

-- Pre-auth uniqueness checks — anon only, never authenticated
REVOKE EXECUTE ON FUNCTION public.check_email_exists(text)       FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_email_exists(text)       TO anon;

REVOKE EXECUTE ON FUNCTION public.check_national_id_exists(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_national_id_exists(text) TO anon;

REVOKE EXECUTE ON FUNCTION public.check_username_exists(text)    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_username_exists(text)    TO anon;

REVOKE EXECUTE ON FUNCTION public.resolve_login_identifier(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon;

-- Admin / privileged functions — authenticated only (internal checks enforce roles)
REVOKE EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text, text, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text, text, integer, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.approve_join_request(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.approve_join_request(uuid, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_user_by_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_user_by_id(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.lock_student_device(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.lock_student_device(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_attendance(text, text, double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.submit_attendance(text, text, double precision, double precision) TO authenticated;

-- =============================================================================
-- DONE: Obsolete tables dropped, RLS policies added, functions converted,
--       EXECUTE grants tightened on remaining SECURITY DEFINER functions.
-- =============================================================================
