-- ==============================================================================
-- Migration: 20260926002200_fix_auth_users_token_columns.sql
-- Description:
--   1. Backfill all NOT-NULL string fields in auth.users that GoTrue expects
--      to prevent "500 Internal Server Error: Database error querying schema"
--      (converting NULL to string is unsupported)
--   2. Add a BEFORE INSERT/UPDATE trigger on auth.users to ensure these columns
--      can never be NULL again.
--   3. Update admin_create_user to explicitly provide all required token columns.
--   4. Update approve_join_request to explicitly provide all required token columns.
-- ==============================================================================

-- ── 1. Update all existing auth.users to eliminate NULL in string columns ────
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
  is_sso_user = COALESCE(is_sso_user, false),
  is_anonymous = COALESCE(is_anonymous, false),
  aud = COALESCE(aud, 'authenticated'),
  role = COALESCE(role, 'authenticated'),
  email_confirmed_at = COALESCE(email_confirmed_at, now());

-- ── 2. Ensure auth.identities exists for every user ──────────────────────────
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

-- ── 3. Trigger to guarantee token defaults on auth.users ─────────────────────
CREATE OR REPLACE FUNCTION public.ensure_auth_user_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.confirmation_token := COALESCE(NEW.confirmation_token, '');
  NEW.recovery_token := COALESCE(NEW.recovery_token, '');
  NEW.email_change_token_new := COALESCE(NEW.email_change_token_new, '');
  NEW.email_change := COALESCE(NEW.email_change, '');
  NEW.email_change_token_current := COALESCE(NEW.email_change_token_current, '');
  NEW.phone_change := COALESCE(NEW.phone_change, '');
  NEW.phone_change_token := COALESCE(NEW.phone_change_token, '');
  NEW.reauthentication_token := COALESCE(NEW.reauthentication_token, '');
  NEW.email_change_confirm_status := COALESCE(NEW.email_change_confirm_status, 0);
  NEW.is_sso_user := COALESCE(NEW.is_sso_user, false);
  NEW.is_anonymous := COALESCE(NEW.is_anonymous, false);
  NEW.aud := COALESCE(NEW.aud, 'authenticated');
  NEW.role := COALESCE(NEW.role, 'authenticated');
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_auth_user_defaults ON auth.users;
CREATE TRIGGER trg_ensure_auth_user_defaults
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_auth_user_defaults();

-- ── 4. Update admin_create_user ──────────────────────────────────────────────
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

  -- 1. Create auth.users record with full GoTrue compatibility
  v_auth_id := gen_random_uuid();
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    email_change_confirm_status,
    raw_user_meta_data,
    raw_app_meta_data,
    role,
    aud,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at
  ) VALUES (
    v_auth_id,
    '00000000-0000-0000-0000-000000000000',
    v_clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf'::text, 10)),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
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
    false,
    now(),
    now()
  );

  -- 2. Create matching auth.identities record
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

-- ── 5. Update approve_join_request ───────────────────────────────────────────
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
    -- Create auth.users record with full GoTrue compatibility
    v_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token,
      email_change_confirm_status,
      raw_user_meta_data,
      raw_app_meta_data,
      role,
      aud,
      is_sso_user,
      is_anonymous,
      created_at,
      updated_at
    ) VALUES (
      v_auth_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf'::text, 10)),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      0,
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
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
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
