-- ================================================================
-- Migration: 20260926000900_fix_subjects_write_and_approve_join.sql
-- Fixes:
--   1. subjects table missing INSERT/UPDATE/DELETE RLS policies
--   2. private.get_current_user_role & private.get_caller_user resilience
--   3. approve_join_request function ambiguity and coordinator permission
--   4. reject_join_request coordinator support
--   5. Drop legacy chk_subject_per_role constraints if still present
-- ================================================================

-- ── 1. Enhance private.get_current_user_role ─────────────────────────────────
-- Robustly resolves caller role from public.users OR auth.jwt() metadata
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
  -- 1. Try public.users by auth_id
  SELECT role::text INTO v_role
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  -- 2. Fallback to auth.jwt() metadata
  IF v_role IS NULL THEN
    v_role := COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role'
    );
  END IF;

  -- 3. Fallback to match by email
  IF v_role IS NULL AND (auth.jwt() ->> 'email') IS NOT NULL THEN
    SELECT role::text INTO v_role
    FROM public.users
    WHERE email = (auth.jwt() ->> 'email')
    LIMIT 1;
  END IF;

  RETURN v_role::public.user_role;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION private.get_current_user_role() TO authenticated, anon;

-- Sync private.current_user_role() alias
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
BEGIN
  RETURN private.get_current_user_role();
END;
$$;

GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated, anon;

-- ── 2. Enhance private.get_caller_user ───────────────────────────────────────
-- Finds caller in public.users, or syncs auth_id by email/metadata
CREATE OR REPLACE FUNCTION private.get_caller_user()
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private', 'auth'
SET row_security = off
AS $$
DECLARE
  v_user public.users;
  v_jwt_role text;
  v_email text;
  v_name text;
