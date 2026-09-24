-- ===========================================================
-- permissions.sql
-- University Attendance System
-- Run order: 4 of 4  (runs AFTER schema, functions, rls;
-- BEFORE the gps_migration / migration_all_fixes / audit_fixes
-- patches, so it may only reference signatures that
-- functions.sql has already defined).
-- ===========================================================

-- ─────────────────────────────────────────────
-- PUBLIC SCHEMA: remove default CREATE privilege
-- ─────────────────────────────────────────────
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────
-- AUTHENTICATED ROLE — table grants
-- RLS policies restrict which rows each role can see.
-- Only tables that already exist at this step are granted.
-- ─────────────────────────────────────────────
GRANT SELECT ON public.users             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects        TO authenticated;
GRANT SELECT ON public.sessions          TO authenticated;
GRANT SELECT ON public.attendance        TO authenticated;
GRANT SELECT ON public.student_devices   TO authenticated;
GRANT SELECT ON public.login_sessions    TO authenticated;
GRANT SELECT ON public.lectures          TO authenticated;
GRANT SELECT ON public.course_materials  TO authenticated;

-- system_logs: owner can SELECT via RLS; non-owners are blocked by
-- RLS at query time. Grant is required or even owners cannot read.
GRANT SELECT ON public.system_logs TO authenticated;

-- service_role backs server-side admin flows (Edge Functions / admin scripts)
-- and bypasses RLS, but it still needs ordinary SQL privileges.
GRANT SELECT, INSERT, UPDATE ON public.users TO service_role;
GRANT INSERT ON public.system_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role;

-- Owners may update their own profile fields (full_name, national_id).
-- Role / subject_id changes are NOT allowed via direct UPDATE — they
-- go through the update_user RPC, preventing privilege escalation.
GRANT UPDATE (full_name, national_id) ON public.users TO authenticated;

-- No INSERT/UPDATE/DELETE granted on any other table to authenticated.
-- All mutations go through SECURITY DEFINER functions only.

-- ─────────────────────────────────────────────
-- ANON ROLE — deny everything
-- ─────────────────────────────────────────────
REVOKE ALL ON public.users           FROM anon;
REVOKE ALL ON public.subjects        FROM anon;
REVOKE ALL ON public.sessions        FROM anon;
REVOKE ALL ON public.attendance      FROM anon;
REVOKE ALL ON public.system_logs     FROM anon;
REVOKE ALL ON public.student_devices FROM anon;
REVOKE ALL ON public.login_sessions  FROM anon;
REVOKE ALL ON public.lectures        FROM anon;
REVOKE ALL ON public.course_materials FROM anon;

-- ─────────────────────────────────────────────
-- FUNCTION GRANTS
-- PostgreSQL grants EXECUTE to PUBLIC by default for new functions.
-- Revoke from PUBLIC (covers anon) first, then GRANT only to
-- authenticated.  Unauthenticated callers can never reach these RPCs.
--
-- IMPORTANT: only signatures that functions.sql has ALREADY defined
-- are listed here.  Functions introduced later by migration_all_fixes
-- carry their own grants in that file (they do not exist yet here).
-- ─────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.create_user(UUID, TEXT, public.user_role, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user(UUID, TEXT, public.user_role, UUID) TO authenticated;

-- generate_rotating_hash — single consolidated 7-param signature
REVOKE EXECUTE ON FUNCTION public.generate_rotating_hash(UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_rotating_hash(UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, UUID, TEXT) TO authenticated;

-- submit_attendance — single consolidated 4-param signature
REVOKE EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- session lifecycle helpers defined in functions.sql
REVOKE EXECUTE ON FUNCTION public.refresh_session_hash(UUID)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stop_session(UUID)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_session_duration(UUID, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_session_expiry(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_login_session()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_student_device(UUID)        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_session_hash(UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_session(UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_session_duration(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_expiry(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_login_session()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_student_device(UUID)        TO authenticated;

-- gps_distance_meters is created by gps_migration.sql (runs after
-- this file), so its grant lives there / audit_fixes.sql.

-- ─────────────────────────────────────────────
-- PRIVATE FUNCTION GRANTS (RLS policy helpers)
-- These functions are SECURITY DEFINER (run as postgres) so they
-- cannot leak cross-user data. However, authenticated users MUST
-- have EXECUTE permission on them because RLS policies call them
-- on every table access. Without EXECUTE the entire table SELECT
-- returns "permission denied for function" (error 42501).
-- Only authenticated gets EXECUTE. anon gets nothing.
-- ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.get_caller_user()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_role()           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_subject_id()     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_id()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.request_headers()             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_request_ip()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_request_user_agent()  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.get_caller_user()            TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_role()          TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_subject_id()    TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_id()            TO authenticated;
GRANT EXECUTE ON FUNCTION private.request_headers()            TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_request_ip()         TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_request_user_agent() TO authenticated;
