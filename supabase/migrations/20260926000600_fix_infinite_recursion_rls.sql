-- ==============================================================================
-- MIGRATION: 20260926000600_fix_infinite_recursion_rls.sql
-- FIX: Infinite recursion in public.users RLS policies
--
-- ROOT CAUSE:
--   The users_select_consolidated policy on public.users contained a subquery
--   "SELECT role FROM public.users WHERE auth_id = auth.uid()" which re-triggers
--   the same RLS policy on public.users, causing infinite recursion (42P17).
--
-- SOLUTION:
--   1. Create a SECURITY DEFINER helper function that bypasses RLS to get
--      the current user's role directly (no recursion).
--   2. Replace ALL recursive subqueries across ALL tables with this helper.
-- ==============================================================================

-- STEP 1: Create SECURITY DEFINER helper to get current user's role
-- This bypasses RLS, so no recursion occurs.
CREATE OR REPLACE FUNCTION private.get_current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT role
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION private.get_current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.get_current_user_role() FROM anon;

-- STEP 2: Fix public.users policies (the main recursion source)
DROP POLICY IF EXISTS "users_select_consolidated" ON public.users;
DROP POLICY IF EXISTS "users_update_consolidated" ON public.users;
DROP POLICY IF EXISTS "users_insert_consolidated" ON public.users;
DROP POLICY IF EXISTS "users_delete_consolidated" ON public.users;

CREATE POLICY "users_select_consolidated" ON public.users
  FOR SELECT TO authenticated
  USING (
    auth_id = (SELECT auth.uid())
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
    OR (
      role = 'student'
      AND (
        (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'ta')
        OR (SELECT private.get_current_user_role()) IN ('doctor', 'ta')
      )
    )
  );

CREATE POLICY "users_update_consolidated" ON public.users
  FOR UPDATE TO authenticated
  USING (
    auth_id = (SELECT auth.uid())
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    auth_id = (SELECT auth.uid())
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "users_insert_consolidated" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "users_delete_consolidated" ON public.users
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- STEP 3: Fix other tables

-- attendance
DROP POLICY IF EXISTS "attendance_select_consolidated" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_consolidated" ON public.attendance;

CREATE POLICY "attendance_select_consolidated" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor', 'ta')
  );

CREATE POLICY "attendance_insert_consolidated" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor', 'ta')
  );

-- course_materials
DROP POLICY IF EXISTS "course_materials_modify_consolidated" ON public.course_materials;
CREATE POLICY "course_materials_modify_consolidated" ON public.course_materials
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- exam_schedules
DROP POLICY IF EXISTS "exam_schedules_modify_consolidated" ON public.exam_schedules;
CREATE POLICY "exam_schedules_modify_consolidated" ON public.exam_schedules
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- published_schedule
DROP POLICY IF EXISTS "published_schedule_modify_consolidated" ON public.published_schedule;
CREATE POLICY "published_schedule_modify_consolidated" ON public.published_schedule
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- lectures
DROP POLICY IF EXISTS "lectures_select_consolidated" ON public.lectures;
DROP POLICY IF EXISTS "lectures_insert_consolidated" ON public.lectures;
DROP POLICY IF EXISTS "lectures_update_consolidated" ON public.lectures;
DROP POLICY IF EXISTS "lectures_delete_consolidated" ON public.lectures;

CREATE POLICY "lectures_select_consolidated" ON public.lectures
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor', 'ta')
  );

CREATE POLICY "lectures_insert_consolidated" ON public.lectures
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor')
  );

CREATE POLICY "lectures_update_consolidated" ON public.lectures
  FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "lectures_delete_consolidated" ON public.lectures
  FOR DELETE TO authenticated
  USING (
    created_by = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- sessions
DROP POLICY IF EXISTS "sessions_select_consolidated" ON public.sessions;
CREATE POLICY "sessions_select_consolidated" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (expires_at > now())
  );

