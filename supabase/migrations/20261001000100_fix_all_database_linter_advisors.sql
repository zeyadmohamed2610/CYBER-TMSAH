-- ==============================================================================
-- Migration: 20261001000100_fix_all_database_linter_advisors.sql
-- Description:
--   Comprehensive resolution of all Supabase Database Linter & Security Advisors:
--   1. Fix unindexed_foreign_keys (error_reports.user_id)
--   2. Convert functions to SECURITY INVOKER where appropriate (report_system_error, count_students)
--   3. Revoke permissions from anon role on administrative and authenticated-only functions
--   4. Fix rls_policy_always_true (audit_logs, error_reports)
--   5. Fix multiple_permissive_policies (drop duplicate ALL and overlapping policies)
--   6. Fix auth_rls_initplan across all tables by wrapping auth.uid() and auth.jwt()
--      with scalar subqueries (SELECT ...) for optimal InitPlan query planning
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Index for foreign key: error_reports.user_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_error_reports_user_id ON public.error_reports (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Convert functions to SECURITY INVOKER
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_system_error(
  p_error_message text,
  p_error_stack text DEFAULT NULL,
  p_page_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.error_reports (
    user_id,
    error_message,
    error_stack,
    page_url,
    status
  ) VALUES (
    (SELECT auth.uid()),
    p_error_message,
    p_error_stack,
    p_page_url,
    'open'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_students()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT count(*) FROM public.users WHERE role = 'student';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Revoke execution from anon on sensitive & internal functions
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.ensure_auth_user_defaults() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.approve_join_request(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_join_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_user_subjects(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_subjects(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_students() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lock_student_device(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_attendance(text, text, double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clear_system_logs() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_by_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text, text, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_lecture(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_lecture(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.end_lecture(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_manual_attendance(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.publish_all_schedule(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_session_hash(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_session_duration(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_session_expiry(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_session_duration(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_session_expiry(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stop_session(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_student_device(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_rotating_hash(uuid, integer, double precision, double precision, integer, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC, anon;

-- Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_join_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_subjects(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subjects(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_students() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_student_device(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_attendance(text, text, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_system_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_lecture(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_lecture(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_lecture(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_manual_attendance(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_all_schedule(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_session_hash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_session_duration(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_session_expiry(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_duration(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_expiry(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_student_device(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rotating_hash(uuid, integer, double precision, double precision, integer, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_system_error(text, text, text) TO anon, authenticated;

-- Revoke anon on all overloads of update_user, add_material, update_material, delete_material
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'update_user' AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM PUBLIC, anon;';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO authenticated;';
  END LOOP;

  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname IN ('add_material', 'update_material', 'delete_material')
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM PUBLIC, anon;';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO authenticated;';
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Audit Logs (Fix rls_policy_always_true & auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (action IS NOT NULL AND length(trim(action)) > 0);

CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Error Reports (Fix rls_policy_always_true & auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "error_reports_insert_policy" ON public.error_reports;
DROP POLICY IF EXISTS "error_reports_select_policy" ON public.error_reports;
DROP POLICY IF EXISTS "error_reports_update_policy" ON public.error_reports;
DROP POLICY IF EXISTS "error_reports_delete_policy" ON public.error_reports;

CREATE POLICY "error_reports_insert_policy" ON public.error_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (error_message IS NOT NULL AND length(trim(error_message)) > 0);

CREATE POLICY "error_reports_select_policy" ON public.error_reports
  FOR SELECT TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "error_reports_update_policy" ON public.error_reports
  FOR UPDATE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "error_reports_delete_policy" ON public.error_reports
  FOR DELETE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Course Materials (Fix multiple_permissive_policies & auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "course_materials_modify_consolidated" ON public.course_materials;
DROP POLICY IF EXISTS "course_materials_delete_consolidated" ON public.course_materials;
DROP POLICY IF EXISTS "course_materials_insert_consolidated" ON public.course_materials;
DROP POLICY IF EXISTS "course_materials_select_consolidated" ON public.course_materials;
DROP POLICY IF EXISTS "course_materials_update_consolidated" ON public.course_materials;

CREATE POLICY "course_materials_select_consolidated" ON public.course_materials
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "course_materials_insert_consolidated" ON public.course_materials
  FOR INSERT TO authenticated
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "course_materials_update_consolidated" ON public.course_materials
  FOR UPDATE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "course_materials_delete_consolidated" ON public.course_materials
  FOR DELETE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Exam Schedules (Fix multiple_permissive_policies & auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "exam_schedules_modify_consolidated" ON public.exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_delete_consolidated" ON public.exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_insert_consolidated" ON public.exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_select_consolidated" ON public.exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_update_consolidated" ON public.exam_schedules;

CREATE POLICY "exam_schedules_select_consolidated" ON public.exam_schedules
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "exam_schedules_insert_consolidated" ON public.exam_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "exam_schedules_update_consolidated" ON public.exam_schedules
  FOR UPDATE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "exam_schedules_delete_consolidated" ON public.exam_schedules
  FOR DELETE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Published Schedule (Fix multiple_permissive_policies & auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "published_schedule_modify_consolidated" ON public.published_schedule;
DROP POLICY IF EXISTS "published_schedule_delete_consolidated" ON public.published_schedule;
DROP POLICY IF EXISTS "published_schedule_insert_consolidated" ON public.published_schedule;
DROP POLICY IF EXISTS "published_schedule_select_consolidated" ON public.published_schedule;
DROP POLICY IF EXISTS "published_schedule_update_consolidated" ON public.published_schedule;

CREATE POLICY "published_schedule_select_consolidated" ON public.published_schedule
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "published_schedule_insert_consolidated" ON public.published_schedule
  FOR INSERT TO authenticated
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "published_schedule_update_consolidated" ON public.published_schedule
  FOR UPDATE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "published_schedule_delete_consolidated" ON public.published_schedule
  FOR DELETE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Password Reset Requests (Fix multiple_permissive_policies & auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "password_reset_requests_admin_consolidated" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_delete_consolidated" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_insert_consolidated" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_select_consolidated" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_update_consolidated" ON public.password_reset_requests;

CREATE POLICY "password_reset_requests_select_consolidated" ON public.password_reset_requests
  FOR SELECT TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "password_reset_requests_insert_consolidated" ON public.password_reset_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

CREATE POLICY "password_reset_requests_update_consolidated" ON public.password_reset_requests
  FOR UPDATE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "password_reset_requests_delete_consolidated" ON public.password_reset_requests
  FOR DELETE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Join Requests (Fix multiple_permissive_policies & auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "join_requests_admin_consolidated" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_anon_insert" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_delete_consolidated" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_insert_consolidated" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_select_consolidated" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_update_consolidated" ON public.join_requests;

CREATE POLICY "join_requests_select_consolidated" ON public.join_requests
  FOR SELECT TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "join_requests_insert_consolidated" ON public.join_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND full_name IS NOT NULL
    AND length(trim(full_name)) >= 3
    AND email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

CREATE POLICY "join_requests_update_consolidated" ON public.join_requests
  FOR UPDATE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "join_requests_delete_consolidated" ON public.join_requests
  FOR DELETE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. System Logs (Fix multiple_permissive_policies & auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "system_logs_admin_consolidated" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_select_consolidated" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_insert_consolidated" ON public.system_logs;

CREATE POLICY "system_logs_select_consolidated" ON public.system_logs
  FOR SELECT TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "system_logs_insert_consolidated" ON public.system_logs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (action IS NOT NULL AND length(trim(action)) > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. User Subjects (Fix multiple_permissive_policies & auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "owner_coordinator_see_user_subjects" ON public.user_subjects;
DROP POLICY IF EXISTS "user_see_own_subjects" ON public.user_subjects;
DROP POLICY IF EXISTS "user_subjects_select_consolidated" ON public.user_subjects;

CREATE POLICY "user_subjects_select_consolidated" ON public.user_subjects
  FOR SELECT TO authenticated
  USING (
    (user_id = (SELECT u.id FROM public.users u WHERE u.auth_id = (SELECT auth.uid()) LIMIT 1))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Device Locks (Fix auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "device_locks_select_policy" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_insert_policy" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_update_policy" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_delete_policy" ON public.device_locks;

CREATE POLICY "device_locks_select_policy" ON public.device_locks
  FOR SELECT TO authenticated
  USING (
    (student_auth_id = (SELECT auth.uid()))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "device_locks_insert_policy" ON public.device_locks
  FOR INSERT TO authenticated
  WITH CHECK (
    (student_auth_id = (SELECT auth.uid()))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "device_locks_update_policy" ON public.device_locks
  FOR UPDATE TO authenticated
  USING (
    ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "device_locks_delete_policy" ON public.device_locks
  FOR DELETE TO authenticated
  USING (
    ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Attendance (Fix auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "attendance_select_consolidated" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_consolidated" ON public.attendance;

CREATE POLICY "attendance_select_consolidated" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    (student_id = (SELECT u.id FROM public.users u WHERE u.auth_id = (SELECT auth.uid()) LIMIT 1))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor', 'ta'))
  );

CREATE POLICY "attendance_insert_consolidated" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    (student_id = (SELECT u.id FROM public.users u WHERE u.auth_id = (SELECT auth.uid()) LIMIT 1))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor', 'ta'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. Lectures (Fix auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lectures_select_consolidated" ON public.lectures;
DROP POLICY IF EXISTS "lectures_insert_consolidated" ON public.lectures;
DROP POLICY IF EXISTS "lectures_update_consolidated" ON public.lectures;
DROP POLICY IF EXISTS "lectures_delete_consolidated" ON public.lectures;

CREATE POLICY "lectures_select_consolidated" ON public.lectures
  FOR SELECT TO authenticated
  USING (
    (created_by = (SELECT u.id FROM public.users u WHERE u.auth_id = (SELECT auth.uid()) LIMIT 1))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor', 'ta'))
  );

CREATE POLICY "lectures_insert_consolidated" ON public.lectures
  FOR INSERT TO authenticated
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor'))
  );

CREATE POLICY "lectures_update_consolidated" ON public.lectures
  FOR UPDATE TO authenticated
  USING (
    (created_by = (SELECT u.id FROM public.users u WHERE u.auth_id = (SELECT auth.uid()) LIMIT 1))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    (created_by = (SELECT u.id FROM public.users u WHERE u.auth_id = (SELECT auth.uid()) LIMIT 1))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "lectures_delete_consolidated" ON public.lectures
  FOR DELETE TO authenticated
  USING (
    (created_by = (SELECT u.id FROM public.users u WHERE u.auth_id = (SELECT auth.uid()) LIMIT 1))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. Student Devices (Fix auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "student_devices_select_consolidated" ON public.student_devices;

CREATE POLICY "student_devices_select_consolidated" ON public.student_devices
  FOR SELECT TO authenticated
  USING (
    (student_id = (SELECT u.id FROM public.users u WHERE u.auth_id = (SELECT auth.uid()) LIMIT 1))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. Users (Fix auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_consolidated" ON public.users;
DROP POLICY IF EXISTS "users_insert_consolidated" ON public.users;
DROP POLICY IF EXISTS "users_update_consolidated" ON public.users;
DROP POLICY IF EXISTS "users_delete_consolidated" ON public.users;

CREATE POLICY "users_select_consolidated" ON public.users
  FOR SELECT TO authenticated
  USING (
    (auth_id = (SELECT auth.uid()))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
    OR (
      role = 'student'
      AND (
        (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('doctor', 'ta'))
        OR ((SELECT private.get_current_user_role()) IN ('doctor', 'ta'))
      )
    )
  );

CREATE POLICY "users_insert_consolidated" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "users_update_consolidated" ON public.users
  FOR UPDATE TO authenticated
  USING (
    (auth_id = (SELECT auth.uid()))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    (auth_id = (SELECT auth.uid()))
    OR (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "users_delete_consolidated" ON public.users
  FOR DELETE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. Sessions (Fix auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sessions_select_consolidated" ON public.sessions;

CREATE POLICY "sessions_select_consolidated" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor', 'ta'))
    OR (expires_at > now())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. Subjects (Fix auth_rls_initplan)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "subjects_select_consolidated" ON public.subjects;
DROP POLICY IF EXISTS "subjects_insert_consolidated" ON public.subjects;
DROP POLICY IF EXISTS "subjects_update_consolidated" ON public.subjects;
DROP POLICY IF EXISTS "subjects_delete_consolidated" ON public.subjects;

CREATE POLICY "subjects_select_consolidated" ON public.subjects
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "subjects_insert_consolidated" ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "subjects_update_consolidated" ON public.subjects
  FOR UPDATE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  )
  WITH CHECK (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

CREATE POLICY "subjects_delete_consolidated" ON public.subjects
  FOR DELETE TO authenticated
  USING (
    (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator'))
    OR ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. Notify PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
