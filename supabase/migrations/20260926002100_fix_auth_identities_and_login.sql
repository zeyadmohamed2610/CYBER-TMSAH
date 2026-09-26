-- ==============================================================================
-- Migration: 20260926002100_fix_auth_identities_and_login.sql
-- Description:
--   1. Backfill auth.identities for all users in auth.users missing an identity
--      (Fixes 500 Internal Server Error on /auth/v1/token?grant_type=password)
--   2. Update admin_create_user to always insert into auth.identities
--   3. Update approve_join_request to always insert into auth.identities
--   4. Enhance resolve_login_identifier to check public.users.username directly
--   5. Ensure all auth.users have email_confirmed_at set
-- ==============================================================================

-- ── 1. Ensure email confirmation fields are set ──────────────────────────────
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    is_sso_user = false
WHERE email_confirmed_at IS NULL;

-- ── 2. Backfill auth.identities for any user missing email identity ───────────
INSERT INTO auth.identities (
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', lower(u.email)),
  'email',
  u.id::text,
  now(),
  now(),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i
  WHERE i.user_id = u.id AND i.provider = 'email'
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ── 3. Enhanced resolve_login_identifier ──────────────────────────────────────
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
    -- Strip leading @ if user pasted @username
    IF v_clean LIKE '@%' THEN
        v_clean := substr(v_clean, 2);
    END IF;

    IF v_clean IS NULL OR v_clean = '' THEN
        RETURN NULL;
    END IF;

    -- If already contains @, return as is
    IF v_clean LIKE '%@%' THEN
        RETURN v_clean;
    END IF;

    -- 1. Search in public.users by username, national_id, or email
    SELECT COALESCE(u.email, au.email) INTO v_email
    FROM public.users u
    LEFT JOIN auth.users au ON au.id = u.auth_id
    WHERE lower(trim(COALESCE(u.username, ''))) = v_clean
       OR lower(trim(COALESCE(u.national_id, ''))) = v_clean
       OR lower(trim(COALESCE(u.email, ''))) = v_clean
       OR lower(COALESCE(au.raw_user_meta_data->>'username', '')) = v_clean
       OR lower(COALESCE(au.raw_user_meta_data->>'seat_number', '')) = v_clean
    ORDER BY u.created_at DESC
    LIMIT 1;

    IF v_email IS NOT NULL AND v_email <> '' THEN
        RETURN v_email;
    END IF;

    -- 2. Search directly in auth.users by email prefix or raw metadata
    SELECT email INTO v_email
    FROM auth.users
    WHERE lower(email) = v_clean || '@cyber.local'
       OR lower(COALESCE(raw_user_meta_data->>'username', '')) = v_clean
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_email IS NOT NULL THEN
        RETURN v_email;
    END IF;

    -- 3. Fallback to standard local domain
    RETURN v_clean || '@cyber.local';
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated;

-- ── 4. Update admin_create_user with auth.identities support ──────────────────
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_full_name      text,
  p_username       text,
  p_email          text,
  p_password       text,
  p_role           text,
  p_department     text DEFAULT 'cybersecurity',
  p_academic_year  text DEFAULT NULL,
  p_section_number integer DEFAULT NULL,
  p_subject_id     uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller         public.users;
  v_caller_role    text;
  v_clean_email    text;
  v_clean_username text;
  v_auth_id        uuid;
  v_new_user_id    uuid;
BEGIN
  -- Authenticate caller
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners and coordinators can create accounts';
  END IF;

  -- Validate inputs
  IF p_full_name IS NULL OR length(trim(p_full_name)) < 3 THEN
    RAISE EXCEPTION 'invalid_argument: full_name must be at least 3 characters';
  END IF;

  IF p_username IS NULL OR length(trim(p_username)) < 3 THEN
    RAISE EXCEPTION 'invalid_argument: username must be at least 3 characters';
  END IF;

  IF p_email IS NULL OR p_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'invalid_argument: a valid email address is required';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'invalid_argument: password must be at least 6 characters';
  END IF;

  IF p_role NOT IN ('coordinator', 'doctor', 'ta', 'student') THEN
    RAISE EXCEPTION 'invalid_argument: invalid user role';
  END IF;

  v_clean_email := lower(trim(p_email));
  v_clean_username := lower(trim(p_username));
  IF v_clean_username LIKE '@%' THEN
    v_clean_username := substr(v_clean_username, 2);
  END IF;

  -- Check if username already exists in public.users
  IF EXISTS (SELECT 1 FROM public.users WHERE lower(trim(username)) = v_clean_username) THEN
    RAISE EXCEPTION 'duplicate_username: username already exists';
  END IF;

  -- Check if email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'duplicate_email: email already exists';
  END IF;

  -- 1. Create auth.users record
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
    is_sso_user,
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
    false,
    now(),
    now()
  );

  -- 2. Create matching auth.identities record (REQUIRED by GoTrue for login)
  INSERT INTO auth.identities (
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_auth_id,
    jsonb_build_object('sub', v_auth_id::text, 'email', v_clean_email),
    'email',
    v_auth_id::text,
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- 3. Insert into public.users
  INSERT INTO public.users (
    auth_id,
    full_name,
    username,
    email,
    role,
    department,
    academic_year,
    section_number,
    subject_id
  ) VALUES (
    v_auth_id,
    trim(p_full_name),
    v_clean_username,
    v_clean_email,
    p_role::public.user_role,
    p_department,
    CASE WHEN p_role = 'student' THEN p_academic_year ELSE NULL END,
    CASE WHEN p_role = 'student' THEN p_section_number ELSE NULL END,
    CASE WHEN p_role IN ('doctor', 'ta', 'coordinator') THEN p_subject_id ELSE NULL END
  )
  RETURNING id INTO v_new_user_id;

  -- Log action
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id, format('admin_create_user: created %s account for %s (%s)', p_role, p_full_name, v_clean_email));

  RETURN v_new_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text, text, integer, uuid) TO authenticated;

