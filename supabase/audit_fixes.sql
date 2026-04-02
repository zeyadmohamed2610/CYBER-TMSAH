-- ===========================================================
-- COMPREHENSIVE AUDIT REPORT - System Attendance
-- Generated: 2026-04-03
-- ===========================================================

-- ===========================================================
-- CRITICAL ISSUES - MUST FIX
-- ===========================================================

-- 1. MISSING TABLE: device_locks
-- The code references 'device_locks' table but it doesn't exist in schema
-- Used by: DeviceLockPanel.tsx, AttendanceStudentPage.tsx, useDeviceLock.ts

CREATE TABLE IF NOT EXISTS public.device_locks (
  student_auth_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_label TEXT,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_locks_student ON public.device_locks (student_auth_id);

-- Enable RLS and grant access
ALTER TABLE public.device_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_device_locks" ON public.device_locks;
CREATE POLICY "owner_all_device_locks" ON public.device_locks FOR ALL USING (true);

GRANT SELECT, INSERT, DELETE ON public.device_locks TO authenticated;
REVOKE ALL ON public.device_locks FROM anon;


-- ===========================================================
-- 2. MISSING GRANT: lectures table
-- ===========================================================

GRANT SELECT, INSERT ON public.lectures TO authenticated;
GRANT ALL ON public.lectures TO service_role;


-- ===========================================================
-- 3. MISSING RLS POLICY: lectures for INSERT/UPDATE
-- ===========================================================

DROP POLICY IF EXISTS "owner_insert_lectures" ON public.lectures;
CREATE POLICY "owner_insert_lectures" ON public.lectures FOR INSERT WITH CHECK (private.current_user_role() = 'owner');

DROP POLICY IF EXISTS "doctor_insert_lectures" ON public.lectures;
CREATE POLICY "doctor_insert_lectures" ON public.lectures FOR INSERT WITH CHECK (private.current_user_role() = 'doctor');


-- ===========================================================
-- 4. MISSING FUNCTION GRANTS
-- ===========================================================

GRANT EXECUTE ON FUNCTION public.gps_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_session_hash(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_session(UUID) TO authenticated;


-- ===========================================================
-- RECOMMENDATIONS
-- ===========================================================

-- 5. Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_lecture_id ON public.attendance (session_id) INCLUDE (student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_short_code_lookup ON public.sessions (short_code) WHERE short_code IS NOT NULL;

-- 6. Add unique constraint on lectures (subject_id, lecture_date, title)
ALTER TABLE public.lectures ADD CONSTRAINT uq_lectures_subject_date_title UNIQUE (subject_id, lecture_date, title);

-- 7. Add trigger for automatic session cleanup (optional - uses pg_cron)
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT public.cleanup_expired_sessions();');


-- ===========================================================
-- DATA VALIDATION QUERIES
-- ===========================================================

-- Check for orphan sessions (sessions without valid subject)
-- SELECT s.id, s.subject_id FROM public.sessions s LEFT JOIN public.subjects sub ON s.subject_id = sub.id WHERE sub.id IS NULL;

-- Check for duplicate short_codes (should be unique)
-- SELECT short_code, COUNT(*) as cnt FROM public.sessions WHERE short_code IS NOT NULL GROUP BY short_code HAVING COUNT(*) > 1;

-- Check for expired but still marked active sessions
-- SELECT id, expires_at FROM public.sessions WHERE expires_at < now() AND expires_at > now() - interval '1 hour';