-- ===========================================================
-- 20260101000400_audit_fixes.sql
-- University Attendance System — Audit fixes (ordered: 6 of 6)
-- Applies missing grants, indexes, and policies from audit_fixes.sql
-- ===========================================================

-- ─────────────────────────────────────────────
-- 1. TABLE GRANTS — lectures (missing from permissions.sql)
-- ─────────────────────────────────────────────
GRANT SELECT, INSERT ON public.lectures TO authenticated;
GRANT ALL ON public.lectures TO service_role;

-- ─────────────────────────────────────────────
-- 2. RLS POLICIES — lectures INSERT for doctor/ta
--    (create_lecture RPC is SECURITY DEFINER and bypasses RLS,
--    but direct table access may be needed for future features)
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "owner_insert_lectures" ON public.lectures;
CREATE POLICY "owner_insert_lectures"
  ON public.lectures
  FOR INSERT
  WITH CHECK (private.current_user_role() = 'owner');

DROP POLICY IF EXISTS "doctor_insert_lectures" ON public.lectures;
CREATE POLICY "doctor_insert_lectures"
  ON public.lectures
  FOR INSERT
  WITH CHECK (private.current_user_role() = 'doctor');

DROP POLICY IF EXISTS "ta_insert_lectures" ON public.lectures;
CREATE POLICY "ta_insert_lectures"
  ON public.lectures
  FOR INSERT
  WITH CHECK (private.current_user_role() = 'ta');

-- ─────────────────────────────────────────────
-- 3. ADDITIONAL FUNCTION GRANTS
-- ─────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.gps_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gps_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.refresh_session_hash(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_session_hash(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.stop_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stop_session(UUID) TO authenticated;

-- ─────────────────────────────────────────────
-- 4. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────
-- Composite index for attendance queries filtered by lecture via session
CREATE INDEX IF NOT EXISTS idx_attendance_lecture_id
  ON public.attendance (session_id) INCLUDE (student_id);

-- Short code lookup (partial index for non-null values)
CREATE INDEX IF NOT EXISTS idx_sessions_short_code_lookup
  ON public.sessions (short_code)
  WHERE short_code IS NOT NULL;

-- ─────────────────────────────────────────────
-- 5. VERIFY UNIQUE CONSTRAINT ON LECTURES
--    (already in initial_schema.sql but ensuring it exists)
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_lectures_subject_date_title'
      AND conrelid = 'public.lectures'::regclass
  ) THEN
    ALTER TABLE public.lectures
    ADD CONSTRAINT uq_lectures_subject_date_title
    UNIQUE (subject_id, lecture_date, title);
  END IF;
END $$;