-- ── 5. Update approve_join_request with auth.identities support ────────────────
CREATE OR REPLACE FUNCTION public.approve_join_request(
  p_request_id    uuid,
  p_temp_password text DEFAULT NULL::text,
  p_auth_id       uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_req            public.join_requests;
  v_caller         public.users;
  v_caller_role    text;
  v_auth_id        uuid;
  v_new_user_id    uuid;
  v_clean_username text;
  v_email          text;
  v_password       text;
BEGIN
  -- Authenticate caller
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may approve join requests';
  END IF;

  SELECT * INTO v_req FROM public.join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: join request % does not exist', p_request_id;
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_state: request has already been %', v_req.status;
  END IF;

  v_clean_username := lower(trim(v_req.username));
  IF v_clean_username LIKE '@%' THEN
    v_clean_username := substr(v_clean_username, 2);
  END IF;

  v_email := lower(trim(COALESCE(v_req.email, v_clean_username || '@cyber.local')));
  v_password := COALESCE(p_temp_password, v_req.password, 'Student@123456');

  IF p_auth_id IS NOT NULL THEN
    v_auth_id := p_auth_id;
  ELSE
    SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = v_email;
  END IF;

  IF v_auth_id IS NULL THEN
    -- Create auth.users record
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
      is_sso_user,
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
      false,
      now(),
      now()
    );

    -- Create matching auth.identities record
    INSERT INTO auth.identities (
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_auth_id,
      jsonb_build_object('sub', v_auth_id::text, 'email', v_email),
      'email',
      v_auth_id::text,
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  ELSE
    -- Update existing auth credentials
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

    -- Ensure identity exists
    INSERT INTO auth.identities (
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_auth_id,
      jsonb_build_object('sub', v_auth_id::text, 'email', v_email),
      'email',
      v_auth_id::text,
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  END IF;

  -- Create or update public.users
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
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    full_name      = EXCLUDED.full_name,
    username       = EXCLUDED.username,
    email          = EXCLUDED.email,
    role           = EXCLUDED.role,
    department     = EXCLUDED.department,
    academic_year  = EXCLUDED.academic_year,
    section_number = EXCLUDED.section_number
  RETURNING id INTO v_new_user_id;

  -- Mark join request as approved
  UPDATE public.join_requests
  SET status       = 'approved',
      reviewed_at  = now(),
      reviewed_by  = v_caller.id
  WHERE id = p_request_id;

  -- Log action
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id, format('approve_join_request: approved request %s for %s (%s)', p_request_id, v_req.full_name, v_email));

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'auth_id', v_auth_id,
    'email', v_email,
    'username', v_clean_username
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, text, uuid) TO authenticated;
