-- ===========================================================
-- rls.sql
-- University Attendance System
-- Run order: 3 of 4  (must run AFTER functions.sql)
-- ===========================================================
-- All role/subject lookups use SECURITY DEFINER helpers from
-- functions.sql (private.current_user_role etc.) — no direct
-- reads from public.users, so zero recursive RLS.
-- ===========================================================

-- Enable RLS on all tables
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════
-- TABLE: users
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "owner_all_users"   ON public.users;
DROP POLICY IF EXISTS "doctor_own_users"  ON public.users;
DROP POLICY IF EXISTS "student_own_users" ON public.users;

CREATE POLICY "owner_all_users"
  ON public.users
  FOR ALL
  USING      ( private.current_user_role() = 'owner' )
  WITH CHECK ( private.current_user_role() = 'owner' );

CREATE POLICY "doctor_own_users"
  ON public.users
  FOR SELECT
  USING (
    private.current_user_role() = 'doctor'
    AND (
      auth_id = auth.uid()
      OR (
        role = 'student'
        AND subject_id = private.current_user_subject_id()
      )
    )
  );

CREATE POLICY "student_own_users"
  ON public.users
  FOR SELECT
  USING (
    private.current_user_role() = 'student'
    AND auth_id = auth.uid()
  );


-- ═══════════════════════════════════════════════
-- TABLE: subjects
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "owner_all_subjects"  ON public.subjects;
DROP POLICY IF EXISTS "doctor_own_subject"  ON public.subjects;
DROP POLICY IF EXISTS "student_own_subject" ON public.subjects;

CREATE POLICY "owner_all_subjects"
  ON public.subjects
  FOR ALL
  USING      ( private.current_user_role() = 'owner' )
  WITH CHECK ( private.current_user_role() = 'owner' );

CREATE POLICY "doctor_own_subject"
  ON public.subjects
  FOR SELECT
  USING (
    private.current_user_role() = 'doctor'
    AND id = private.current_user_subject_id()
  );

CREATE POLICY "student_own_subject"
  ON public.subjects
  FOR SELECT
  USING (
    private.current_user_role() = 'student'
    AND id = private.current_user_subject_id()
  );


-- ═══════════════════════════════════════════════
-- TABLE: sessions
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "owner_all_sessions"   ON public.sessions;
DROP POLICY IF EXISTS "doctor_own_sessions"  ON public.sessions;
DROP POLICY IF EXISTS "student_own_sessions" ON public.sessions;

CREATE POLICY "owner_all_sessions"
  ON public.sessions
  FOR ALL
  USING      ( private.current_user_role() = 'owner' )
  WITH CHECK ( private.current_user_role() = 'owner' );

CREATE POLICY "doctor_own_sessions"
  ON public.sessions
  FOR SELECT
  USING (
    private.current_user_role() = 'doctor'
    AND subject_id = private.current_user_subject_id()
  );

CREATE POLICY "student_own_sessions"
  ON public.sessions
  FOR SELECT
  USING (
    private.current_user_role() = 'student'
    AND expires_at > now()
    AND subject_id = private.current_user_subject_id()
  );


-- ═══════════════════════════════════════════════
-- TABLE: attendance
-- NO direct INSERT to anyone — only via submit_attendance().
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "owner_all_attendance"   ON public.attendance;
DROP POLICY IF EXISTS "doctor_own_attendance"  ON public.attendance;
DROP POLICY IF EXISTS "student_own_attendance" ON public.attendance;

CREATE POLICY "owner_all_attendance"
  ON public.attendance
  FOR ALL
  USING      ( private.current_user_role() = 'owner' )
  WITH CHECK ( private.current_user_role() = 'owner' );

CREATE POLICY "doctor_own_attendance"
  ON public.attendance
  FOR SELECT
  USING (
    private.current_user_role() = 'doctor'
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id         = attendance.session_id
        AND s.subject_id = private.current_user_subject_id()
    )
  );

CREATE POLICY "student_own_attendance"
  ON public.attendance
  FOR SELECT
  USING (
    private.current_user_role() = 'student'
    AND student_id = private.current_user_id()
  );


-- ═══════════════════════════════════════════════
-- TABLE: system_logs
-- S5 fix: owner can only SELECT — all writes go through
-- SECURITY DEFINER functions. Owner cannot delete audit trails.
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "owner_all_logs"    ON public.system_logs;
DROP POLICY IF EXISTS "owner_read_logs"   ON public.system_logs;

CREATE POLICY "owner_read_logs"
  ON public.system_logs
  FOR SELECT
  USING ( private.current_user_role() = 'owner' );
-- INSERT is handled exclusively by SECURITY DEFINER functions
-- (create_user, generate_rotating_hash, submit_attendance).
-- No authenticated role may INSERT/UPDATE/DELETE system_logs directly.
