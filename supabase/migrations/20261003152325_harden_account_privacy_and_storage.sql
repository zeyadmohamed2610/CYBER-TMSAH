-- Close confirmed cross-account and cross-department access paths.
BEGIN;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
DROP POLICY IF EXISTS "Users can update own avatar" ON public.users;
DROP INDEX IF EXISTS public.idx_webauthn_cred_id;
ALTER POLICY "Authenticated Upload avatars" ON storage.objects WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
ALTER POLICY "Authenticated Update avatars" ON storage.objects USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text) WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
ALTER POLICY "Authenticated Delete avatars" ON storage.objects USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY exam_department_write_boundary ON public.exam_schedules AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT private.get_current_user_role())='owner' OR ((SELECT private.get_current_user_role())='coordinator' AND department=(SELECT (private.get_caller_user()).department)) OR ((SELECT private.get_current_user_role()) NOT IN ('owner','coordinator')))
WITH CHECK ((SELECT private.get_current_user_role())='owner' OR ((SELECT private.get_current_user_role())='coordinator' AND department=(SELECT (private.get_caller_user()).department)));
-- The legacy table has no department column; scoped editors use academic_schedule_entries.
CREATE POLICY legacy_schedule_owner_writes ON public.published_schedule AS RESTRICTIVE FOR ALL TO authenticated
USING (true) WITH CHECK ((SELECT private.get_current_user_role())='owner');
CREATE POLICY legacy_schedule_owner_delete ON public.published_schedule AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT private.get_current_user_role())='owner');
CREATE POLICY assignment_subject_boundary ON public.user_subjects AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT private.get_current_user_role())='owner' OR user_id=(SELECT (private.get_caller_user()).id) OR ((SELECT private.get_current_user_role())='coordinator' AND EXISTS(SELECT 1 FROM public.subjects s WHERE s.id=user_subjects.subject_id AND s.department=(SELECT (private.get_caller_user()).department))))
WITH CHECK ((SELECT private.get_current_user_role())='owner' OR ((SELECT private.get_current_user_role())='coordinator' AND EXISTS(SELECT 1 FROM public.subjects s WHERE s.id=user_subjects.subject_id AND s.department=(SELECT (private.get_caller_user()).department))));
CREATE OR REPLACE FUNCTION private.can_manage_account_email(p_email text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.users caller WHERE caller.auth_id=(SELECT auth.uid()) AND (caller.role='owner' OR (caller.role='coordinator' AND EXISTS(SELECT 1 FROM public.users target WHERE lower(target.email)=lower(p_email) AND target.department=caller.department AND target.role NOT IN ('owner','coordinator')))));
$$;
REVOKE ALL ON FUNCTION private.can_manage_account_email(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_manage_account_email(text) TO authenticated;
CREATE POLICY reset_request_department_boundary ON public.password_reset_requests AS RESTRICTIVE FOR ALL TO authenticated
USING (private.can_manage_account_email(email)) WITH CHECK (status='pending' OR private.can_manage_account_email(email));
CREATE POLICY audit_owner_read_boundary ON public.audit_logs AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT private.get_current_user_role())='owner');
CREATE POLICY system_log_actor_boundary ON public.system_logs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (actor_id=(SELECT (private.get_caller_user()).id));
-- Anonymous forms cannot forge review state or request privileged accounts.
CREATE OR REPLACE FUNCTION private.protect_join_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.role NOT IN ('student','doctor','ta') OR NEW.status<>'pending' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.rejection_note IS NOT NULL THEN RAISE EXCEPTION 'invalid_join_request'; END IF;
  IF NEW.password IS NULL OR length(NEW.password)<6 OR octet_length(NEW.password)>72 THEN RAISE EXCEPTION 'invalid_password_length'; END IF;
  NEW.password:=extensions.crypt(NEW.password,extensions.gen_salt('bf',10));
 ELSE
  IF NEW.password IS DISTINCT FROM OLD.password AND NEW.password IS NOT NULL THEN RAISE EXCEPTION 'request_password_is_immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.protect_join_request() FROM PUBLIC,anon,authenticated;
-- Convert existing pending passwords once. Never expose passwords in review queries.
UPDATE public.join_requests SET password=extensions.crypt(password,extensions.gen_salt('bf',10)) WHERE password IS NOT NULL AND password !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$';
UPDATE public.join_requests SET password=NULL WHERE status<>'pending';
CREATE TRIGGER protect_join_request BEFORE INSERT OR UPDATE ON public.join_requests FOR EACH ROW EXECUTE FUNCTION private.protect_join_request();
ALTER POLICY "users_department_insert_boundary" ON public.users WITH CHECK (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (role = ANY (ARRAY['doctor'::user_role, 'ta'::user_role, 'student'::user_role])) AND (department = ( SELECT u.department
   FROM users u
  WHERE (u.auth_id = (SELECT auth.uid())))))));
