-- ==============================================================================
-- Migration: 20260926003000_add_national_id_to_join_requests.sql
-- Description:
--   Add national_id to join_requests for student registration.
--   Enforces 14-digit format check and syncs to public.users on approval.
-- ==============================================================================

-- 1. Add national_id column to join_requests
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS national_id TEXT;

-- 2. Add format check constraint
ALTER TABLE public.join_requests DROP CONSTRAINT IF EXISTS chk_join_requests_national_id;
ALTER TABLE public.join_requests ADD CONSTRAINT chk_join_requests_national_id 
  CHECK (national_id IS NULL OR national_id ~ '^\d{14}$');

-- 3. Add index
CREATE INDEX IF NOT EXISTS idx_join_requests_national_id ON public.join_requests (national_id);

-- 4. Update approve_join_request to carry national_id into users & auth metadata
CREATE OR REPLACE FUNCTION public.approve_join_request(
  p_request_id uuid,
  p_temp_password text DEFAULT NULL::text,
  p_auth_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
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
        'section_number', v_req.section_number,
        'national_id', v_req.national_id
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
          'section_number', v_req.section_number,
          'national_id', v_req.national_id
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
    section_number,
    national_id
  ) VALUES (
    v_auth_id,
    v_req.full_name,
    v_clean_username,
    v_email,
    v_req.role,
    v_req.department,
    v_req.academic_year,
    v_req.section_number,
    v_req.national_id
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    full_name      = EXCLUDED.full_name,
    username       = EXCLUDED.username,
    email          = EXCLUDED.email,
    role           = EXCLUDED.role,
    department     = EXCLUDED.department,
    academic_year  = EXCLUDED.academic_year,
    section_number = EXCLUDED.section_number,
    national_id    = COALESCE(EXCLUDED.national_id, public.users.national_id)
  RETURNING id INTO v_new_user_id;

  -- Mark join request as approved AND purge plaintext password in the same transaction
  UPDATE public.join_requests
  SET status       = 'approved',
      reviewed_at  = now(),
      reviewed_by  = v_caller.id,
      password     = NULL
  WHERE id = p_request_id;

  -- Log action
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id, format('approve_join_request: approved request %s for %s (%s)', p_request_id, v_req.full_name, v_email));

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'auth_id', v_auth_id,
    'email', v_email,
    'username', v_clean_username,
    'national_id', v_req.national_id
  );
END;
$function$;

-- 5. Update resolve_login_identifier to seamlessly support username, email, and 14-digit national_id
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
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
       OR lower(COALESCE(au.raw_user_meta_data->>'national_id', '')) = v_clean
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
       OR lower(COALESCE(raw_user_meta_data->>'national_id', '')) = v_clean
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_email IS NOT NULL THEN
        RETURN v_email;
    END IF;

    -- 3. Fallback to standard local domain
    RETURN v_clean || '@cyber.local';
END;
$function$;

-- 6. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