-- student_devices
DROP POLICY IF EXISTS "student_devices_select_consolidated" ON public.student_devices;
CREATE POLICY "student_devices_select_consolidated" ON public.student_devices
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- join_requests
DROP POLICY IF EXISTS "join_requests_admin_consolidated" ON public.join_requests;
CREATE POLICY "join_requests_admin_consolidated" ON public.join_requests
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- password_reset_requests
DROP POLICY IF EXISTS "password_reset_requests_admin_consolidated" ON public.password_reset_requests;
CREATE POLICY "password_reset_requests_admin_consolidated" ON public.password_reset_requests
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- device_locks
DROP POLICY IF EXISTS "device_locks_admin_consolidated" ON public.device_locks;
CREATE POLICY "device_locks_admin_consolidated" ON public.device_locks
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- system_logs
DROP POLICY IF EXISTS "system_logs_admin_consolidated" ON public.system_logs;
CREATE POLICY "system_logs_admin_consolidated" ON public.system_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Grant execute on helper function to authenticated role
-- (required so RLS policies can call private.get_current_user_role())
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION private.get_current_user_role() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Fix REMAINING old policies that still used recursive subqueries
-- These were created by earlier migrations not covered in migration 000500
-- ─────────────────────────────────────────────────────────────────────────────
-- GRANT execute first
GRANT EXECUTE ON FUNCTION private.get_current_user_role() TO authenticated;

-- ── course_materials ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "course_materials_delete_consolidated" ON public.course_materials;
DROP POLICY IF EXISTS "course_materials_insert_consolidated" ON public.course_materials;
DROP POLICY IF EXISTS "course_materials_update_consolidated" ON public.course_materials;

CREATE POLICY "course_materials_delete_consolidated" ON public.course_materials
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "course_materials_insert_consolidated" ON public.course_materials
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "course_materials_update_consolidated" ON public.course_materials
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- ── device_locks ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "device_locks_delete_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_insert_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_select_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_update_consolidated" ON public.device_locks;

CREATE POLICY "device_locks_delete_consolidated" ON public.device_locks
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "device_locks_insert_consolidated" ON public.device_locks
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "device_locks_select_consolidated" ON public.device_locks
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "device_locks_update_consolidated" ON public.device_locks
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- ── exam_schedules ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "exam_schedules_delete_consolidated" ON public.exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_insert_consolidated" ON public.exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_update_consolidated" ON public.exam_schedules;

CREATE POLICY "exam_schedules_delete_consolidated" ON public.exam_schedules
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "exam_schedules_insert_consolidated" ON public.exam_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "exam_schedules_update_consolidated" ON public.exam_schedules
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- ── join_requests ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "join_requests_delete_consolidated" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_select_consolidated" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_update_consolidated" ON public.join_requests;

CREATE POLICY "join_requests_delete_consolidated" ON public.join_requests
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "join_requests_select_consolidated" ON public.join_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "join_requests_update_consolidated" ON public.join_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- ── password_reset_requests ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "password_reset_requests_delete_consolidated" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_select_consolidated" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_update_consolidated" ON public.password_reset_requests;

CREATE POLICY "password_reset_requests_delete_consolidated" ON public.password_reset_requests
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "password_reset_requests_select_consolidated" ON public.password_reset_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "password_reset_requests_update_consolidated" ON public.password_reset_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- ── published_schedule ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "published_schedule_delete_consolidated" ON public.published_schedule;
DROP POLICY IF EXISTS "published_schedule_insert_consolidated" ON public.published_schedule;
DROP POLICY IF EXISTS "published_schedule_update_consolidated" ON public.published_schedule;

CREATE POLICY "published_schedule_delete_consolidated" ON public.published_schedule
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "published_schedule_insert_consolidated" ON public.published_schedule
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "published_schedule_update_consolidated" ON public.published_schedule
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- ── system_logs ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "system_logs_select_consolidated" ON public.system_logs;

CREATE POLICY "system_logs_select_consolidated" ON public.system_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

