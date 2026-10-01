-- =============================================================================
-- Migration: 20261001000300_fix_sessions_update_and_prune_indexes.sql
-- Purpose  : 1. Fix rls_policy_always_true on sessions_staff_update policy
--               by ensuring WITH CHECK enforces role authorization instead of (true).
--            2. Prune redundant duplicate and unused non-FK indexes to clean up
--               performance advisor unused_index findings.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Fix sessions_staff_update RLS Policy (Remove WITH CHECK (true))
-- ─────────────────────────────────────────────────────────────────────────────
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
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = (SELECT auth.uid())
        AND role IN ('owner', 'coordinator', 'doctor', 'ta')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Prune redundant duplicate and unused non-foreign-key indexes
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_logs_actor_id;
DROP INDEX IF EXISTS public.idx_system_logs_metadata_gin;
DROP INDEX IF EXISTS public.idx_system_logs_date_range;
DROP INDEX IF EXISTS public.idx_published_schedule_day;
DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_attendance_student_id;
DROP INDEX IF EXISTS public.idx_join_requests_national_id;
DROP INDEX IF EXISTS public.idx_exam_schedules_type;
DROP INDEX IF EXISTS public.idx_exam_schedules_section;
DROP INDEX IF EXISTS public.idx_subjects_department;
DROP INDEX IF EXISTS public.idx_subjects_name;
DROP INDEX IF EXISTS public.idx_sessions_section;
DROP INDEX IF EXISTS public.idx_pw_reset_email;
DROP INDEX IF EXISTS public.idx_audit_logs_identifier;
DROP INDEX IF EXISTS public.idx_logs_created_at;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
DROP INDEX IF EXISTS public.idx_error_reports_created;
DROP INDEX IF EXISTS public.idx_pw_reset_created;
DROP INDEX IF EXISTS public.idx_lectures_subject_date;
DROP INDEX IF EXISTS public.idx_sessions_subject_id;
DROP INDEX IF EXISTS public.idx_attendance_session_id;
DROP INDEX IF EXISTS public.idx_attendance_student_session;
