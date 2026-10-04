BEGIN;
-- Faculty memberships are administrative assignments; other ranks keep one department.
ALTER TABLE public.users ADD COLUMN departments text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.join_requests ADD COLUMN departments text[] NOT NULL DEFAULT '{}';
UPDATE public.users SET departments=ARRAY[department] WHERE department IS NOT NULL;
UPDATE public.join_requests SET departments=ARRAY[department] WHERE department IS NOT NULL;
CREATE OR REPLACE FUNCTION private.user_in_department(p_user public.users,p_department text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT p_user.department=p_department OR (p_user.role IN ('doctor','ta') AND p_department=ANY(p_user.departments));
$$;
REVOKE ALL ON FUNCTION private.user_in_department(public.users,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.user_in_department(public.users,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION private.validate_department_memberships() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.department IS DISTINCT FROM OLD.department OR NEW.role IS DISTINCT FROM OLD.role) AND NEW.departments=OLD.departments THEN
 NEW.departments:=CASE WHEN NEW.role IN ('doctor','ta') THEN ARRAY(SELECT DISTINCT d FROM unnest(NEW.departments||ARRAY[NEW.department]) d WHERE d IS NOT NULL) ELSE ARRAY[NEW.department] END;
 END IF;
 IF NEW.department IS NULL THEN NEW.departments:='{}'; RETURN NEW; END IF;
 IF cardinality(NEW.departments)=0 THEN NEW.departments:=ARRAY[NEW.department]; END IF;
 IF NEW.role NOT IN ('doctor','ta') AND NEW.departments<>ARRAY[NEW.department] THEN RAISE EXCEPTION 'validation_error: only faculty may join multiple departments'; END IF;
 IF NOT NEW.department=ANY(NEW.departments) OR cardinality(NEW.departments)>7 OR array_position(NEW.departments,NULL) IS NOT NULL OR NOT NEW.departments <@ ARRAY['cybersecurity','ai','data_science','mechatronics','autotronics','control_systems','garments']::text[] THEN RAISE EXCEPTION 'validation_error: departments'; END IF;
 IF cardinality(NEW.departments)<>(SELECT count(DISTINCT d) FROM unnest(NEW.departments) d) THEN RAISE EXCEPTION 'validation_error: duplicate departments'; END IF;
 IF TG_TABLE_NAME='users' AND TG_OP='UPDATE' AND NEW.departments IS DISTINCT FROM OLD.departments AND auth.uid() IS NOT NULL AND (SELECT private.get_current_user_role())<>'owner' THEN RAISE EXCEPTION 'permission_denied: department membership'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_department_memberships() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_validate_department_memberships BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION private.validate_department_memberships();
CREATE TRIGGER a_validate_department_memberships BEFORE INSERT OR UPDATE ON public.join_requests FOR EACH ROW EXECUTE FUNCTION private.validate_department_memberships();
GRANT SELECT(departments) ON public.join_requests TO authenticated;
CREATE OR REPLACE FUNCTION private.apply_approved_departments() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='approved' AND OLD.status='pending' THEN
 UPDATE public.users SET departments=NEW.departments WHERE lower(email)=lower(NEW.email) AND role=NEW.role;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.apply_approved_departments() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER apply_approved_departments AFTER UPDATE ON public.join_requests FOR EACH ROW EXECUTE FUNCTION private.apply_approved_departments();

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
 IF (NEW.id,NEW.auth_id,NEW.role,NEW.subject_id,NEW.department,NEW.academic_year,NEW.section_number,NEW.email,NEW.created_at,NEW.username,NEW.national_id,NEW.departments)
    IS DISTINCT FROM (OLD.id,OLD.auth_id,OLD.role,OLD.subject_id,OLD.department,OLD.academic_year,OLD.section_number,OLD.email,OLD.created_at,OLD.username,OLD.national_id,OLD.departments)
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
END $function$;


CREATE OR REPLACE FUNCTION private.academic_scope(p_department text, p_year text, p_write boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.users; d text; y text;
BEGIN
 c:=private.get_caller_user();
 IF auth.uid() IS NULL OR c.id IS NULL THEN RAISE EXCEPTION 'permission_denied: sign in'; END IF;
 d:=COALESCE(NULLIF(p_department,''),c.department); y:=COALESCE(NULLIF(p_year,''),c.academic_year,CASE WHEN NOT p_write AND c.role<>'student' THEN (SELECT e.academic_year FROM public.academic_schedule_entries e WHERE e.department=d GROUP BY e.academic_year ORDER BY e.academic_year LIMIT 1) END,'1');
 IF d IS NULL OR d NOT IN ('cybersecurity','ai','data_science','mechatronics','autotronics','control_systems','garments') OR y NOT IN ('1','2','3','4') THEN RAISE EXCEPTION 'validation_error: department and year'; END IF;
 IF c.role<>'owner' AND NOT private.user_in_department(c,d) THEN RAISE EXCEPTION 'permission_denied: another department'; END IF;
 IF c.role='student' AND c.academic_year IS DISTINCT FROM y THEN RAISE EXCEPTION 'permission_denied: another academic year'; END IF;
 IF p_write AND c.role NOT IN ('owner','coordinator') THEN RAISE EXCEPTION 'permission_denied: schedule management'; END IF;
 RETURN jsonb_build_object('department',d,'academic_year',y,'can_edit',c.role IN ('owner','coordinator'),'student_section',CASE WHEN c.role='student' THEN c.section_number::text ELSE NULL END);
END;
$function$;


CREATE OR REPLACE FUNCTION private.lifecycle_department(p_department text DEFAULT NULL::text, p_management boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.users; d text; BEGIN
 c:=private.get_caller_user(); d:=COALESCE(NULLIF(p_department,''),c.department);
 IF auth.uid() IS NULL OR c.id IS NULL OR d IS NULL OR NOT EXISTS(SELECT 1 FROM private.department_data_policies WHERE department=d) THEN RAISE EXCEPTION 'permission_denied'; END IF;
 IF c.role<>'owner' AND NOT private.user_in_department(c,d) THEN RAISE EXCEPTION 'permission_denied: department'; END IF;
 IF p_management AND c.role NOT IN ('owner','coordinator') THEN RAISE EXCEPTION 'permission_denied: management'; END IF;
 RETURN d; END $function$;


CREATE OR REPLACE FUNCTION private.academic_get_schedule(p_department text, p_year text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE sc jsonb; d text; y text; settings jsonb; entries jsonb; subjects jsonb; instructors jsonb;
BEGIN
 sc:=private.academic_scope(p_department,p_year);d:=sc->>'department';y:=sc->>'academic_year';
 SELECT to_jsonb(s) INTO settings FROM public.academic_schedule_settings s WHERE s.department=d AND (s.academic_year=y OR s.academic_year IS NULL);
 SELECT COALESCE(jsonb_agg(to_jsonb(e)||jsonb_build_object('subject_name',s.name) ORDER BY e.section,e.day_index,e.period),'[]') INTO entries
 FROM public.academic_schedule_entries e JOIN public.subjects s ON s.id=e.subject_id WHERE e.department=d AND e.academic_year=y;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.name),'[]') INTO subjects FROM public.subjects s WHERE s.department=d AND (s.academic_year=y OR s.academic_year IS NULL);
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name,'role',u.role,'subjects',
 (SELECT COALESCE(jsonb_agg(x.sid),'[]') FROM (SELECT u.subject_id sid WHERE u.subject_id IS NOT NULL UNION SELECT us.subject_id FROM public.user_subjects us WHERE us.user_id=u.id) x)) ORDER BY u.full_name),'[]')
 INTO instructors FROM public.users u WHERE private.user_in_department(u,d) AND u.role IN ('doctor','ta');
 RETURN sc||jsonb_build_object('settings',COALESCE(settings,jsonb_build_object('department',d,'academic_year',y,'semester_start',NULL,'week_start_day',5,'days_off','[4,6]'::jsonb,'start_time','09:00:00','slot_minutes',60,'section_count',15)),
 'entries',entries,'subjects',subjects,'instructors',instructors);
