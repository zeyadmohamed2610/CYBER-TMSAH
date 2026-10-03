-- Keep privileged implementations outside the exposed API schema.
BEGIN;
CREATE OR REPLACE FUNCTION private.account_admin_create_user(p_full_name text, p_username text, p_email text, p_password text, p_role text, p_department text DEFAULT 'cybersecurity'::text, p_academic_year text DEFAULT NULL::text, p_section_number integer DEFAULT NULL::integer, p_subject_id uuid DEFAULT NULL::uuid)
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
REVOKE ALL ON FUNCTION private.account_admin_create_user(text,text,text,text,text,text,text,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_admin_create_user(text,text,text,text,text,text,text,integer,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_create_user(p_full_name text, p_username text, p_email text, p_password text, p_role text, p_department text DEFAULT 'cybersecurity'::text, p_academic_year text DEFAULT NULL::text, p_section_number integer DEFAULT NULL::integer, p_subject_id uuid DEFAULT NULL::uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT private.account_admin_create_user(p_full_name,p_username,p_email,p_password,p_role,p_department,p_academic_year,p_section_number,p_subject_id); $body$;
CREATE OR REPLACE FUNCTION private.account_approve_join_request(p_request_id uuid, p_temp_password text DEFAULT NULL::text, p_auth_id uuid DEFAULT NULL::uuid)
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

  SELECT * INTO v_req FROM public.join_requests WHERE id = p_request_id FOR UPDATE;
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
  IF p_temp_password IS NOT NULL THEN
    IF length(p_temp_password)<8 OR octet_length(p_temp_password)>72 THEN RAISE EXCEPTION 'invalid_password_length'; END IF;
    v_password:=extensions.crypt(p_temp_password,extensions.gen_salt('bf',10));
  ELSE v_password:=v_req.password; END IF;
  IF v_password IS NULL THEN RAISE EXCEPTION 'password_required'; END IF;

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
      v_password,
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
REVOKE ALL ON FUNCTION private.account_approve_join_request(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_approve_join_request(uuid,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id uuid, p_temp_password text DEFAULT NULL::text, p_auth_id uuid DEFAULT NULL::uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT private.account_approve_join_request(p_request_id,p_temp_password,p_auth_id); $body$;
CREATE OR REPLACE FUNCTION private.account_delete_user_by_id(p_user_id uuid)
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
REVOKE ALL ON FUNCTION private.account_delete_user_by_id(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_delete_user_by_id(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.delete_user_by_id(p_user_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT private.account_delete_user_by_id(p_user_id); $body$;
CREATE OR REPLACE FUNCTION private.account_lock_student_device(p_fingerprint text, p_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_existing TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT device_fingerprint INTO v_existing
  FROM public.device_locks
  WHERE student_auth_id = v_uid;

  IF v_existing IS NOT NULL THEN
    IF v_existing = p_fingerprint THEN
      RETURN jsonb_build_object('success', true, 'message', 'Device already locked');
    ELSE
      RAISE EXCEPTION 'الحساب مقترن بالفعل بجهاز آخر. يرجى مراجعة إدارة الكلية.';
    END IF;
  END IF;

  INSERT INTO public.device_locks (student_auth_id, device_fingerprint, device_label, locked_at)
  VALUES (v_uid, p_fingerprint, COALESCE(p_label, 'جهاز معتمد'), now())
  ON CONFLICT (student_auth_id) 
  DO UPDATE SET 
    device_fingerprint = EXCLUDED.device_fingerprint,
    device_label = EXCLUDED.device_label,
    locked_at = now()
  WHERE public.device_locks.device_fingerprint = p_fingerprint;

  -- Sync with student_devices if table exists
  BEGIN
    INSERT INTO public.student_devices (student_id, device_fingerprint, bound_at, last_seen_at)
    VALUES (v_uid, p_fingerprint, now(), now())
    ON CONFLICT (device_fingerprint) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if student_devices table schema differs
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$function$
;
REVOKE ALL ON FUNCTION private.account_lock_student_device(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_lock_student_device(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.lock_student_device(p_fingerprint text, p_label text DEFAULT NULL::text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT private.account_lock_student_device(p_fingerprint,p_label); $body$;
CREATE OR REPLACE FUNCTION private.account_submit_attendance(p_hash text, p_device_fingerprint text DEFAULT NULL::text, p_student_latitude double precision DEFAULT NULL::double precision, p_student_longitude double precision DEFAULT NULL::double precision)
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'extensions'
AS $function$
DECLARE
  v_caller            public.users;
  v_session           public.sessions;
  v_record            public.attendance;
  v_fp                TEXT;
  v_ip                TEXT;
  v_recent            INTEGER;
  v_distance          DOUBLE PRECISION;
  v_window            BIGINT;
  v_gps_verified      BOOLEAN := FALSE;
  v_existing_auth     UUID;
  v_existing_fp       TEXT;
BEGIN
  -- 1. Identify and authenticate caller
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  -- 2. Anti-spam rate limiting (maximum 10 attempts per minute)
  SELECT COUNT(*) INTO v_recent
  FROM public.system_logs
  WHERE actor_id = v_caller.id
    AND action LIKE 'submit_attendance:%'
    AND created_at > now() - INTERVAL '1 minute';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'rate_limited: too many submission attempts, please wait';
  END IF;

  -- 3. Validate attendance hash
  IF p_hash IS NULL OR length(trim(p_hash)) = 0 THEN
    RAISE EXCEPTION 'validation_error: attendance hash cannot be empty';
  END IF;

  -- 4. Derive device fingerprint (fallback to SHA256 of UA + IP if not provided)
  v_fp := trim(COALESCE(p_device_fingerprint, ''));
  IF v_fp = '' THEN
    v_fp := encode(
      digest(
        COALESCE(private.current_request_user_agent(), '') || '|' ||
        COALESCE(private.current_request_ip(), ''),
        'sha256'
      ),
      'hex'
    );
  END IF;

  v_ip := private.current_request_ip();
  v_window := EXTRACT(EPOCH FROM now())::bigint / 10;

  -- 5. Validate session and rolling TOTP token / short_code
  SELECT * INTO v_session
  FROM public.sessions
  WHERE expires_at > now()
    AND (
      trim(p_hash) = public.generate_totp(rotating_hash, v_window)
      OR
      trim(p_hash) = public.generate_totp(rotating_hash, v_window - 1)
      OR
      trim(p_hash) = short_code
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired: attendance hash is invalid or has expired';
  END IF;

  -- 6. GPS Geofence validation
  IF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
     AND p_student_latitude IS NOT NULL AND p_student_longitude IS NOT NULL THEN
    v_distance := public.gps_distance_meters(
      v_session.latitude, v_session.longitude,
      p_student_latitude, p_student_longitude
    );
    IF v_distance > COALESCE(v_session.radius_meters, 50) THEN
      RAISE EXCEPTION 'location_denied: you are %.0f meters away from the session location (max: %m)',
        v_distance, COALESCE(v_session.radius_meters, 50);
    END IF;
    v_gps_verified := TRUE;
  ELSIF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
        AND (p_student_latitude IS NULL OR p_student_longitude IS NULL) THEN
    RAISE EXCEPTION 'location_denied: this session requires GPS verification, please enable location.';
  END IF;

  -- 7. Device Binding with Transaction-Scoped Advisory Locking
  -- Acquire an exclusive advisory transaction lock scoped to this specific student auth ID.
  -- This guarantees strict serialization for concurrent submissions by the same student,
  -- completely eliminating race conditions on initial binding without table-wide locks.
  IF v_caller.auth_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_caller.auth_id::text));

    -- Check if another student has already bound this device
    SELECT student_auth_id INTO v_existing_auth
    FROM public.device_locks
    WHERE device_fingerprint = v_fp
    LIMIT 1;

    IF v_existing_auth IS NOT NULL AND v_existing_auth <> v_caller.auth_id THEN
      RAISE EXCEPTION 'device_conflict: this device is registered to another student account';
    END IF;

    -- Check existing device binding for this student
    SELECT device_fingerprint INTO v_existing_fp
    FROM public.device_locks
    WHERE student_auth_id = v_caller.auth_id;

    IF v_existing_fp IS NOT NULL THEN
      -- Invariant: bound device cannot be changed without administrative reset
      IF v_existing_fp IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION 'device_mismatch: this account is already bound to another device. Contact administrator to reset device binding.';
      END IF;
      -- Same device: refresh lock timestamp
      UPDATE public.device_locks
      SET locked_at = now()
      WHERE student_auth_id = v_caller.auth_id;
    ELSE
      -- First submission: atomically bind device
      INSERT INTO public.device_locks (student_auth_id, device_fingerprint, device_label, locked_at)
      VALUES (v_caller.auth_id, v_fp, 'جهاز معتمد', now());
    END IF;
  END IF;

  -- Also synchronize legacy student_devices table if present
  BEGIN
    INSERT INTO public.student_devices (student_id, device_fingerprint, ip_address, bound_at, last_seen_at)
    VALUES (v_caller.id, v_fp, v_ip, now(), now())
    ON CONFLICT (student_id) DO UPDATE
      SET last_seen_at = now(),
          ip_address = EXCLUDED.ip_address
      WHERE public.student_devices.device_fingerprint = v_fp;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 8. Prevent duplicate attendance in the same session
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'already_recorded: your attendance has already been recorded for this session';
  END IF;

  -- 9. Insert attendance record (incorporating device_fingerprint & metadata)
  INSERT INTO public.attendance (
    student_id,
    session_id,
    device_fingerprint,
    student_latitude,
    student_longitude,
    metadata
  )
  VALUES (
    v_caller.id,
    v_session.id,
    v_fp,
    p_student_latitude,
    p_student_longitude,
    jsonb_build_object(
      'ip', v_ip,
      'gps_verified', v_gps_verified,
      'distance_meters', CASE WHEN v_gps_verified THEN v_distance ELSE NULL END,
      'user_agent', private.current_request_user_agent(),
      'submitted_at', now()
    )
  )
  RETURNING * INTO v_record;

  -- 10. System log audit trail
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format('submit_attendance: success student %s in session %s (device bound, GPS: %s)',
      v_caller.id, v_session.id, CASE WHEN v_gps_verified THEN 'yes' ELSE 'no' END)
  );

  RETURN v_record;
END;
$function$
;
REVOKE ALL ON FUNCTION private.account_submit_attendance(text,text,double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_submit_attendance(text,text,double precision,double precision) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_attendance(p_hash text, p_device_fingerprint text DEFAULT NULL::text, p_student_latitude double precision DEFAULT NULL::double precision, p_student_longitude double precision DEFAULT NULL::double precision) RETURNS attendance LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT private.account_submit_attendance(p_hash,p_device_fingerprint,p_student_latitude,p_student_longitude); $body$;
CREATE OR REPLACE FUNCTION private.account_submit_attendance(p_hash text, p_device_fingerprint text DEFAULT NULL::text, p_student_latitude double precision DEFAULT NULL::double precision, p_student_longitude double precision DEFAULT NULL::double precision, p_biometric_credential_id text DEFAULT NULL::text)
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'extensions'
AS $function$
DECLARE
  v_caller            public.users;
  v_session           public.sessions;
  v_record            public.attendance;
  v_fp                TEXT;
  v_ip                TEXT;
  v_recent            INTEGER;
  v_distance          DOUBLE PRECISION;
  v_window            BIGINT;
  v_gps_verified      BOOLEAN := FALSE;
  v_existing_auth     UUID;
  v_existing_fp       TEXT;
  v_biometric_ok      BOOLEAN;
  v_verified_credential TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permission_denied: login required'; END IF;
  -- 1. Identify and authenticate caller
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  -- 2. Anti-spam rate limiting (maximum 10 attempts per minute)
  SELECT COUNT(*) INTO v_recent
  FROM public.system_logs
  WHERE actor_id = v_caller.id
    AND action LIKE 'submit_attendance:%'
    AND created_at > now() - INTERVAL '1 minute';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'rate_limited: too many submission attempts, please wait';
  END IF;

  -- 3. Validate attendance hash
  IF p_hash IS NULL OR length(trim(p_hash)) = 0 THEN
    RAISE EXCEPTION 'validation_error: attendance hash cannot be empty';
  END IF;

  -- 4. Derive device fingerprint (fallback to SHA256 of UA + IP if not provided)
  v_fp := trim(COALESCE(p_device_fingerprint, ''));
  IF v_fp = '' THEN
    v_fp := encode(
      digest(
        COALESCE(private.current_request_user_agent(), '') || '|' ||
        COALESCE(private.current_request_ip(), ''),
        'sha256'
      ),
      'hex'
    );
  END IF;

  v_ip := private.current_request_ip();
  v_window := EXTRACT(EPOCH FROM now())::bigint / 10;

  -- 5. Validate session and rolling TOTP token / short_code
  SELECT * INTO v_session
  FROM public.sessions
  WHERE expires_at > now()
    AND (
      trim(p_hash) = public.generate_totp(rotating_hash, v_window)
      OR
      trim(p_hash) = public.generate_totp(rotating_hash, v_window - 1)
      OR
      trim(p_hash) = short_code
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired: attendance hash is invalid or has expired';
  END IF;

  -- 6. GPS Geofence validation
  IF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
     AND p_student_latitude IS NOT NULL AND p_student_longitude IS NOT NULL THEN
    v_distance := public.gps_distance_meters(
      v_session.latitude, v_session.longitude,
      p_student_latitude, p_student_longitude
    );
    IF v_distance > COALESCE(v_session.radius_meters, 50) THEN
      RAISE EXCEPTION 'location_denied: you are %.0f meters away from the session location (max: %m)',
        v_distance, COALESCE(v_session.radius_meters, 50);
    END IF;
    v_gps_verified := TRUE;
  ELSIF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
        AND (p_student_latitude IS NULL OR p_student_longitude IS NULL) THEN
    RAISE EXCEPTION 'location_denied: this session requires GPS verification, please enable location.';
  END IF;

  -- 7. Device Binding with Transaction-Scoped Advisory Locking
  IF v_caller.auth_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_caller.auth_id::text));

    SELECT student_auth_id INTO v_existing_auth
    FROM public.device_locks
    WHERE device_fingerprint = v_fp
    LIMIT 1;

    IF v_existing_auth IS NOT NULL AND v_existing_auth <> v_caller.auth_id THEN
      RAISE EXCEPTION 'device_conflict: this device is registered to another student account';
    END IF;

    SELECT device_fingerprint INTO v_existing_fp
    FROM public.device_locks
    WHERE student_auth_id = v_caller.auth_id;

    IF v_existing_fp IS NOT NULL THEN
      IF v_existing_fp IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION 'device_mismatch: this account is already bound to another device. Contact administrator to reset device binding.';
      END IF;
      UPDATE public.device_locks
      SET locked_at = now()
      WHERE student_auth_id = v_caller.auth_id;
    ELSE
      INSERT INTO public.device_locks (student_auth_id, device_fingerprint, device_label, locked_at)
      VALUES (v_caller.auth_id, v_fp, 'جهاز معتمد', now());
    END IF;
  END IF;

  -- Synchronize legacy student_devices table
  BEGIN
    INSERT INTO public.student_devices (student_id, device_fingerprint, ip_address, bound_at, last_seen_at)
    VALUES (v_caller.id, v_fp, v_ip, now(), now())
    ON CONFLICT (student_id) DO UPDATE
      SET last_seen_at = now(),
          ip_address = EXCLUDED.ip_address
      WHERE public.student_devices.device_fingerprint = v_fp;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 8. Prevent duplicate attendance in the same session
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'already_recorded: your attendance has already been recorded for this session';
  END IF;

  -- 9. Determine biometric status
  -- The argument carries an opaque receipt, never a client-asserted credential ID.
  DELETE FROM public.attendance_biometric_proofs
  WHERE id::text = p_biometric_credential_id
    AND auth_id = auth.uid()
    AND attendance_hash = trim(p_hash)
    AND device_fingerprint = v_fp
    AND expires_at > now()
  RETURNING credential_id INTO v_verified_credential;
  IF v_verified_credential IS NULL THEN
    RAISE EXCEPTION 'biometric_required: verify attendance with a fresh server-validated assertion';
  END IF;
  v_biometric_ok := TRUE;

  -- 10. Insert attendance record with biometric_credential_id
  INSERT INTO public.attendance (
    student_id,
    session_id,
    device_fingerprint,
    student_latitude,
    student_longitude,
    biometric_credential_id,
    metadata
  )
  VALUES (
    v_caller.id,
    v_session.id,
    v_fp,
    p_student_latitude,
    p_student_longitude,
    v_verified_credential,
    jsonb_build_object(
      'ip', v_ip,
      'gps_verified', v_gps_verified,
      'distance_meters', CASE WHEN v_gps_verified THEN v_distance ELSE NULL END,
      'user_agent', private.current_request_user_agent(),
      'biometric_verified', v_biometric_ok,
      'biometric_credential_id', v_verified_credential,
      'submitted_at', now()
    )
  )
  RETURNING * INTO v_record;

  -- 11. System log audit trail (includes biometric status)
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format(
      'submit_attendance: success student %s in session %s (device bound, GPS: %s, biometric: %s)',
      v_caller.id,
      v_session.id,
      CASE WHEN v_gps_verified THEN 'yes' ELSE 'no' END,
      CASE WHEN v_biometric_ok THEN 'yes' ELSE 'no' END
    )
  );

  RETURN v_record;
END;
$function$
;
REVOKE ALL ON FUNCTION private.account_submit_attendance(text,text,double precision,double precision,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_submit_attendance(text,text,double precision,double precision,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.submit_attendance(p_hash text, p_device_fingerprint text DEFAULT NULL::text, p_student_latitude double precision DEFAULT NULL::double precision, p_student_longitude double precision DEFAULT NULL::double precision, p_biometric_credential_id text DEFAULT NULL::text) RETURNS attendance LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT private.account_submit_attendance(p_hash,p_device_fingerprint,p_student_latitude,p_student_longitude,p_biometric_credential_id); $body$;
COMMIT;
