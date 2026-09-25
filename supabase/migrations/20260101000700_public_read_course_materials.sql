-- ===========================================================
-- Migration 7: Allow public (anon) read on course_materials
-- The /materials page is publicly accessible — students must
-- be able to see subject cards without being logged in.
-- ===========================================================

-- 1. Grant SELECT privilege at the table level for the anon role.
--    (Without this, PostgreSQL denies the request before RLS even runs.)
GRANT SELECT ON public.course_materials TO anon;

-- 2. Add an RLS policy that permits the anonymous role to read all rows.
--    The existing RLS policies only cover authenticated roles (owner, doctor,
--    student, ta). anon has no matching policy → all rows are hidden.
DROP POLICY IF EXISTS "anon_read_course_materials" ON public.course_materials;

CREATE POLICY "anon_read_course_materials"
  ON public.course_materials
  FOR SELECT
  TO anon
  USING (true);
