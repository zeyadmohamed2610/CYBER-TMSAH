-- ============================================================
-- Fix: GRANT INSERT + DELETE on public.users to authenticated
-- Root cause: authenticated role had only SELECT + UPDATE,
-- causing 403 Forbidden on any INSERT/DELETE from the client.
-- ============================================================

GRANT INSERT, DELETE ON public.users TO authenticated;

-- ============================================================
-- Rebuild RLS policies to use JWT-first pattern.
-- Checking auth.jwt() -> 'user_metadata' ->> 'role' first
-- avoids recursive queries inside INSERT/WITH CHECK clauses
-- that would cause policy evaluation to stall or fail.
-- ============================================================

-- Owner: full access to all rows
DROP POLICY IF EXISTS ""owner_all_users"" ON public.users;
CREATE POLICY ""owner_all_users"" ON public.users
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'owner'
    OR (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'owner'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'owner'
    OR (SELECT role FROM public.users WHERE auth_id = auth.uid()) = 'owner'
  );

-- Doctor: can see own row + all students
DROP POLICY IF EXISTS ""doctor_own_users"" ON public.users;
CREATE POLICY ""doctor_own_users"" ON public.users
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'doctor'
    AND (auth_id = auth.uid() OR role = 'student')
  );

-- TA: can see own row + all students
DROP POLICY IF EXISTS ""ta_own_users"" ON public.users;
CREATE POLICY ""ta_own_users"" ON public.users
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'ta'
    AND (auth_id = auth.uid() OR role = 'student')
  );

-- Student: can only see own row
DROP POLICY IF EXISTS ""student_own_users"" ON public.users;
CREATE POLICY ""student_own_users"" ON public.users
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student'
    AND auth_id = auth.uid()
  );

-- Self-read: fallback policy so any authenticated user can read their own row
DROP POLICY IF EXISTS ""self_read"" ON public.users;
CREATE POLICY ""self_read"" ON public.users
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid());