END;
$function$;


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

  IF v_caller_role='coordinator' AND (v_req.role IN ('owner','coordinator') OR v_req.department IS DISTINCT FROM v_caller.department OR cardinality(v_req.departments)>1) THEN RAISE EXCEPTION 'permission_denied: outside department'; END IF;
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
    SET encrypted_password = v_password,
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


CREATE OR REPLACE FUNCTION private.account_delete_user_by_id(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE caller public.users; target public.users; history jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permission_denied: sign in'; END IF;
 caller:=private.get_caller_user();
 IF caller.id IS NULL OR caller.role NOT IN ('owner','coordinator') THEN RAISE EXCEPTION 'permission_denied: account management'; END IF;
 SELECT * INTO target FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found: account'; END IF;
 IF caller.id=target.id THEN RAISE EXCEPTION 'validation_error: users cannot delete their own account'; END IF;
 IF caller.role='coordinator' AND (target.role IN ('owner','coordinator') OR target.department IS DISTINCT FROM caller.department OR cardinality(target.departments)>1) THEN RAISE EXCEPTION 'permission_denied: outside department'; END IF;
 history:=jsonb_build_object('deleted_profile',jsonb_build_object('id',target.id,'full_name',target.full_name,'role',target.role,'department',target.department),
  'lecture_ids',COALESCE((SELECT jsonb_agg(id) FROM public.lectures WHERE created_by=target.id),'[]'::jsonb),
  'session_ids',COALESCE((SELECT jsonb_agg(id) FROM public.sessions WHERE created_by=target.id),'[]'::jsonb));
 INSERT INTO public.system_logs(actor_id,action,metadata) VALUES(caller.id,'delete_user_by_id',history);
 DELETE FROM public.users WHERE id=target.id;
 IF target.auth_id IS NOT NULL THEN DELETE FROM auth.users WHERE id=target.auth_id; END IF;
END $function$;


CREATE OR REPLACE FUNCTION private.read_user_subjects(p_user_id uuid)
 RETURNS TABLE(subject_id uuid, subject_name text, department text, assigned_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE caller public.users; target public.users;
BEGIN
  caller := private.get_caller_user();
  SELECT * INTO target FROM public.users WHERE id = p_user_id;
  IF auth.uid() IS NULL OR caller.id IS NULL OR NOT
    (caller.id = p_user_id OR caller.role = 'owner' OR
      (caller.role = 'coordinator' AND target.role IN ('doctor','ta')
       AND private.user_in_department(target,caller.department))) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;
  RETURN QUERY SELECT s.id,s.name,s.department,us.assigned_at
    FROM public.user_subjects us JOIN public.subjects s ON s.id = us.subject_id
    WHERE us.user_id = p_user_id AND (caller.role<>'coordinator' OR s.department=caller.department) ORDER BY s.name;
END $function$;


CREATE OR REPLACE FUNCTION private.write_user_subjects(p_user_id uuid, p_subject_ids uuid[])
 RETURNS SETOF user_subjects
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE caller public.users; target public.users;
BEGIN
 caller := private.get_caller_user(); SELECT * INTO target FROM public.users WHERE id=p_user_id;
 IF auth.uid() IS NULL OR caller.role IS NULL OR caller.role NOT IN ('owner','coordinator') OR target.role NOT IN ('doctor','ta','coordinator') THEN RAISE EXCEPTION 'permission_denied'; END IF;
 IF caller.role='coordinator' AND (target.role='coordinator' OR NOT private.user_in_department(target,caller.department)) THEN RAISE EXCEPTION 'permission_denied'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_subject_ids) sid WHERE NOT COALESCE(private.can_manage_subject(sid),false)) THEN RAISE EXCEPTION 'permission_denied: subject outside department'; END IF;
 IF EXISTS(SELECT 1 FROM public.subjects s WHERE s.id=ANY(p_subject_ids) AND NOT private.user_in_department(target,s.department)) THEN RAISE EXCEPTION 'permission_denied: faculty department'; END IF;
 DELETE FROM public.user_subjects us WHERE user_id=p_user_id AND (caller.role='owner' OR EXISTS(SELECT 1 FROM public.subjects s WHERE s.id=us.subject_id AND s.department=caller.department));
 INSERT INTO public.user_subjects(user_id,subject_id) SELECT p_user_id,sid FROM (SELECT DISTINCT unnest(p_subject_ids) sid) ids WHERE sid IS NOT NULL;
 IF caller.role='owner' OR (target.subject_id IS NULL AND target.department=caller.department) THEN
 UPDATE public.users SET subject_id=(SELECT us.subject_id FROM public.user_subjects us WHERE us.user_id=p_user_id ORDER BY us.subject_id LIMIT 1) WHERE id=p_user_id;
 END IF;
 INSERT INTO public.system_logs(actor_id,action) VALUES(caller.id,'assign_user_subjects: '||p_user_id::text);
 RETURN QUERY SELECT us.* FROM public.user_subjects us JOIN public.subjects s ON s.id=us.subject_id WHERE us.user_id=p_user_id AND (caller.role='owner' OR s.department=caller.department);
