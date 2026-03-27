-- ===========================================================
-- permissions.sql
-- University Attendance System
-- Run order: 4 of 4
-- ===========================================================

-- ─────────────────────────────────────────────
-- PUBLIC SCHEMA: remove default CREATE privilege
-- ─────────────────────────────────────────────
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────
-- AUTHENTICATED ROLE — table grants
-- RLS policies restrict which rows each role can see.
-- ─────────────────────────────────────────────
GRANT SELECT ON public.users        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT SELECT ON public.sessions     TO authenticated;
GRANT SELECT ON public.attendance   TO authenticated;
GRANT SELECT ON public.student_devices TO authenticated;
GRANT SELECT ON public.login_sessions  TO authenticated;

-- system_logs: owner can SELECT via RLS; non-owners are blocked by
-- RLS at query time. Grant is required or even owners cannot read.
GRANT SELECT ON public.system_logs  TO authenticated;

-- service_role backs server-side admin flows (Edge Functions / admin scripts)
-- and bypasses RLS, but it still needs ordinary SQL privileges.
GRANT SELECT, INSERT ON public.users TO service_role;
GRANT INSERT ON public.system_logs TO service_role;

-- No INSERT/UPDATE/DELETE granted on any table to authenticated.
-- All mutations go through SECURITY DEFINER functions only.

-- ─────────────────────────────────────────────
-- ANON ROLE — deny everything
-- ─────────────────────────────────────────────
REVOKE ALL ON public.users        FROM anon;
REVOKE ALL ON public.subjects     FROM anon;
REVOKE ALL ON public.sessions     FROM anon;
REVOKE ALL ON public.attendance   FROM anon;
REVOKE ALL ON public.system_logs  FROM anon;
REVOKE ALL ON public.student_devices FROM anon;
REVOKE ALL ON public.login_sessions  FROM anon;

-- ─────────────────────────────────────────────
-- PUBLIC FUNCTION GRANTS
-- PostgreSQL grants EXECUTE to PUBLIC by default for new functions.
-- We must explicitly REVOKE from PUBLIC (which covers anon) first,
-- then GRANT only to authenticated.  Unauthenticated callers must
-- never reach these RPCs — denial at privilege level is the first gate;
-- the null-caller checks inside each function body are the safety net.
-- ─────────────────────────────────────────────

-- Revoke default PUBLIC execute before granting selectively
REVOKE EXECUTE ON FUNCTION public.create_user(UUID, TEXT, public.user_role, UUID)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_rotating_hash(UUID)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_attendance(TEXT)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions()
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_rotating_hash(UUID, INTEGER)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_session_hash(UUID)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stop_session(UUID)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_session_duration(UUID, INTEGER)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_student_device(UUID)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_login_session()
  FROM PUBLIC, anon;

-- Grant only to authenticated
GRANT EXECUTE ON FUNCTION public.create_user(UUID, TEXT, public.user_role, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rotating_hash(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_attendance(TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rotating_hash(UUID, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_session_hash(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_session(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_session_duration(UUID, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_student_device(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_login_session()
  TO authenticated;

-- ─────────────────────────────────────────────
-- PRIVATE FUNCTION GRANTS (RLS policy helpers)
--
-- These functions are SECURITY DEFINER (run as postgres) so they
-- cannot leak cross-user data. However, authenticated users MUST
-- have EXECUTE permission on them because RLS policies call them
-- on every table access. Without EXECUTE the entire table SELECT
-- returns "permission denied for function" (error 42501).
--
-- Only authenticated gets EXECUTE. anon gets nothing.
-- ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.get_caller_user()         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_role()       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_subject_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_id()         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.request_headers()         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_request_ip()      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_request_user_agent() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.get_caller_user()         TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_role()       TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_subject_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_id()         TO authenticated;
GRANT EXECUTE ON FUNCTION private.request_headers()         TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_request_ip()      TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_request_user_agent() TO authenticated;
