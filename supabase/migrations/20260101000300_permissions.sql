-- ===========================================================
-- 20260101000300_permissions.sql
-- University Attendance System — privileges (ordered: 5 of 5)
--
-- Revokes default PUBLIC execute on every function, then grants
-- EXECUTE only to the canonical signatures that actually exist
-- (no stale/legacy overloads).  Anonymous gets nothing; all
-- authenticated access is gated by RLS on top.
-- ===========================================================

-- ─────────────────────────────────────────────
-- SCHEMA PRIVILEGES
-- ─────────────────────────────────────────────
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA private TO service_role;

-- ─────────────────────────────────────────────
-- STRIP EVERYTHING FROM PUBLIC & anon FIRST
-- (Postgres grants EXECUTE on new functions to PUBLIC by default)
-- ─────────────────────────────────────────────
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA private FROM anon;

-- ─────────────────────────────────────────────
-- TABLE GRANTS — authenticated (read-only at the table level;
-- writes go through SECURITY DEFINER RPCs only)
-- ─────────────────────────────────────────────
GRANT SELECT ON
  public.users,
  public.subjects,
  public.sessions,
  public.attendance,
  public.lectures,
  public.course_materials,
  public.student_devices,
  public.login_sessions,
  public.system_logs
  TO authenticated;

-- device_locks is written directly by the frontend (scoped per
-- account by its RLS policy), so it needs full DML for authenticated.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_locks TO authenticated;

-- service_role backs Edge Functions / admin scripts (bypasses RLS,
-- but still needs privileges).  Broad read/write/admin.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA private TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role;

-- ─────────────────────────────────────────────
-- FUNCTION GRANTS — authenticated (canonical signatures only)
-- ─────────────────────────────────────────────

-- create_user
REVOKE EXECUTE ON FUNCTION public.create_user(UUID, TEXT, public.user_role, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user(UUID, TEXT, public.user_role, UUID) TO authenticated;

-- generate_rotating_hash  (single 7-param signature)
REVOKE EXECUTE ON FUNCTION public.generate_rotating_hash(UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_rotating_hash(UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, UUID, TEXT) TO authenticated;

-- submit_attendance  (single 4-param signature)
REVOKE EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- session lifecycle
REVOKE EXECUTE ON FUNCTION public.refresh_session_hash(UUID)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stop_session(UUID)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_session_duration(UUID, INTEGER)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_session_expiry(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_session_duration(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_session_hash(UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_session(UUID)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_session_duration(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_session_expiry(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_duration(UUID, INTEGER) TO authenticated;

-- maintenance / logging
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_login_session()       FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_login_session()        TO authenticated;

-- device management
REVOKE EXECUTE ON FUNCTION public.delete_student_device(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_student_device(UUID) TO authenticated;

-- lecture management
REVOKE EXECUTE ON FUNCTION public.fetch_lectures(UUID)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_lecture(UUID, TEXT)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_lecture_attendees(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.end_lecture(UUID)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_lecture(UUID)        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_lectures(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_lecture(UUID, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lecture_attendees(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_lecture(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_lecture(UUID)        TO authenticated;

-- audit + admin
REVOKE EXECUTE ON FUNCTION public.clear_system_logs()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_by_id(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_manual_attendance(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_user(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_system_logs()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_manual_attendance(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user(UUID, TEXT, TEXT, UUID) TO authenticated;

-- public helper used by submit_attendance / external callers
REVOKE EXECUTE ON FUNCTION public.gps_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gps_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ─────────────────────────────────────────────
-- PRIVATE HELPER GRANTS
-- RLS policies call these on every table access for authenticated
-- users, so authenticated MUST have EXECUTE on them.
-- ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.get_caller_user()           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_role()         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_subject_id()   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_id()           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.request_headers()           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_request_ip()        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_request_user_agent() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.get_caller_user()          TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_role()        TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_subject_id()  TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_id()          TO authenticated;
GRANT EXECUTE ON FUNCTION private.request_headers()          TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_request_ip()       TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_request_user_agent() TO authenticated;