END $function$;


ALTER POLICY "academic_settings_read" ON public.academic_schedule_settings USING (((private.get_current_user_role() = 'owner'::user_role) OR (private.user_in_department((select private.get_caller_user()),department) AND ((private.get_current_user_role() <> 'student'::user_role) OR (academic_year = (private.get_caller_user()).academic_year))))) ;

ALTER POLICY "academic_entries_read" ON public.academic_schedule_entries USING (((private.get_current_user_role() = 'owner'::user_role) OR (private.user_in_department((select private.get_caller_user()),department) AND ((private.get_current_user_role() <> 'student'::user_role) OR (academic_year = (private.get_caller_user()).academic_year))))) ;

ALTER POLICY "academic_exams_scope" ON public.exam_schedules USING (((private.get_current_user_role() = 'owner'::user_role) OR (private.user_in_department((select private.get_caller_user()),department) AND ((private.get_current_user_role() <> 'student'::user_role) OR (academic_year = (private.get_caller_user()).academic_year))))) ;

ALTER POLICY "coordinator_join_scope" ON public.join_requests USING (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department AND cardinality(departments)<=1) AND (role <> ALL (ARRAY['owner'::user_role, 'coordinator'::user_role]))))) ;

ALTER POLICY "coordinator_join_update_scope" ON public.join_requests USING (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department AND cardinality(departments)<=1) AND (role <> ALL (ARRAY['owner'::user_role, 'coordinator'::user_role]))))) WITH CHECK (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department AND cardinality(departments)<=1) AND (role <> ALL (ARRAY['owner'::user_role, 'coordinator'::user_role])))));

