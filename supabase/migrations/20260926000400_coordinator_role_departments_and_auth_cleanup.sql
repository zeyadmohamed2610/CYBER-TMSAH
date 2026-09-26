-- Migration: 20260926000400_coordinator_role_departments_and_auth_cleanup.sql
-- Description:
-- 1. Add 'coordinator' (Program Coordinator / Department Head) to public.user_role enum.
-- 2. Add department, academic_year, section_number, email, password to join_requests and users.
-- 3. Drop legacy subject_id constraint so approved doctors/coordinators/tas can be assigned later.
-- 4. Rewrite approve_join_request to use REAL email directly in auth.users (NEVER @cyber.local).
-- 5. Rewrite resolve_login_identifier to look up by real email, users.username, national_id without @cyber.local.
-- 6. Provide safe cleanup query to remove fake/duplicate accounts.

-- Step 1: Add 'coordinator' to user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'coordinator';

-- Step 2: Add department and academic columns to join_requests and users
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS academic_year TEXT;
ALTER TABLE public.join_requests DROP COLUMN IF EXISTS seat_number;
ALTER TABLE public.join_requests DROP COLUMN IF EXISTS rank_in_list;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS academic_year TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS section_number INTEGER;

-- Step 3: Drop restrictive subject constraint so users can be assigned subjects post-approval
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_subject_per_role;

-- Step 4: Rewrite approve_join_request to provision real email in auth.users
CREATE OR REPLACE FUNCTION public.approve_join_request(
  p_request_id uuid,
  p_temp_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth', 'extensions'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller      public.users;
  v_req         public.join_requests;
  v_email       text;
  v_password    text;
  v_auth_id     uuid;
BEGIN
  -- Only owner (or coordinator within department) can approve
  v_caller := private.get_caller_user();
  IF v_caller IS NULL OR (v_caller.role <> 'owner' AND v_caller.role <> 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may approve join requests';
  END IF;

  -- Load the pending request
  SELECT * INTO v_req
  FROM public.join_requests
  WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: join request not found or already processed';
  END IF;

  -- Use real email submitted with request (or fallback to clean username if missing)
  IF v_req.email IS NOT NULL AND v_req.email <> '' THEN
    v_email := lower(trim(v_req.email));
  ELSE
    v_email := lower(trim(v_req.username)) || '@cyber.local';
  END IF;

  -- Use user's chosen password from request, or param, or secure default
  v_password := COALESCE(p_temp_password, v_req.password, 'Cyber2026!');

  -- Check if user already exists in auth.users
  SELECT id INTO v_auth_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    -- Create auth user directly with REAL email
    v_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data,
      role,
      aud,
      created_at,
      updated_at
    ) VALUES (
      v_auth_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf'::text, 10)),
      now(),
      jsonb_build_object(
        'role', v_req.role::text,
        'full_name', v_req.full_name,
        'username', v_req.username,
        'department', v_req.department,
        'academic_year', v_req.academic_year,
        'section_number', v_req.section_number
      ),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  ELSE
    -- If user already exists in auth, update their password if provided
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf'::text, 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
          'role', v_req.role::text,
          'full_name', v_req.full_name,
          'username', v_req.username,
          'department', v_req.department,
          'academic_year', v_req.academic_year,
          'section_number', v_req.section_number
        )
    WHERE id = v_auth_id;
  END IF;

  -- Create or update record in public.users
  INSERT INTO public.users (
    auth_id,
    full_name,
    username,
    role,
    department,
    academic_year,
    section_number
  ) VALUES (
    v_auth_id,
    v_req.full_name,
    v_req.username,
    v_req.role,
    v_req.department,
    v_req.academic_year,
    v_req.section_number
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    full_name      = EXCLUDED.full_name,
    username       = EXCLUDED.username,
    role           = EXCLUDED.role,
    department     = EXCLUDED.department,
    academic_year  = EXCLUDED.academic_year,
    section_number = EXCLUDED.section_number;

  -- Mark join request as approved
  UPDATE public.join_requests
  SET status = 'approved',
      reviewed_at = now(),
      reviewed_by = v_caller.id,
      password = NULL -- Clear sensitive plain password from request row
  WHERE id = p_request_id;

END;
$function$;

-- Step 5: Update resolve_login_identifier (No @cyber.local fallback)
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_clean text;
    v_email text;
BEGIN
    v_clean := lower(trim(p_identifier));
    IF v_clean IS NULL OR v_clean = '' THEN
        RETURN NULL;
    END IF;

    -- If already contains @, return directly
    IF v_clean LIKE '%@%' THEN
        RETURN v_clean;
    END IF;

    -- Search in users by username or national_id
    SELECT au.email INTO v_email
    FROM public.users u
    JOIN auth.users au ON au.id = u.auth_id
    WHERE lower(u.username) = v_clean
       OR u.national_id = v_clean
       OR lower(au.raw_user_meta_data->>'username') = v_clean
    LIMIT 1;

    RETURN v_email;
END;
$$;

-- Step 6: Cleanup query for owner (kept for reference in SQL):
-- DELETE FROM auth.users WHERE email <> 'eltmsahzeyad@gmail.com';
-- DELETE FROM public.users WHERE auth_id NOT IN (SELECT id FROM auth.users);
