CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA private;CREATE SCHEMA auth;
CREATE TYPE user_role AS ENUM('owner','coordinator','doctor','ta','student');
CREATE TABLE public.users(id uuid primary key,auth_id uuid,role user_role,department text,academic_year text,section_number int,full_name text,subject_id uuid,national_id text,email text,username text,created_at timestamptz);
CREATE TABLE public.join_requests(id uuid primary key,role user_role,department text,status text,email text,full_name text,username text,password text,rejection_note text,academic_year text,section_number int,national_id text,created_at timestamptz,reviewed_by uuid,reviewed_at timestamptz);
CREATE TABLE public.subjects(id uuid primary key,department text,academic_year text,name text);
CREATE TABLE public.user_subjects(user_id uuid,subject_id uuid,assigned_at timestamptz default now());
CREATE TABLE public.academic_schedule_entries(id uuid,department text,academic_year text);
CREATE TABLE public.academic_schedule_settings(department text,academic_year text);
CREATE TABLE public.exam_schedules(department text,academic_year text);
CREATE TABLE private.department_data_policies(department text);
INSERT INTO private.department_data_policies VALUES('cybersecurity'),('ai'),('data_science');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT NULLIF(current_setting('test.auth',true),'')::uuid$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
CREATE FUNCTION private.get_caller_user() RETURNS public.users LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT * FROM public.users WHERE auth_id=auth.uid()$$;
CREATE FUNCTION private.get_current_user_role() RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT (private.get_caller_user()).role$$;
CREATE FUNCTION private.can_manage_subject(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
GRANT USAGE ON SCHEMA private,auth TO authenticated;
GRANT SELECT ON public.users,public.subjects,public.user_subjects,public.academic_schedule_entries,public.academic_schedule_settings,public.exam_schedules TO authenticated;
ALTER TABLE public.academic_schedule_settings ENABLE ROW LEVEL SECURITY;CREATE POLICY "academic_settings_read" ON public.academic_schedule_settings FOR SELECT TO authenticated USING (((private.get_current_user_role() = 'owner'::user_role) OR ((department = (private.get_caller_user()).department) AND ((private.get_current_user_role() <> 'student'::user_role) OR (academic_year = (private.get_caller_user()).academic_year))))) ;
ALTER TABLE public.academic_schedule_entries ENABLE ROW LEVEL SECURITY;CREATE POLICY "academic_entries_read" ON public.academic_schedule_entries FOR SELECT TO authenticated USING (((private.get_current_user_role() = 'owner'::user_role) OR ((department = (private.get_caller_user()).department) AND ((private.get_current_user_role() <> 'student'::user_role) OR (academic_year = (private.get_caller_user()).academic_year))))) ;
ALTER TABLE public.exam_schedules ENABLE ROW LEVEL SECURITY;CREATE POLICY "academic_exams_scope" ON public.exam_schedules FOR SELECT TO authenticated USING (((private.get_current_user_role() = 'owner'::user_role) OR ((department = (private.get_caller_user()).department) AND ((private.get_current_user_role() <> 'student'::user_role) OR (academic_year = (private.get_caller_user()).academic_year))))) ;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;CREATE POLICY "coordinator_join_scope" ON public.join_requests FOR SELECT TO authenticated USING (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department) AND (role <> ALL (ARRAY['owner'::user_role, 'coordinator'::user_role]))))) ;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;CREATE POLICY "coordinator_join_update_scope" ON public.join_requests FOR UPDATE TO authenticated USING (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department) AND (role <> ALL (ARRAY['owner'::user_role, 'coordinator'::user_role]))))) WITH CHECK (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department) AND (role <> ALL (ARRAY['owner'::user_role, 'coordinator'::user_role])))));
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;CREATE POLICY "coordinator_join_delete_scope" ON public.join_requests FOR DELETE TO authenticated USING (((private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department) AND (role <> ALL (ARRAY['owner'::user_role, 'coordinator'::user_role]))))) ;
ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;CREATE POLICY "user_subjects_department_boundary" ON public.user_subjects FOR ALL TO authenticated USING (((user_id = ( SELECT (private.get_caller_user()).id AS id)) OR (( SELECT private.get_current_user_role() AS get_current_user_role) = 'owner'::user_role) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = user_subjects.user_id) AND (u.role = ANY (ARRAY['doctor'::user_role, 'ta'::user_role])) AND (u.department = ( SELECT (private.get_caller_user()).department AS department)) AND (( SELECT private.get_current_user_role() AS get_current_user_role) = 'coordinator'::user_role)))))) WITH CHECK (((( SELECT private.get_current_user_role() AS get_current_user_role) = 'owner'::user_role) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = user_subjects.user_id) AND (u.role = ANY (ARRAY['doctor'::user_role, 'ta'::user_role])) AND (u.department = ( SELECT (private.get_caller_user()).department AS department)) AND (( SELECT private.get_current_user_role() AS get_current_user_role) = 'coordinator'::user_role))))));
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;CREATE POLICY "users_read_department_boundary" ON public.users FOR SELECT TO authenticated USING (((auth_id = ( SELECT auth.uid() AS uid)) OR (private.get_current_user_role() = 'owner'::user_role) OR ((private.get_current_user_role() = 'coordinator'::user_role) AND (department = (private.get_caller_user()).department)) OR ((role = 'student'::user_role) AND (EXISTS ( SELECT 1
   FROM subjects s
  WHERE (private.can_manage_subject(s.id) AND ((s.department IS NULL) OR (s.department = users.department)) AND ((s.academic_year IS NULL) OR (s.academic_year = users.academic_year)))))))) ;

CREATE TABLE public.system_logs(actor_id uuid,action text);
CREATE POLICY join_submission ON public.join_requests FOR INSERT TO anon WITH CHECK(status='pending' AND role IN ('doctor','ta','student','coordinator'));
