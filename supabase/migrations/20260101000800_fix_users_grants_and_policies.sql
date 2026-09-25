-- ============================================================
-- Fix 403 + Infinite Recursion on public.users
-- 
-- Problems fixed:
-- 1. authenticated had no INSERT/DELETE -> 403 Forbidden
-- 2. Policies had subqueries back to public.users -> infinite recursion
-- 
-- Solution: JWT-only policies (no subqueries on same table)
-- ============================================================

-- Step 1: Grant all needed privileges
GRANT INSERT, DELETE ON public.users TO authenticated;

-- Step 2: Remove all old policies
DROP POLICY IF EXISTS "owner_all_users"   ON public.users;
DROP POLICY IF EXISTS "owner_update_self" ON public.users;
DROP POLICY IF EXISTS "doctor_own_users"  ON public.users;
DROP POLICY IF EXISTS "ta_own_users"      ON public.users;
DROP POLICY IF EXISTS "student_own_users" ON public.users;
DROP POLICY IF EXISTS "self_read"         ON public.users;
DROP POLICY IF EXISTS "self_update"       ON public.users;

-- Step 3: Rebuild policies using JWT ONLY (no subqueries)

-- Owner: full access to all rows
CREATE POLICY "owner_all_users" ON public.users
  FOR ALL TO authenticated
  USING  ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'owner');

-- Doctor: can see own row + all students
CREATE POLICY "doctor_own_users" ON public.users
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'doctor'
    AND (auth_id = auth.uid() OR role = 'student')
  );

-- TA: can see own row + all students
CREATE POLICY "ta_own_users" ON public.users
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'ta'
    AND (auth_id = auth.uid() OR role = 'student')
  );

-- Student: own row only
CREATE POLICY "student_own_users" ON public.users
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student'
    AND auth_id = auth.uid()
  );

-- Self-read: fallback so any authenticated user can read their own row
CREATE POLICY "self_read" ON public.users
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid());

-- Self-update: any authenticated user can update their own row
CREATE POLICY "self_update" ON public.users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());
