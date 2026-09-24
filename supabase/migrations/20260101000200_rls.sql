-- ===========================================================
-- 20260101000200_rls.sql
-- University Attendance System — Row Level Security (ordered: 4 of 5)
--
-- Every table has RLS enabled.  Role/subject lookups use the
-- private.* SECURITY DEFINER helpers (no direct reads from
-- public.users), so there is zero recursive RLS.
--
-- student_devices / login_sessions: only SELF or a privileged
-- role may read a row — IP / fingerprint / UA are never exposed
-- across accounts.  Writes happen exclusively through
-- SECURITY DEFINER functions.
-- ===========================================================

-- ─────────────────────────────────────────────
-- Enable RLS on every table
-- ─────────────────────────────────────────────
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_materials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_locks       ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════
-- users
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "self_read"            ON public.users;
DROP POLICY IF EXISTS "owner_all_users"      ON public.users;
DROP POLICY IF EXISTS "owner_update_self"    ON public.users;
DROP POLICY IF EXISTS "doctor_own_users"     ON public.users;
DROP POLICY IF EXISTS "student_own_users"   ON public.users;

-- Any authenticated user may read their own row (login resolution).
CREATE POLICY "self_read"
  ON public.users
  FOR SELECT
  USING (auth_id = auth.uid());

-- Owner can do everything.
CREATE POLICY "owner_all_users"
  ON public.users
  FOR ALL
  USING      ( private.current_user_role() = 'owner' )
  WITH CHECK ( private.current_user_role() = 'owner' );

-- Doctors see themselves + every student in the system.
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

-- Students see only their own row.
CREATE POLICY "student_own_users"
  ON public.users
  FOR SELECT
  USING (
    private.current_user_role() = 'student'
    AND auth_id = auth.uid()
  );

-- ═══════════════════════════════════════════════
-- subjects
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_all_subjects"   ON public.subjects;
DROP POLICY IF EXISTS "doctor_own_subject"   ON public.subjects;
DROP POLICY IF EXISTS "ta_own_subject"       ON public.subjects;
DROP POLICY IF EXISTS "student_own_subject"  ON public.subjects;

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

CREATE POLICY "ta_own_subject"
  ON public.subjects
  FOR SELECT
  USING (
    private.current_user_role() = 'ta'
    AND id = private.current_user_subject_id()
  );

CREATE POLICY "student_own_subject"
  ON public.subjects
  FOR SELECT
  USING ( private.current_user_role() = 'student' );

-- ═══════════════════════════════════════════════
-- sessions
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_all_sessions"   ON public.sessions;
DROP POLICY IF EXISTS "doctor_own_sessions"  ON public.sessions;
DROP POLICY IF EXISTS "ta_own_sessions"      ON public.sessions;
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

CREATE POLICY "ta_own_sessions"
  ON public.sessions
  FOR SELECT
  USING (
    private.current_user_role() = 'ta'
    AND subject_id = private.current_user_subject_id()
  );

-- Students may list sessions (frontend filters active ones).
CREATE POLICY "student_own_sessions"
  ON public.sessions
  FOR SELECT
  USING ( private.current_user_role() = 'student' );

-- ═══════════════════════════════════════════════
-- attendance
-- NO direct INSERT/UPDATE/DELETE for anyone — only via
-- submit_attendance() / add_manual_attendance() (SECURITY DEFINER).
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_all_attendance"   ON public.attendance;
DROP POLICY IF EXISTS "doctor_own_attendance"   ON public.attendance;
DROP POLICY IF EXISTS "ta_own_attendance"       ON public.attendance;
DROP POLICY IF EXISTS "student_own_attendance"  ON public.attendance;

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

CREATE POLICY "ta_own_attendance"
  ON public.attendance
  FOR SELECT
  USING (
    private.current_user_role() = 'ta'
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
-- system_logs  (owner-only SELECT; writes via SECURITY DEFINER fn)
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_all_logs"            ON public.system_logs;
DROP POLICY IF EXISTS "owner_read_logs"            ON public.system_logs;
DROP POLICY IF EXISTS "security_definer_insert_logs" ON public.system_logs;

CREATE POLICY "owner_read_logs"
  ON public.system_logs
  FOR SELECT
  USING ( private.current_user_role() = 'owner' );

-- SECURITY DEFINER functions insert audit rows on behalf of the owner.
CREATE POLICY "security_definer_insert_logs"
  ON public.system_logs
  FOR INSERT
  WITH CHECK ( true );

-- ═══════════════════════════════════════════════
-- course_materials
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_all_course_materials"   ON public.course_materials;
DROP POLICY IF EXISTS "doctor_read_course_materials"   ON public.course_materials;
DROP POLICY IF EXISTS "student_read_course_materials"  ON public.course_materials;
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
-- lectures
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_all_lectures"   ON public.lectures;
DROP POLICY IF EXISTS "doctor_own_lectures"  ON public.lectures;
DROP POLICY IF EXISTS "ta_own_lectures"      ON public.lectures;
DROP POLICY IF EXISTS "student_read_lectures" ON public.lectures;

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

CREATE POLICY "student_read_lectures"
  ON public.lectures
  FOR SELECT
  USING ( private.current_user_role() = 'student' );

-- ═══════════════════════════════════════════════
-- student_devices  (private: fingerprint + ip never cross accounts)
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_all_student_devices" ON public.student_devices;
DROP POLICY IF EXISTS "student_own_device"         ON public.student_devices;

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

-- ═══════════════════════════════════════════════
-- login_sessions  (private: ip + ua visible only to the owner)
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_read_login_sessions" ON public.login_sessions;
DROP POLICY IF EXISTS "self_read_login_sessions"  ON public.login_sessions;

CREATE POLICY "owner_read_login_sessions"
  ON public.login_sessions
  FOR SELECT
  USING ( private.current_user_role() = 'owner' );

CREATE POLICY "self_read_login_sessions"
  ON public.login_sessions
  FOR SELECT
  USING ( user_id = private.current_user_id() );

-- ═══════════════════════════════════════════════
-- device_locks  (written directly by the frontend; scoped per account)
-- No account may read/lock another account's device.
-- ═══════════════════════════════════════════════
DROP POLICY IF EXISTS "owner_all_device_locks"    ON public.device_locks;
DROP POLICY IF EXISTS "student_own_device_lock"   ON public.device_locks;

CREATE POLICY "owner_all_device_locks"
  ON public.device_locks
  FOR ALL
  USING      ( private.current_user_role() = 'owner' )
  WITH CHECK ( private.current_user_role() = 'owner' );

CREATE POLICY "student_own_device_lock"
  ON public.device_locks
  FOR ALL
  USING      (
              auth.uid() IS NOT NULL
              AND student_auth_id = auth.uid()
            )
  WITH CHECK (
              auth.uid() IS NOT NULL
              AND student_auth_id = auth.uid()
            );
