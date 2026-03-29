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
ALTER TABLE public.system_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════
-- TABLE: users
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "self_read"         ON public.users;
DROP POLICY IF EXISTS "owner_all_users"   ON public.users;
DROP POLICY IF EXISTS "doctor_own_users"  ON public.users;
DROP POLICY IF EXISTS "student_own_users" ON public.users;

-- Any authenticated user may always read their own row.
-- This is required so fetchUserRole() works at login time before
-- private.current_user_role() can return a value.
CREATE POLICY "self_read"
  ON public.users
  FOR SELECT
  USING (auth_id = auth.uid());

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

DROP POLICY IF EXISTS "security_definer_insert_logs" ON public.system_logs;

CREATE POLICY "security_definer_insert_logs"
  ON public.system_logs
  FOR INSERT
  WITH CHECK ( true );


-- ═══════════════════════════════════════════════
-- TABLE: course_materials
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "owner_all_course_materials"    ON public.course_materials;
DROP POLICY IF EXISTS "doctor_read_course_materials"  ON public.course_materials;
DROP POLICY IF EXISTS "student_read_course_materials" ON public.course_materials;
DROP POLICY IF EXISTS "ta_read_course_materials"      ON public.course_materials;

CREATE POLICY "owner_all_course_materials"
  ON public.course_materials
  FOR ALL
  USING      ( private.current_user_role() = 'owner' )
  WITH CHECK ( private.current_user_role() = 'owner' );

CREATE POLICY "doctor_read_course_materials"
  ON public.course_materials
  FOR SELECT
  USING ( private.current_user_role() = 'doctor' );

CREATE POLICY "student_read_course_materials"
  ON public.course_materials
  FOR SELECT
  USING ( private.current_user_role() = 'student' );

CREATE POLICY "ta_read_course_materials"
  ON public.course_materials
  FOR SELECT
  USING ( private.current_user_role() = 'ta' );


-- ═══════════════════════════════════════════════
-- ═══════════════════════════════════════════════

-- ═══════════════════════════════════════════════
-- ═══════════════════════════════════════════════

-- ===========================================================
-- Attendance system reconciliation
-- ===========================================================

ALTER TABLE public.student_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

-- Doctors need to see all students because students can attend any subject.
DROP POLICY IF EXISTS "doctor_own_users" ON public.users;
CREATE POLICY "doctor_own_users"
  ON public.users
  FOR SELECT
  USING (
    private.current_user_role() = 'doctor'
    AND (
      auth_id = auth.uid()
      OR role = 'student'
    )
  );

-- Students can browse all subjects shown in their dashboard.
DROP POLICY IF EXISTS "student_own_subject" ON public.subjects;
CREATE POLICY "student_own_subject"
  ON public.subjects
  FOR SELECT
  USING ( private.current_user_role() = 'student' );

-- Students can see all sessions; the frontend filters active ones when needed.
DROP POLICY IF EXISTS "student_own_sessions" ON public.sessions;
CREATE POLICY "student_own_sessions"
  ON public.sessions
  FOR SELECT
  USING ( private.current_user_role() = 'student' );

-- Device bindings: owner sees all bindings, student may inspect their own row.
DROP POLICY IF EXISTS "owner_all_student_devices" ON public.student_devices;
DROP POLICY IF EXISTS "student_own_device" ON public.student_devices;

CREATE POLICY "owner_all_student_devices"
  ON public.student_devices
  FOR SELECT
  USING ( private.current_user_role() = 'owner' );

CREATE POLICY "student_own_device"
  ON public.student_devices
  FOR SELECT
  USING (
    private.current_user_role() = 'student'
    AND student_id = private.current_user_id()
  );

-- Login session history is private to each logged-in user.
DROP POLICY IF EXISTS "self_read_login_sessions" ON public.login_sessions;

CREATE POLICY "self_read_login_sessions"
  ON public.login_sessions
  FOR SELECT
  USING ( user_id = private.current_user_id() );
