-- ==============================================================================
-- Migration: 20260926003200_final_fix_400_errors_and_rls.sql
-- Description:
--   Fix all remaining 400 Bad Request errors by:
--   1. Ensuring national_id column exists on public.users
--   2. Creating missing check_email_exists and check_username_exists RPCs
--   3. Fixing the users SELECT RLS to allow ANY authenticated user to read
--      their OWN row by auth_id (no role requirement)
--   4. Fixing join_requests INSERT policy to allow anon users to submit requests
--   5. Ensuring sessions SELECT allows authenticated users to query active sessions
--   6. Granting necessary permissions on all helper RPCs
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ensure national_id column exists on public.users
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS national_id TEXT;

-- Add format check constraint for national_id on users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_national_id;
ALTER TABLE public.users ADD CONSTRAINT chk_users_national_id
  CHECK (national_id IS NULL OR national_id ~ '^\d{14}$');

-- Add unique index on national_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_national_id_unique
  ON public.users (trim(national_id))
  WHERE (national_id IS NOT NULL AND national_id <> '');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create check_email_exists RPC (used in join form pre-validation)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE lower(trim(email)) = lower(trim(p_email))
    UNION
    SELECT 1 FROM public.join_requests
      WHERE lower(trim(email)) = lower(trim(p_email)) AND status = 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Create check_username_exists RPC (used in join form pre-validation)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_username_exists(p_username text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_username IS NULL OR trim(p_username) = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE lower(trim(username)) = lower(trim(p_username))
    UNION
    SELECT 1 FROM public.join_requests
      WHERE lower(trim(username)) = lower(trim(p_username)) AND status = 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_username_exists(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fix public.users SELECT RLS policy
--    ANY authenticated user must be able to read THEIR OWN row by auth_id.
--    This is the primary cause of 400 Bad Request on:
--    GET /rest/v1/users?select=role,full_name,department&auth_id=eq.{uuid}
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_consolidated" ON public.users;

CREATE POLICY "users_select_consolidated" ON public.users
  FOR SELECT TO authenticated
  USING (
    -- Every authenticated user can always read their OWN row
    auth_id = (SELECT auth.uid())
    -- Owners and coordinators can read ALL rows
    OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
    -- Doctors and TAs can read student rows
    OR (
      role = 'student'
      AND (
        (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('doctor', 'ta')
        OR (SELECT private.get_current_user_role()) IN ('doctor', 'ta')
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Fix join_requests INSERT policy to allow anon users (unauthenticated) to
--    submit join requests. This is needed for the public registration form.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "join_requests_anon_insert" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_public_insert" ON public.join_requests;

CREATE POLICY "join_requests_anon_insert" ON public.join_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Fix sessions SELECT policy to allow students to read ACTIVE sessions
--    (sessions that are not yet expired) so they can submit attendance.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sessions_select_consolidated" ON public.sessions;

CREATE POLICY "sessions_select_consolidated" ON public.sessions
  FOR SELECT TO authenticated
  USING (
    -- Staff can read all sessions
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator', 'doctor', 'ta')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator', 'doctor', 'ta')
    -- Students can only read active (non-expired) sessions to submit attendance
    OR (expires_at > now())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Ensure private.get_caller_user is robust and handles missing users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.get_caller_user()
RETURNS public.users
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = private, public, auth, pg_temp
AS $$
DECLARE
  v_user public.users;
BEGIN
  -- First try by auth_id
  SELECT * INTO v_user
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  -- Fallback: try by email from JWT
  IF NOT FOUND AND (auth.jwt() ->> 'email') IS NOT NULL THEN
    SELECT * INTO v_user
    FROM public.users
    WHERE lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
    LIMIT 1;
  END IF;

  RETURN v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION private.get_caller_user() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Ensure private.get_current_user_role is robust
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.get_current_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  -- 1. Try public.users by auth_id (SECURITY DEFINER bypasses RLS)
  SELECT role::text INTO v_role
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  -- 2. Fallback to JWT app_metadata
  IF v_role IS NULL THEN
    v_role := COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role'
    );
  END IF;

  -- 3. Fallback: match by email
  IF v_role IS NULL AND (auth.jwt() ->> 'email') IS NOT NULL THEN
    SELECT role::text INTO v_role
    FROM public.users
    WHERE lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
    LIMIT 1;
  END IF;

  RETURN v_role::public.user_role;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION private.get_current_user_role() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Ensure all existing check_* RPCs have correct grants
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_national_id_exists'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.check_national_id_exists(text) TO anon, authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'resolve_login_identifier'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
