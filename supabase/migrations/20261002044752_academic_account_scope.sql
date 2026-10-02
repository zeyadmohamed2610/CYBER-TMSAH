-- Authorize management using linked profiles, with department boundaries.
CREATE OR REPLACE FUNCTION private.can_manage_subject(p_subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.subjects s ON s.id=p_subject_id
 WHERE u.auth_id=auth.uid() AND (u.role='owner' OR
 (u.role='coordinator' AND u.department IS NOT DISTINCT FROM s.department) OR
 (u.role IN ('doctor','ta') AND (u.subject_id=s.id OR EXISTS
 (SELECT 1 FROM public.user_subjects us WHERE us.user_id=u.id AND us.subject_id=s.id)))));
$$;
CREATE OR REPLACE FUNCTION private.read_user_subjects(p_user_id uuid)
RETURNS TABLE(subject_id uuid,subject_name text,department text,assigned_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller public.users; target public.users;
BEGIN
 caller := private.get_caller_user();
 SELECT * INTO target FROM public.users WHERE id=p_user_id;
 IF auth.uid() IS NULL OR caller.id IS NULL OR NOT
 (caller.id=p_user_id OR caller.role='owner' OR (caller.role='coordinator' AND caller.department IS NOT DISTINCT FROM target.department)) THEN
 RAISE EXCEPTION 'permission_denied'; END IF;
 RETURN QUERY SELECT s.id,s.name,s.department,us.assigned_at FROM public.user_subjects us
 JOIN public.subjects s ON s.id=us.subject_id WHERE us.user_id=p_user_id ORDER BY s.name;
END $$;
REVOKE ALL ON FUNCTION private.read_user_subjects(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.read_user_subjects(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_user_subjects(p_user_id uuid)
RETURNS TABLE(subject_id uuid,subject_name text,department text,assigned_at timestamptz)
LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT * FROM private.read_user_subjects(p_user_id) $$;
REVOKE ALL ON FUNCTION public.get_user_subjects(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_user_subjects(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.write_user_subjects(p_user_id uuid,p_subject_ids uuid[])
RETURNS SETOF public.user_subjects LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller public.users; target public.users;
BEGIN
 caller := private.get_caller_user(); SELECT * INTO target FROM public.users WHERE id=p_user_id;
 IF auth.uid() IS NULL OR caller.role IS NULL OR caller.role NOT IN ('owner','coordinator') OR target.role NOT IN ('doctor','ta','coordinator') THEN RAISE EXCEPTION 'permission_denied'; END IF;
 IF caller.role='coordinator' AND (target.role='coordinator' OR target.department IS DISTINCT FROM caller.department) THEN RAISE EXCEPTION 'permission_denied'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_subject_ids) sid WHERE NOT COALESCE(private.can_manage_subject(sid),false)) THEN RAISE EXCEPTION 'permission_denied: subject outside department'; END IF;
 DELETE FROM public.user_subjects WHERE user_id=p_user_id;
 INSERT INTO public.user_subjects(user_id,subject_id) SELECT p_user_id,sid FROM (SELECT DISTINCT unnest(p_subject_ids) sid) ids WHERE sid IS NOT NULL;
 UPDATE public.users SET subject_id=(SELECT us.subject_id FROM public.user_subjects us WHERE us.user_id=p_user_id ORDER BY us.subject_id LIMIT 1) WHERE id=p_user_id;
 INSERT INTO public.system_logs(actor_id,action) VALUES(caller.id,'assign_user_subjects: '||p_user_id::text);
 RETURN QUERY SELECT * FROM public.user_subjects WHERE user_id=p_user_id;
END $$;
REVOKE ALL ON FUNCTION private.write_user_subjects(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.write_user_subjects(uuid,uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.assign_user_subjects(p_user_id uuid,p_subject_ids uuid[])
RETURNS SETOF public.user_subjects LANGUAGE sql SET search_path = '' AS $$ SELECT * FROM private.write_user_subjects(p_user_id,p_subject_ids) $$;
REVOKE ALL ON FUNCTION public.assign_user_subjects(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_user_subjects(uuid,uuid[]) TO authenticated;

CREATE POLICY users_read_department_boundary ON public.users AS RESTRICTIVE FOR SELECT TO authenticated USING
 (auth_id=auth.uid() OR private.get_current_user_role()='owner' OR
 (private.get_current_user_role()='coordinator' AND department=(private.get_caller_user()).department) OR
 (role='student' AND EXISTS(SELECT 1 FROM public.subjects s WHERE private.can_manage_subject(s.id)
 AND (s.department IS NULL OR s.department=users.department) AND (s.academic_year IS NULL OR s.academic_year=users.academic_year))));

DO $$ DECLARE item record; definition text;
BEGIN
 FOR item IN SELECT oid FROM pg_proc WHERE pronamespace='private'::regnamespace AND proname IN ('attendance_create_lecture','attendance_generate_rotating_hash') LOOP
 definition := pg_get_functiondef(item.oid);
 definition := replace(definition,'v_caller.subject_id IS DISTINCT FROM p_subject_id','NOT private.can_manage_subject(p_subject_id)');
 EXECUTE definition;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.admin_create_user(p_full_name text, p_username text, p_email text, p_password text, p_role text, p_department text DEFAULT 'cybersecurity'::text, p_academic_year text DEFAULT NULL::text, p_section_number integer DEFAULT NULL::integer, p_subject_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_caller         public.users;
  v_caller_role    text;
  v_clean_email    text;
  v_clean_username text;
  v_auth_id        uuid;
  v_new_user_id    uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permission_denied'; END IF;
  -- Authenticate caller
  v_caller := private.get_caller_user();
  v_caller_role := v_caller.role::text;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners and coordinators can create accounts';
  END IF;

  IF v_caller_role='coordinator' AND (p_role IN ('owner','coordinator') OR p_department IS DISTINCT FROM v_caller.department) THEN RAISE EXCEPTION 'permission_denied: outside department'; END IF;
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
$function$
;
CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id uuid, p_temp_password text DEFAULT NULL::text, p_auth_id uuid DEFAULT NULL::uuid)
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
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permission_denied'; END IF;
  -- Authenticate caller
  v_caller := private.get_caller_user();
  v_caller_role := v_caller.role::text;

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

  IF v_caller_role='coordinator' AND (v_req.role IN ('owner','coordinator') OR v_req.department IS DISTINCT FROM v_caller.department) THEN RAISE EXCEPTION 'permission_denied: outside department'; END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE lower(email)=lower(v_req.email) OR auth_id=p_auth_id) THEN RAISE EXCEPTION 'conflict: account already exists'; END IF;
  IF p_auth_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_auth_id AND lower(email)=lower(v_req.email)) THEN RAISE EXCEPTION 'permission_denied: account email mismatch'; END IF;
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
$function$
;
CREATE OR REPLACE FUNCTION public.delete_user_by_id(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_target      public.users;
  v_auth_id     uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permission_denied'; END IF;
  v_caller := private.get_caller_user();
  v_caller_role := v_caller.role::text;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may delete users';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  -- Protection: Nobody can delete themselves or delete an owner unless they are an owner
  IF v_caller.id = p_user_id THEN
    RAISE EXCEPTION 'validation_error: users cannot delete their own account';
  END IF;

  IF v_target.role = 'owner' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: coordinators cannot delete owner accounts';
  END IF;

  IF v_caller_role='coordinator' AND (v_target.role IN ('owner','coordinator') OR v_target.department IS DISTINCT FROM v_caller.department) THEN RAISE EXCEPTION 'permission_denied: outside department'; END IF;
  v_auth_id := v_target.auth_id;

  -- Delete public.users record
  DELETE FROM public.users WHERE id = p_user_id;

  -- Cascade delete auth.users record if exists
  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('delete_user_by_id: deleted user %s (%s, role: %s)', v_target.full_name, p_user_id, v_target.role)
  );
END;
$function$
;
