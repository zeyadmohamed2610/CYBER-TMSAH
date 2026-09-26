-- Migration: Error reports table, reporting RPC, and direct admin_create_user RPC
-- Enables the "إصلاحات" (Fixes) tab for owner and consistent manual user creation.

-- 1. Error Reports Table
CREATE TABLE IF NOT EXISTS public.error_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name      text,
  user_role      text,
  department     text,
  academic_year  text,
  section_number integer,
  page_url       text,
  error_message  text NOT NULL,
  error_stack    text,
  status         text NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved'
  created_at     timestamptz DEFAULT now(),
  resolved_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_error_reports_status ON public.error_reports (status);
CREATE INDEX IF NOT EXISTS idx_error_reports_created ON public.error_reports (created_at DESC);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.error_reports TO postgres, service_role;
GRANT INSERT ON TABLE public.error_reports TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.error_reports TO authenticated;

DROP POLICY IF EXISTS "error_reports_insert_policy" ON public.error_reports;
CREATE POLICY "error_reports_insert_policy" ON public.error_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "error_reports_select_policy" ON public.error_reports;
CREATE POLICY "error_reports_select_policy" ON public.error_reports
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

DROP POLICY IF EXISTS "error_reports_update_policy" ON public.error_reports;
CREATE POLICY "error_reports_update_policy" ON public.error_reports
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

DROP POLICY IF EXISTS "error_reports_delete_policy" ON public.error_reports;
CREATE POLICY "error_reports_delete_policy" ON public.error_reports
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- 2. Report Issue RPC Function (Safe for anon & authenticated)
CREATE OR REPLACE FUNCTION public.report_system_error(
  p_error_message text,
  p_error_stack text DEFAULT NULL,
  p_page_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text := 'مستخدم غير مسجل';
  v_role text := 'غير محدد';
  v_dept text := NULL;
  v_year text := NULL;
  v_section integer := NULL;
  v_report_id uuid;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT full_name, role::text, department, academic_year, section_number
    INTO v_name, v_role, v_dept, v_year, v_section
    FROM public.users
    WHERE auth_id = v_user_id
    LIMIT 1;
  END IF;

  INSERT INTO public.error_reports (
    user_id,
    user_name,
    user_role,
    department,
    academic_year,
    section_number,
    page_url,
    error_message,
    error_stack,
    status
  ) VALUES (
    v_user_id,
    COALESCE(v_name, 'مستخدم مسجل'),
    COALESCE(v_role, 'مستخدم'),
    v_dept,
    v_year,
    v_section,
    p_page_url,
    COALESCE(p_error_message, 'حدث خطأ غير متوقع'),
    p_error_stack,
    'pending'
  )
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_system_error(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.report_system_error(text, text, text) TO anon, authenticated;

-- 3. Add email column to public.users if not present
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (lower(email));

-- Backfill email from auth.users where possible
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.auth_id = a.id AND (u.email IS NULL OR u.email = '');

-- 4. Secure admin_create_user RPC function
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_full_name text,
  p_username text,
  p_email text,
  p_password text,
  p_role text,
  p_department text,
  p_academic_year text DEFAULT NULL,
  p_section_number integer DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private, extensions
AS $$
DECLARE
  v_caller public.users;
  v_auth_id uuid;
  v_new_user_id uuid;
  v_clean_email text;
  v_clean_username text;
BEGIN
  -- Verify caller is owner or coordinator
  v_caller := private.get_caller_user();
  IF v_caller IS NULL OR (v_caller.role <> 'owner' AND v_caller.role <> 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators can create users manually';
  END IF;

  -- Validate mandatory fields
  IF p_full_name IS NULL OR length(trim(p_full_name)) < 3 THEN
    RAISE EXCEPTION 'invalid_argument: full_name must be at least 3 characters';
  END IF;

  IF p_username IS NULL OR length(trim(p_username)) < 3 THEN
    RAISE EXCEPTION 'invalid_argument: username must be at least 3 characters';
  END IF;

  IF p_email IS NULL OR p_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'invalid_argument: valid email is required';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'invalid_argument: password must be at least 6 characters';
  END IF;

  IF p_role NOT IN ('coordinator', 'doctor', 'ta', 'student') THEN
    RAISE EXCEPTION 'invalid_argument: invalid user role';
  END IF;

  v_clean_email := lower(trim(p_email));
  v_clean_username := lower(trim(p_username));

  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE lower(username) = v_clean_username) THEN
    RAISE EXCEPTION 'duplicate_username: username already exists';
  END IF;

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'duplicate_email: email already exists';
  END IF;

  -- Create auth user
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
    v_clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf'::text, 10)),
    now(),
    jsonb_build_object(
      'role', p_role,
      'full_name', trim(p_full_name),
      'username', v_clean_username,
      'department', p_department,
      'academic_year', p_academic_year,
      'section_number', p_section_number
    ),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- Insert into public.users
  INSERT INTO public.users (
    auth_id,
    full_name,
    username,
    email,
    role,
    department,
    academic_year,
    section_number,
    subject_id,
    created_at
  ) VALUES (
    v_auth_id,
    trim(p_full_name),
    v_clean_username,
    v_clean_email,
    p_role::public.user_role,
    p_department,
    p_academic_year,
    p_section_number,
    p_subject_id,
    now()
  )
  RETURNING id INTO v_new_user_id;

  RETURN v_new_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, text, text, text, integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text, text, integer, uuid) TO authenticated;