BEGIN
  -- 1. Match by auth_id directly
  SELECT * INTO v_user
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  IF v_user.id IS NOT NULL THEN
    RETURN v_user;
  END IF;

  -- 2. Match by email in auth.jwt()
  v_email := auth.jwt() ->> 'email';
  IF v_email IS NOT NULL AND v_email <> '' THEN
    SELECT * INTO v_user
    FROM public.users
    WHERE lower(email) = lower(v_email)
    LIMIT 1;

    IF v_user.id IS NOT NULL THEN
      -- Link auth_id so future queries match instantly
      UPDATE public.users SET auth_id = auth.uid() WHERE id = v_user.id;
      v_user.auth_id := auth.uid();
      RETURN v_user;
    END IF;
  END IF;

  -- 3. If still not found, check if caller is an owner/coordinator from JWT metadata
  v_jwt_role := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_jwt_role IS NOT NULL AND auth.uid() IS NOT NULL THEN
    v_name := COALESCE(
      auth.jwt() -> 'user_metadata' ->> 'full_name',
      auth.jwt() -> 'user_metadata' ->> 'name',
      split_part(COALESCE(v_email, 'user@cyber'), '@', 1)
    );

    -- Auto-provision user record in public.users
    INSERT INTO public.users (
      auth_id,
      full_name,
      username,
      email,
      role
    ) VALUES (
      auth.uid(),
      v_name,
      lower(regexp_replace(v_name, '[^a-zA-Z0-9_]', '', 'g')),
      v_email,
      v_jwt_role::public.user_role
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      role = EXCLUDED.role,
      email = COALESCE(public.users.email, EXCLUDED.email)
    RETURNING * INTO v_user;

    RETURN v_user;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION private.get_caller_user() TO authenticated;

-- ── 3. Fix subjects Table RLS and Columns ────────────────────────────────────
-- Add department column if not exists
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- Enable RLS
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Drop all old policies
DROP POLICY IF EXISTS "doctor_own_subject"  ON public.subjects;
DROP POLICY IF EXISTS "owner_all_subjects"  ON public.subjects;
DROP POLICY IF EXISTS "student_own_subject" ON public.subjects;
DROP POLICY IF EXISTS "ta_own_subject"      ON public.subjects;
DROP POLICY IF EXISTS "subjects_select_consolidated" ON public.subjects;
DROP POLICY IF EXISTS "subjects_insert_consolidated" ON public.subjects;
DROP POLICY IF EXISTS "subjects_update_consolidated" ON public.subjects;
DROP POLICY IF EXISTS "subjects_delete_consolidated" ON public.subjects;

-- 3.1 SELECT Policy: anyone (anon & authenticated) can view subjects
CREATE POLICY "subjects_select_consolidated" ON public.subjects
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3.2 INSERT Policy: owner & coordinator
CREATE POLICY "subjects_insert_consolidated" ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT auth.jwt() -> 'user_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- 3.3 UPDATE Policy: owner & coordinator
CREATE POLICY "subjects_update_consolidated" ON public.subjects
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT auth.jwt() -> 'user_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT auth.jwt() -> 'user_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- 3.4 DELETE Policy: owner & coordinator
CREATE POLICY "subjects_delete_consolidated" ON public.subjects
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT auth.jwt() -> 'user_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- Ensure table grants
GRANT SELECT ON public.subjects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;

-- Ensure constraint is removed so doctors/coordinators can be assigned subjects
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_subject_per_role;

-- ── 4. Unified & Definitive approve_join_request RPC ─────────────────────────
-- Drop all legacy overloads to avoid "Could not choose a best candidate function"
DROP FUNCTION IF EXISTS public.approve_join_request(uuid);
DROP FUNCTION IF EXISTS public.approve_join_request(uuid, text);
DROP FUNCTION IF EXISTS public.approve_join_request(uuid, uuid);
DROP FUNCTION IF EXISTS public.approve_join_request(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.approve_join_request(
  p_request_id uuid,
  p_temp_password text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth', 'extensions'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller          public.users;
  v_caller_role     text;
  v_req             public.join_requests;
  v_email           text;
  v_password        text;
  v_auth_id         uuid;
  v_clean_username  text;
  v_existing_user_id uuid;
BEGIN
  -- 1. Check permissions
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR (v_caller_role <> 'owner' AND v_caller_role <> 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may approve join requests (role: %)', COALESCE(v_caller_role, 'none');
  END IF;

  -- 2. Load the pending request
  SELECT * INTO v_req
  FROM public.join_requests
  WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: join request not found or already processed';
  END IF;

  -- 3. Determine clean username and email
  v_clean_username := lower(trim(v_req.username));
  IF v_req.email IS NOT NULL AND trim(v_req.email) <> '' THEN
    v_email := lower(trim(v_req.email));
  ELSE
    v_email := v_clean_username || '@cyber.local';
  END IF;

  -- 4. Determine Password
  v_password := COALESCE(
    NULLIF(trim(p_temp_password), ''),
    NULLIF(trim(v_req.password), ''),
    'Cyber' || v_clean_username || '2026!'
  );

  -- 5. Look for existing auth user by email OR username metadata
  SELECT id INTO v_auth_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    SELECT id INTO v_auth_id
    FROM auth.users
    WHERE lower(raw_user_meta_data->>'username') = v_clean_username
    LIMIT 1;
  END IF;

  IF v_auth_id IS NULL THEN
    -- Create auth user directly
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
        'username', v_clean_username,
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
    -- Update existing auth user credentials
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf'::text, 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
          'role', v_req.role::text,
          'full_name', v_req.full_name,
          'username', v_clean_username,
          'department', v_req.department,
          'academic_year', v_req.academic_year,
          'section_number', v_req.section_number
        ),
        updated_at = now()
    WHERE id = v_auth_id;
  END IF;

  -- 6. Insert or Update public.users
  SELECT id INTO v_existing_user_id
  FROM public.users
  WHERE lower(username) = v_clean_username
     OR auth_id = v_auth_id
  LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    UPDATE public.users
    SET auth_id        = v_auth_id,
        full_name      = v_req.full_name,
        username       = v_clean_username,
        email          = v_email,
        role           = v_req.role,
        department     = COALESCE(v_req.department, public.users.department),
        academic_year  = COALESCE(v_req.academic_year, public.users.academic_year),
        section_number = COALESCE(v_req.section_number, public.users.section_number)
    WHERE id = v_existing_user_id;
  ELSE
    INSERT INTO public.users (
      auth_id,
      full_name,
      username,
      email,
      role,
      department,
      academic_year,
      section_number
    ) VALUES (
      v_auth_id,
      v_req.full_name,
      v_clean_username,
      v_email,
      v_req.role,
      v_req.department,
      v_req.academic_year,
      v_req.section_number
    );
  END IF;

  -- 7. Mark join request as approved
  UPDATE public.join_requests
  SET status = 'approved',
      reviewed_at = now(),
      reviewed_by = COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
      password = NULL
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'auth_id', v_auth_id,
    'username', v_clean_username,
    'email', v_email,
    'role', v_req.role::text
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, text) TO authenticated, anon;

-- ── 5. Unified reject_join_request RPC ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.reject_join_request(uuid);
DROP FUNCTION IF EXISTS public.reject_join_request(uuid, text);

CREATE OR REPLACE FUNCTION public.reject_join_request(
  p_request_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR (v_caller_role <> 'owner' AND v_caller_role <> 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may reject join requests';
  END IF;

  UPDATE public.join_requests
  SET status = 'rejected',
      rejection_note = p_note,
      reviewed_at = now(),
      reviewed_by = COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1))
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: join request not found or not pending';
  END IF;

  RETURN jsonb_build_object('success', true, 'id', p_request_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reject_join_request(uuid, text) TO authenticated, anon;