ALTER POLICY "coordinator_join_delete_scope" ON public.join_requests USING (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department AND cardinality(departments)<=1) AND (role <> ALL (ARRAY['owner'::user_role, 'coordinator'::user_role]))))) ;

ALTER POLICY "user_subjects_department_boundary" ON public.user_subjects USING (((user_id = ( SELECT (private.get_caller_user()).id AS id)) OR (( SELECT private.get_current_user_role() AS get_current_user_role) = 'owner'::user_role) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = user_subjects.user_id) AND (u.role = ANY (ARRAY['doctor'::user_role, 'ta'::user_role])) AND private.user_in_department(u,(select (private.get_caller_user()).department)) AND (( SELECT private.get_current_user_role() AS get_current_user_role) = 'coordinator'::user_role)))))) WITH CHECK (((( SELECT private.get_current_user_role() AS get_current_user_role) = 'owner'::user_role) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = user_subjects.user_id) AND (u.role = ANY (ARRAY['doctor'::user_role, 'ta'::user_role])) AND private.user_in_department(u,(select (private.get_caller_user()).department)) AND (( SELECT private.get_current_user_role() AS get_current_user_role) = 'coordinator'::user_role))))));

ALTER POLICY "users_read_department_boundary" ON public.users USING (((auth_id = ( SELECT auth.uid() AS uid)) OR (private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND private.user_in_department(users,(select (private.get_caller_user()).department))) OR ((role = 'student'::user_role) AND (EXISTS ( SELECT 1
   FROM subjects s
  WHERE (private.can_manage_subject(s.id) AND ((s.department IS NULL) OR (s.department = users.department)) AND ((s.academic_year IS NULL) OR (s.academic_year = users.academic_year)))))))) ;

CREATE OR REPLACE FUNCTION private.can_manage_subject(p_subject_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.subjects s ON s.id=p_subject_id
 WHERE u.auth_id=auth.uid() AND (u.role='owner' OR
 (u.role='coordinator' AND u.department IS NOT DISTINCT FROM s.department) OR
 (u.role IN ('doctor','ta') AND private.user_in_department(u,s.department) AND (u.subject_id=s.id OR EXISTS
 (SELECT 1 FROM public.user_subjects us WHERE us.user_id=u.id AND us.subject_id=s.id)))));
$function$;


CREATE POLICY faculty_shared_account_delete_boundary ON public.users AS RESTRICTIVE FOR DELETE TO authenticated
USING ((SELECT private.get_current_user_role())='owner' OR cardinality(departments)<=1);
CREATE OR REPLACE FUNCTION private.guard_subject_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target public.users; d text;
BEGIN
 SELECT * INTO target FROM public.users WHERE id=NEW.user_id;
 SELECT department INTO d FROM public.subjects WHERE id=NEW.subject_id;
 IF target.id IS NULL OR d IS NULL OR NOT private.user_in_department(target,d) THEN RAISE EXCEPTION 'permission_denied: faculty department'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_subject_membership() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER faculty_subject_department_boundary BEFORE INSERT OR UPDATE ON public.user_subjects FOR EACH ROW EXECUTE FUNCTION private.guard_subject_membership();

CREATE OR REPLACE FUNCTION private.notify_academic_department(p_department text, p_year text, p_category text, p_title text, p_body text, p_event text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE u record; BEGIN
 FOR u IN SELECT id FROM public.users u WHERE private.user_in_department(u,p_department) AND (role<>'student' OR academic_year=p_year OR p_year IS NULL) LOOP
 PERFORM private.lifecycle_notify(u.id,p_category,p_title,p_body,'/profile?section=notifications',p_event); END LOOP;
END $function$;

COMMIT;
