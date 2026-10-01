-- ==============================================================================
-- Migration: 20260926003100_add_unique_constraints_and_nid_rpc.sql
-- Description:
--   1. Ensure unique email on public.users
--   2. Ensure unique username, email, and national_id for pending join_requests
--   3. Create check_national_id_exists RPC for registration pre-validation
-- ==============================================================================

-- 1. Create check_national_id_exists RPC
CREATE OR REPLACE FUNCTION public.check_national_id_exists(p_national_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_national_id IS NULL OR trim(p_national_id) = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE trim(national_id) = trim(p_national_id)
    UNION
    SELECT 1 FROM public.join_requests WHERE trim(national_id) = trim(p_national_id) AND status = 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_national_id_exists(text) TO anon, authenticated;

-- 2. Add partial unique index on email for public.users
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
  ON public.users (lower(trim(email))) 
  WHERE (email IS NOT NULL AND email <> '');

-- 3. Add partial unique indexes for pending join_requests so duplicates are physically impossible at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_pending_username 
  ON public.join_requests (lower(trim(username))) 
  WHERE (status = 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_pending_email 
  ON public.join_requests (lower(trim(email))) 
  WHERE (status = 'pending' AND email IS NOT NULL AND email <> '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_pending_national_id 
  ON public.join_requests (trim(national_id)) 
  WHERE (status = 'pending' AND national_id IS NOT NULL AND national_id <> '');

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
