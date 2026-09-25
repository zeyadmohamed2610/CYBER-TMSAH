-- ================================================================
-- DEFINITIVE FIX: Eliminate ALL infinite recursion in RLS policies
-- 
-- ROOT CAUSE: private.current_user_role() / current_user_id() /
-- current_user_subject_id() all do SELECT FROM public.users.
-- When called inside an RLS policy on ANY table, Postgres evaluates
-- the policy for public.users too (since it has RLS ON), causing
-- infinite recursion: policy -> function -> users -> policy -> ...
--
-- FIX: Add SET row_security = off to all private helper functions.
-- As SECURITY DEFINER functions, they run as postgres (superuser),
-- and row_security=off makes them bypass RLS entirely on their
-- internal queries. The JWT-first approach also reduces DB hits.
-- ================================================================

-- 1. current_user_role: JWT-first, DB fallback with RLS bypassed
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET row_security = off
AS $$
DECLARE
  v_role user_role;
  v_jwt_role text;
BEGIN
  -- JWT check first (cheapest - no DB round-trip)
  v_jwt_role := (auth.jwt() -> 'user_metadata' ->> 'role');
  IF v_jwt_role IS NOT NULL THEN
    BEGIN
      RETURN v_jwt_role::user_role;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  -- DB fallback (RLS bypassed via row_security=off + SECURITY DEFINER)
  SELECT role INTO v_role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  RETURN v_role;
END;
$$;

-- 2. current_user_id: RLS bypassed
CREATE OR REPLACE FUNCTION private.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET row_security = off
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- 3. current_user_subject_id: RLS bypassed
CREATE OR REPLACE FUNCTION private.current_user_subject_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET row_security = off
AS $$
  SELECT subject_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- 4. get_caller_user: RLS bypassed
CREATE OR REPLACE FUNCTION private.get_caller_user()
RETURNS public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET row_security = off
AS $$
  SELECT * FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;
