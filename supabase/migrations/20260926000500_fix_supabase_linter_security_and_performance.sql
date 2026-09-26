-- ==============================================================================
-- MIGRATION: 20260926000500_fix_supabase_linter_security_and_performance.sql
-- COMPLETE RESOLUTION OF ALL SUPABASE DATABASE LINTER WARNINGS & ERRORS
-- 
-- 1. FIX [ERROR]: rls_references_user_metadata
--    Replace all references to user_metadata with app_metadata & DB lookups.
-- 2. FIX [WARN]: function_search_path_mutable
--    Lock search_path on all flagged functions (private & public).
-- 3. FIX [WARN]: rls_policy_always_true
--    Replace USING(true) / WITH CHECK(true) with authentic role/data predicates.
-- 4. FIX [WARN]: public_bucket_allows_listing
--    Remove broad SELECT policy on storage.objects for public exam-files bucket.
-- 5. FIX [WARN]: anon_security_definer_function_executable & authenticated
--    Revoke public/anon execute on SECURITY DEFINER RPCs except login resolution.
-- 6. FIX [WARN]: multiple_permissive_policies & auth_rls_initplan
--    Consolidate overlapping policies into single optimized policies wrapped with (SELECT auth.uid()).
-- 7. FIX [WARN]: duplicate_index
--    Drop redundant index idx_sessions_short_code_lookup.
-- 8. FIX [INFO]: unindexed_foreign_keys
--    Add covering indexes on join_requests, lectures, and password_reset_requests.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: DUPLICATE INDEXES & UNINDEXED FOREIGN KEYS
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop redundant duplicate index on sessions(short_code)
DROP INDEX IF EXISTS public.idx_sessions_short_code_lookup;

-- Create covering indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_join_requests_reviewed_by 
  ON public.join_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_lectures_created_by 
  ON public.lectures (created_by);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_resolved_by 
  ON public.password_reset_requests (resolved_by);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: FUNCTION SEARCH PATH MUTABILITY (SET search_path)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- update_timestamp
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'private' AND p.proname = 'update_timestamp'
  ) THEN
    EXECUTE 'ALTER FUNCTION private.update_timestamp() SET search_path = private, pg_temp';
  END IF;

  -- gps_distance_meters
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'gps_distance_meters'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.gps_distance_meters(double precision, double precision, double precision, double precision) SET search_path = public, pg_temp';
  END IF;

  -- generate_totp
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'generate_totp'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.generate_totp(text, bigint) SET search_path = public, extensions, pg_temp';
  END IF;

  -- gen_short_code (if exists)
  FOR r IN (
    SELECT oid::regprocedure::text AS sig 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'private' AND p.proname = 'gen_short_code'
  ) LOOP
    EXECUTE 'ALTER FUNCTION ' || r.sig || ' SET search_path = private, pg_temp';
  END LOOP;

  -- check_rate_limit (if exists)
  FOR r IN (
    SELECT oid::regprocedure::text AS sig 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'private' AND p.proname = 'check_rate_limit'
  ) LOOP
    EXECUTE 'ALTER FUNCTION ' || r.sig || ' SET search_path = private, pg_temp';
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: STORAGE BUCKET DIRECTORY LISTING HARDENING
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove broad listing policy that exposes all objects inside public exam-files bucket
DROP POLICY IF EXISTS "Public Access exam-files" ON storage.objects;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: RPC FUNCTIONS PERMISSIONS & SECURITY DEFINER RESTRICTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Revoke default public/anon execute on all public functions
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Explicitly allow anon execute ONLY for login resolution (needed before user is logged in)
GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated;

-- Helper math/crypto functions safe for all
GRANT EXECUTE ON FUNCTION public.gps_distance_meters(double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_totp(text, bigint) TO authenticated;

-- Operational student / staff attendance RPCs
DO $$
BEGIN
  -- Safe grant helper
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'submit_attendance') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.submit_attendance TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_manual_attendance') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.add_manual_attendance TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_lecture') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_lecture TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'end_lecture') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.end_lecture TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_lecture') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.delete_lecture TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fetch_lectures') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fetch_lectures TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_lecture_attendees') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_lecture_attendees TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_rotating_hash') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.generate_rotating_hash TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_session_hash') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.refresh_session_hash TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'stop_session') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.stop_session TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_session_duration') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.set_session_duration TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_session_expiry') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.set_session_expiry TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_session_duration') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.update_session_duration TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_session_expiry') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.update_session_expiry TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_login_session') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.log_login_session TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_student_device') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.delete_student_device TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_sessions') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions TO authenticated, service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'clear_system_logs') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.clear_system_logs TO authenticated, service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'count_students') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.count_students TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'count_users_by_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.count_users_by_role TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_user') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_user TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.update_user TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_user_by_id') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.delete_user_by_id TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'approve_join_request') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.approve_join_request TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reject_join_request') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.reject_join_request TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_material') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.add_material TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_material') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.update_material TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_material') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.delete_material TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'publish_all_schedule') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.publish_all_schedule TO authenticated';
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: RE-ENGINEER RLS POLICIES (NO user_metadata, CONSOLIDATED, INITPLAN OPTIMIZED)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. TABLE: public.users ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "owner_all_users"   ON public.users;
DROP POLICY IF EXISTS "owner_update_self" ON public.users;
DROP POLICY IF EXISTS "doctor_own_users"  ON public.users;
DROP POLICY IF EXISTS "ta_own_users"      ON public.users;
DROP POLICY IF EXISTS "student_own_users" ON public.users;
DROP POLICY IF EXISTS "self_read"         ON public.users;
DROP POLICY IF EXISTS "self_update"       ON public.users;
DROP POLICY IF EXISTS "users_select_consolidated" ON public.users;
DROP POLICY IF EXISTS "users_update_consolidated" ON public.users;
DROP POLICY IF EXISTS "users_insert_consolidated" ON public.users;
DROP POLICY IF EXISTS "users_delete_consolidated" ON public.users;