ALTER POLICY "users_department_delete_boundary" ON public.users USING (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (role = ANY (ARRAY['doctor'::user_role, 'ta'::user_role, 'student'::user_role])) AND (department = ( SELECT u.department
   FROM users u
  WHERE (u.auth_id = (SELECT auth.uid()))))))) ;
ALTER POLICY "users_coordinator_rank_boundary" ON public.users USING (((auth_id = ( SELECT (SELECT auth.uid()) AS uid)) OR (( SELECT private.get_current_user_role() AS get_current_user_role) <> 'coordinator'::user_role) OR (role = ANY (ARRAY['doctor'::user_role, 'ta'::user_role, 'student'::user_role])))) ;
ALTER POLICY "users_read_department_boundary" ON public.users USING (((auth_id = (SELECT auth.uid())) OR (private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department)) OR ((role = 'student'::user_role) AND (EXISTS ( SELECT 1
   FROM subjects s
  WHERE (private.can_manage_subject(s.id) AND ((s.department IS NULL) OR (s.department = users.department)) AND ((s.academic_year IS NULL) OR (s.academic_year = users.academic_year)))))))) ;
CREATE OR REPLACE FUNCTION private.guard_user_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE caller public.users;
BEGIN
 IF auth.uid() IS NULL THEN
   IF current_setting('request.jwt.claims',true)::jsonb ->> 'role' = 'authenticated' THEN
     RAISE EXCEPTION 'permission_denied';
   END IF;
   RETURN NEW;
 END IF;
 caller := private.get_caller_user();
 IF (NEW.id,NEW.auth_id,NEW.role,NEW.subject_id,NEW.department,NEW.academic_year,NEW.section_number,NEW.email,NEW.created_at,NEW.username,NEW.national_id)
    IS DISTINCT FROM (OLD.id,OLD.auth_id,OLD.role,OLD.subject_id,OLD.department,OLD.academic_year,OLD.section_number,OLD.email,OLD.created_at,OLD.username,OLD.national_id)
 THEN
   IF caller.role IS NULL OR caller.role NOT IN ('owner','coordinator') THEN
     RAISE EXCEPTION 'permission_denied: academic assignment is managed by administration';
   END IF;
   IF caller.role='coordinator' AND
     (OLD.role IN ('owner','coordinator') OR NEW.role IN ('owner','coordinator') OR
      OLD.department IS DISTINCT FROM caller.department OR NEW.department IS DISTINCT FROM caller.department) THEN
     RAISE EXCEPTION 'permission_denied: outside department';
   END IF;
 END IF;
 RETURN NEW;
END $function$
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
REVOKE EXECUTE ON FUNCTION public.check_email_exists(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_username_exists(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.check_username_exists(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_national_id_exists(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.check_national_id_exists(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_login_identifier(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO service_role;
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
    ORDER BY u.created_at DESC
    LIMIT 1;

    IF v_email IS NOT NULL AND v_email <> '' THEN
        RETURN v_email;
    END IF;

    -- 2. Search directly in auth.users by email prefix or raw metadata
    SELECT email INTO v_email
    FROM auth.users
    WHERE lower(email) = v_clean || '@cyber.local'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_email IS NOT NULL THEN
        RETURN v_email;
    END IF;

    -- 3. Fallback to standard local domain
    RETURN v_clean || '@cyber.local';
END;
$function$
;
REVOKE SELECT ON public.join_requests FROM authenticated;
GRANT SELECT ("id","role","section_number","created_at","reviewed_at","reviewed_by","full_name","username","status","rejection_note","email","department","academic_year","national_id") ON public.join_requests TO authenticated;
CREATE TABLE private.account_login_limits (identifier_hash text PRIMARY KEY, started_at timestamptz NOT NULL, attempts integer NOT NULL);
REVOKE ALL ON private.account_login_limits FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.reserve_account_login(p_identifier text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE count_attempts integer; key_hash text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'permission_denied'; END IF;
 key_hash:=encode(extensions.digest(lower(trim(p_identifier)),'sha256'),'hex');
 INSERT INTO private.account_login_limits AS limits VALUES(key_hash,now(),1) ON CONFLICT(identifier_hash) DO UPDATE SET attempts=CASE WHEN limits.started_at<now()-interval '5 minutes' THEN 1 ELSE limits.attempts+1 END, started_at=CASE WHEN limits.started_at<now()-interval '5 minutes' THEN now() ELSE limits.started_at END RETURNING attempts INTO count_attempts;
 DELETE FROM private.account_login_limits WHERE started_at<now()-interval '1 day';
 RETURN count_attempts<=10;
END $$;
REVOKE ALL ON FUNCTION public.reserve_account_login(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.reserve_account_login(text) TO service_role;
CREATE POLICY reset_submission_state ON public.password_reset_requests AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(status='pending' AND resolved_at IS NULL AND resolved_by IS NULL);
COMMIT;