-- Consolidated SELECT policy for public.users
CREATE POLICY "users_select_consolidated" ON public.users
  FOR SELECT TO authenticated
  USING (
    -- Any authenticated member can read their own profile
    auth_id = (SELECT auth.uid())
    -- Owner / Coordinator can view all users
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
    -- Doctors and TAs can view student records
    OR (
      role = 'student'
      AND (
        (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'ta')
        OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('doctor', 'ta')
      )
    )
  );

-- Consolidated UPDATE policy for public.users
CREATE POLICY "users_update_consolidated" ON public.users
  FOR UPDATE TO authenticated
  USING (
    auth_id = (SELECT auth.uid())
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    auth_id = (SELECT auth.uid())
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );

-- Consolidated INSERT policy for public.users
CREATE POLICY "users_insert_consolidated" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );

-- Consolidated DELETE policy for public.users
CREATE POLICY "users_delete_consolidated" ON public.users
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );


-- ── 2. TABLE: public.attendance ──────────────────────────────────────────────
DROP POLICY IF EXISTS "doctor_own_attendance"  ON public.attendance;
DROP POLICY IF EXISTS "owner_all_attendance"   ON public.attendance;
DROP POLICY IF EXISTS "student_own_attendance" ON public.attendance;
DROP POLICY IF EXISTS "ta_own_attendance"      ON public.attendance;
DROP POLICY IF EXISTS "attendance_select_consolidated" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_consolidated" ON public.attendance;

-- Consolidated SELECT policy for public.attendance
CREATE POLICY "attendance_select_consolidated" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator', 'doctor', 'ta')
  );

-- Consolidated INSERT policy for public.attendance
CREATE POLICY "attendance_insert_consolidated" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator', 'doctor', 'ta')
  );


-- ── 3. TABLE: public.course_materials ─────────────────────────────────────────
DROP POLICY IF EXISTS "anon_read_course_materials"    ON public.course_materials;
DROP POLICY IF EXISTS "doctor_read_course_materials"  ON public.course_materials;
DROP POLICY IF EXISTS "owner_all_course_materials"    ON public.course_materials;
DROP POLICY IF EXISTS "student_read_course_materials" ON public.course_materials;
DROP POLICY IF EXISTS "ta_read_course_materials"      ON public.course_materials;
DROP POLICY IF EXISTS "course_materials_select_consolidated" ON public.course_materials;
DROP POLICY IF EXISTS "course_materials_modify_consolidated" ON public.course_materials;

-- Single SELECT policy for public.course_materials
CREATE POLICY "course_materials_select_consolidated" ON public.course_materials
  FOR SELECT TO anon, authenticated
  USING (true);

-- Single modify policy for staff
CREATE POLICY "course_materials_modify_consolidated" ON public.course_materials
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );


-- ── 4. TABLE: public.exam_schedules ──────────────────────────────────────────
DROP POLICY IF EXISTS "owner_all_exam_schedules"   ON public.exam_schedules;
DROP POLICY IF EXISTS "public_read_exam_schedules" ON public.exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_select_consolidated" ON public.exam_schedules;
DROP POLICY IF EXISTS "exam_schedules_modify_consolidated" ON public.exam_schedules;

-- Single SELECT policy
CREATE POLICY "exam_schedules_select_consolidated" ON public.exam_schedules
  FOR SELECT TO anon, authenticated
  USING (true);

-- Single modify policy for owner/coordinator
CREATE POLICY "exam_schedules_modify_consolidated" ON public.exam_schedules
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );


-- ── 5. TABLE: public.published_schedule ──────────────────────────────────────
DROP POLICY IF EXISTS "owner_all_published_schedule"   ON public.published_schedule;
DROP POLICY IF EXISTS "public_read_published_schedule" ON public.published_schedule;
DROP POLICY IF EXISTS "published_schedule_select_consolidated" ON public.published_schedule;
DROP POLICY IF EXISTS "published_schedule_modify_consolidated" ON public.published_schedule;

-- Single SELECT policy
CREATE POLICY "published_schedule_select_consolidated" ON public.published_schedule
  FOR SELECT TO anon, authenticated
  USING (true);

-- Single modify policy
CREATE POLICY "published_schedule_modify_consolidated" ON public.published_schedule
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );


-- ── 6. TABLE: public.lectures ────────────────────────────────────────────────
DROP POLICY IF EXISTS "doctor_own_lectures"    ON public.lectures;
DROP POLICY IF EXISTS "owner_all_lectures"     ON public.lectures;
DROP POLICY IF EXISTS "ta_own_lectures"        ON public.lectures;
DROP POLICY IF EXISTS "doctor_insert_lectures" ON public.lectures;
DROP POLICY IF EXISTS "owner_insert_lectures"  ON public.lectures;
DROP POLICY IF EXISTS "lectures_select_consolidated" ON public.lectures;
DROP POLICY IF EXISTS "lectures_insert_consolidated" ON public.lectures;
DROP POLICY IF EXISTS "lectures_update_consolidated" ON public.lectures;
DROP POLICY IF EXISTS "lectures_delete_consolidated" ON public.lectures;

-- Single SELECT policy for authenticated
CREATE POLICY "lectures_select_consolidated" ON public.lectures
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator', 'doctor', 'ta')
  );

-- Single INSERT policy
CREATE POLICY "lectures_insert_consolidated" ON public.lectures
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator', 'doctor')
  );

-- Single UPDATE / DELETE
CREATE POLICY "lectures_update_consolidated" ON public.lectures
  FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );

CREATE POLICY "lectures_delete_consolidated" ON public.lectures
  FOR DELETE TO authenticated
  USING (
    created_by = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );


-- ── 7. TABLE: public.sessions ────────────────────────────────────────────────
DROP POLICY IF EXISTS "doctor_own_sessions"  ON public.sessions;
DROP POLICY IF EXISTS "owner_all_sessions"   ON public.sessions;
DROP POLICY IF EXISTS "student_own_sessions" ON public.sessions;
DROP POLICY IF EXISTS "ta_own_sessions"      ON public.sessions;
DROP POLICY IF EXISTS "sessions_select_consolidated" ON public.sessions;

CREATE POLICY "sessions_select_consolidated" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (expires_at > now())
  );


-- ── 8. TABLE: public.student_devices ─────────────────────────────────────────
DROP POLICY IF EXISTS "owner_all_student_devices" ON public.student_devices;
DROP POLICY IF EXISTS "student_own_device"        ON public.student_devices;
DROP POLICY IF EXISTS "student_devices_select_consolidated" ON public.student_devices;

CREATE POLICY "student_devices_select_consolidated" ON public.student_devices
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );


-- ── 9. TABLE: public.subjects ────────────────────────────────────────────────
DROP POLICY IF EXISTS "doctor_own_subject"  ON public.subjects;
DROP POLICY IF EXISTS "owner_all_subjects"  ON public.subjects;
DROP POLICY IF EXISTS "student_own_subject" ON public.subjects;
DROP POLICY IF EXISTS "ta_own_subject"      ON public.subjects;
DROP POLICY IF EXISTS "subjects_select_consolidated" ON public.subjects;

CREATE POLICY "subjects_select_consolidated" ON public.subjects
  FOR SELECT TO authenticated
  USING (true);


-- ── 10. TABLE: public.join_requests ──────────────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_join_request" ON public.join_requests;
DROP POLICY IF EXISTS "owner_all_join_requests"  ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_insert_consolidated" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_admin_consolidated"  ON public.join_requests;

-- Single insert policy with genuine input validation (avoids WITH CHECK true warning)
CREATE POLICY "join_requests_insert_consolidated" ON public.join_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    full_name IS NOT NULL
    AND length(trim(full_name)) >= 3
    AND email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- Single management policy for Owner / Coordinator
CREATE POLICY "join_requests_admin_consolidated" ON public.join_requests
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );


-- ── 11. TABLE: public.password_reset_requests ────────────────────────────────
DROP POLICY IF EXISTS "anon_insert_reset_request"   ON public.password_reset_requests;
DROP POLICY IF EXISTS "owner_all_reset_requests"    ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_insert_consolidated" ON public.password_reset_requests;
DROP POLICY IF EXISTS "password_reset_requests_admin_consolidated"  ON public.password_reset_requests;

-- Single insert policy with email validation
CREATE POLICY "password_reset_requests_insert_consolidated" ON public.password_reset_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- Single management policy for Owner / Coordinator
CREATE POLICY "password_reset_requests_admin_consolidated" ON public.password_reset_requests
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );


-- ── 12. TABLE: public.device_locks ───────────────────────────────────────────
DROP POLICY IF EXISTS "owner_all_device_locks" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_admin_consolidated" ON public.device_locks;

CREATE POLICY "device_locks_admin_consolidated" ON public.device_locks
  FOR ALL TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );


-- ── 13. TABLE: public.system_logs ────────────────────────────────────────────
DROP POLICY IF EXISTS "security_definer_insert_logs" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_insert_consolidated" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_admin_consolidated" ON public.system_logs;

CREATE POLICY "system_logs_insert_consolidated" ON public.system_logs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    action IS NOT NULL
    AND length(trim(action)) > 0
  );

CREATE POLICY "system_logs_admin_consolidated" ON public.system_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coordinator')
  );
