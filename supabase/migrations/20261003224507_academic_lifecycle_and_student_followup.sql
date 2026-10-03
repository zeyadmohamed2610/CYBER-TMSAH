BEGIN;

-- Academic lifecycle data is available only through authenticated, scoped workers.
CREATE TABLE private.academic_terms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), department text NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), academic_year_label text,
 starts_on date, ends_on date, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','closed')),
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
 CHECK(ends_on IS NULL OR starts_on IS NULL OR ends_on>=starts_on),
 CHECK(department IN ('cybersecurity','ai','data_science','mechatronics','autotronics','control_systems','garments'))
);
CREATE UNIQUE INDEX academic_terms_one_active ON private.academic_terms(department) WHERE status='active';
INSERT INTO private.academic_terms(department,name,status)
 SELECT d,'الفصل الحالي','active' FROM unnest(ARRAY['cybersecurity','ai','data_science','mechatronics','autotronics','control_systems','garments']) d;
ALTER TABLE public.lectures ADD COLUMN term_id uuid REFERENCES private.academic_terms(id);
ALTER TABLE public.sessions ADD COLUMN term_id uuid REFERENCES private.academic_terms(id);
UPDATE public.lectures l SET term_id=t.id FROM public.subjects s,private.academic_terms t
 WHERE s.id=l.subject_id AND t.department=COALESCE(s.department,(SELECT department FROM public.users WHERE id=l.created_by),'cybersecurity');
UPDATE public.sessions se SET term_id=COALESCE((SELECT term_id FROM public.lectures WHERE id=se.lecture_id),t.id)
 FROM public.subjects s,private.academic_terms t WHERE s.id=se.subject_id AND t.department=COALESCE(s.department,(SELECT department FROM public.users WHERE id=se.created_by),'cybersecurity');
ALTER TABLE public.lectures ALTER COLUMN term_id SET NOT NULL;
ALTER TABLE public.sessions ALTER COLUMN term_id SET NOT NULL;
CREATE INDEX lectures_term_idx ON public.lectures(term_id);
CREATE INDEX sessions_term_idx ON public.sessions(term_id);
ALTER TABLE public.session_roster ADD COLUMN student_snapshot jsonb;
UPDATE public.session_roster r SET student_snapshot=jsonb_build_object('name',u.full_name,'department',u.department,'academic_year',u.academic_year,'section',u.section_number)
 FROM public.users u WHERE u.id=r.student_id;
ALTER TABLE public.session_roster ALTER COLUMN student_snapshot SET NOT NULL;

CREATE TABLE private.attendance_rules (
 term_id uuid NOT NULL REFERENCES private.academic_terms(id), subject_id uuid NOT NULL REFERENCES public.subjects(id),
 kind text NOT NULL CHECK(kind IN ('lecture','section')), max_absences integer CHECK(max_absences>0),
 warning_absences integer CHECK(warning_absences>0), max_percent numeric CHECK(max_percent>0 AND max_percent<=100),
 warning_percent numeric CHECK(warning_percent>0 AND warning_percent<=100),
 excuse_mode text CHECK(excuse_mode IN ('exclude','count_absent')), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(term_id,subject_id,kind),
 CHECK(max_absences IS NULL OR warning_absences IS NULL OR warning_absences<max_absences),
 CHECK(max_percent IS NULL OR warning_percent IS NULL OR warning_percent<max_percent)
);
CREATE TABLE private.attendance_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), term_id uuid NOT NULL REFERENCES private.academic_terms(id),
 unit_id uuid NOT NULL, student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 subject_id uuid NOT NULL REFERENCES public.subjects(id), kind text NOT NULL CHECK(kind IN ('lecture','section')),
 request_type text NOT NULL CHECK(request_type IN ('excuse','appeal','device','connection')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 2000), file_path text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, decided_by uuid,
 decision_reason text, version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX attendance_case_pending ON private.attendance_cases(student_id,unit_id,request_type) WHERE status='pending';
CREATE INDEX attendance_cases_scope ON private.attendance_cases(term_id,subject_id,status);
CREATE INDEX attendance_cases_student ON private.attendance_cases(student_id,created_at DESC);
CREATE TABLE private.academic_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN ('schedule','attendance','request','exam','term','announcement')),
 title text NOT NULL CHECK(length(title)<=180), body text NOT NULL CHECK(length(body)<=1000),
 target text NOT NULL DEFAULT '/profile', event_key text, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
CREATE UNIQUE INDEX academic_notification_event ON private.academic_notifications(recipient_id,event_key) WHERE event_key IS NOT NULL;
CREATE INDEX academic_notification_inbox ON private.academic_notifications(recipient_id,created_at DESC);
CREATE TABLE private.notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 muted_categories text[] NOT NULL DEFAULT '{}', CHECK(muted_categories <@ ARRAY['schedule','attendance','request','exam','term','announcement']::text[])
);
CREATE TABLE private.schedule_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), term_id uuid NOT NULL REFERENCES private.academic_terms(id),
 department text NOT NULL, academic_year text NOT NULL, label text NOT NULL,
 snapshot jsonb NOT NULL, revision text NOT NULL, created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX schedule_versions_scope ON private.schedule_versions(department,academic_year,created_at DESC);
CREATE TABLE private.term_results (
 term_id uuid NOT NULL REFERENCES private.academic_terms(id), student_id uuid NOT NULL,
 student_auth_id uuid, subject_id uuid NOT NULL, kind text NOT NULL,
 student_snapshot jsonb NOT NULL, subject_name text NOT NULL, present integer NOT NULL,
 absent integer NOT NULL, excused integer NOT NULL, total integer NOT NULL,
 rule_snapshot jsonb, PRIMARY KEY(term_id,student_id,subject_id,kind)
);
CREATE INDEX term_results_student ON private.term_results(student_auth_id,term_id);
CREATE TABLE private.term_schedule_archives (
 term_id uuid NOT NULL REFERENCES private.academic_terms(id), academic_year text NOT NULL,
 snapshot jsonb NOT NULL, PRIMARY KEY(term_id,academic_year)
);
CREATE TABLE private.department_data_policies (
 department text PRIMARY KEY, location_retention_days integer CHECK(location_retention_days>0),
 national_id_retention_days integer CHECK(national_id_retention_days>0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.department_data_policies(department) SELECT department FROM private.academic_terms;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['academic_terms','attendance_rules','attendance_cases','academic_notifications','notification_preferences','schedule_versions','term_results','term_schedule_archives','department_data_policies'] LOOP
 EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated',t);
END LOOP; END $$;

CREATE FUNCTION private.lifecycle_department(p_department text DEFAULT NULL,p_management boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.users; d text; BEGIN
 c:=private.get_caller_user(); d:=COALESCE(NULLIF(p_department,''),c.department);
 IF auth.uid() IS NULL OR c.id IS NULL OR d IS NULL OR NOT EXISTS(SELECT 1 FROM private.department_data_policies WHERE department=d) THEN RAISE EXCEPTION 'permission_denied'; END IF;
 IF c.role<>'owner' AND c.department IS DISTINCT FROM d THEN RAISE EXCEPTION 'permission_denied: department'; END IF;
 IF p_management AND c.role NOT IN ('owner','coordinator') THEN RAISE EXCEPTION 'permission_denied: management'; END IF;
 RETURN d; END $$;
CREATE FUNCTION private.active_academic_term(p_department text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT id FROM private.academic_terms WHERE department=p_department AND status='active'; $$;
CREATE FUNCTION private.guard_term_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tid uuid; d text; BEGIN
 IF TG_OP<>'INSERT' THEN tid:=OLD.term_id; END IF;
 IF TG_OP='INSERT' THEN
  SELECT COALESCE(s.department,(SELECT department FROM public.users WHERE id=NEW.created_by),'cybersecurity') INTO d FROM public.subjects s WHERE s.id=NEW.subject_id;
  tid:=private.active_academic_term(d);
  IF TG_TABLE_NAME='sessions' THEN
   IF NEW.lecture_id IS NOT NULL THEN SELECT term_id INTO tid FROM public.lectures WHERE id=NEW.lecture_id; END IF;
  END IF;
  IF NEW.term_id IS NOT NULL AND NEW.term_id IS DISTINCT FROM tid THEN RAISE EXCEPTION 'validation_error: term binding'; END IF;
  NEW.term_id:=tid;
 END IF;
 PERFORM 1 FROM private.academic_terms WHERE id=tid AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'term_closed: academic records are read only'; END IF;
 IF TG_OP='UPDATE' AND NEW.term_id IS DISTINCT FROM OLD.term_id THEN RAISE EXCEPTION 'permission_denied: historical term'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER academic_term_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lectures FOR EACH ROW EXECUTE FUNCTION private.guard_term_record();
CREATE TRIGGER academic_term_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sessions FOR EACH ROW EXECUTE FUNCTION private.guard_term_record();
CREATE FUNCTION private.guard_term_attendance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid; BEGIN
 IF TG_OP='DELETE' THEN sid:=OLD.session_id; ELSE sid:=NEW.session_id; END IF;
 -- Explicit account deletion may cascade personal rows; immutable term_results remain.
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM public.users WHERE id=OLD.student_id) THEN RETURN OLD; END IF;
 PERFORM 1 FROM private.academic_terms t JOIN public.sessions se ON t.id=se.term_id WHERE se.id=sid AND t.status='active' FOR SHARE OF t;
 IF NOT FOUND THEN RAISE EXCEPTION 'term_closed: attendance is read only'; END IF;
 IF TG_OP='UPDATE' AND (NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.student_id IS DISTINCT FROM OLD.student_id) THEN RAISE EXCEPTION 'permission_denied: attendance binding'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER academic_term_attendance_guard BEFORE INSERT OR UPDATE OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION private.guard_term_attendance();
CREATE FUNCTION private.roster_identity_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.session_id IS DISTINCT FROM OLD.session_id) THEN RAISE EXCEPTION 'permission_denied: frozen enrollment'; END IF;
 IF TG_OP='UPDATE' AND NEW.student_snapshot IS DISTINCT FROM OLD.student_snapshot THEN RAISE EXCEPTION 'permission_denied: frozen enrollment'; END IF;
 IF TG_OP='INSERT' THEN SELECT jsonb_build_object('name',u.full_name,'department',u.department,'academic_year',u.academic_year,'section',u.section_number) INTO NEW.student_snapshot FROM public.users u WHERE u.id=NEW.student_id; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER roster_identity_guard BEFORE INSERT OR UPDATE ON public.session_roster FOR EACH ROW EXECUTE FUNCTION private.roster_identity_snapshot();

-- A signed key proves identity; eligibility and physical attendance remain separate checks.
CREATE FUNCTION private.lifecycle_register(p_term uuid DEFAULT NULL)
RETURNS TABLE(unit_id uuid,lecture_id uuid,subject_id uuid,subject_name text,title text,lecture_date date,student_id uuid,student_name text,status text,submitted_at timestamptz,kind text,term_id uuid,student_snapshot jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(se.lecture_id,se.id),se.lecture_id,se.subject_id,s.name,COALESCE(l.title,s.name),COALESCE(l.lecture_date,(se.created_at AT TIME ZONE 'Africa/Cairo')::date),u.id,
 COALESCE((jsonb_agg(r.student_snapshot ORDER BY se.created_at,se.id)->0)->>'name',u.full_name),
 CASE WHEN COUNT(a.id)>0 THEN 'present' WHEN BOOL_OR(se.expires_at>now()) THEN 'pending'
 WHEN BOOL_OR(EXISTS(SELECT 1 FROM private.attendance_cases x WHERE x.unit_id=COALESCE(se.lecture_id,se.id) AND x.student_id=u.id AND x.request_type='excuse' AND x.status='approved')) THEN 'excused' ELSE 'absent' END,
 MIN(a.created_at),COALESCE(l.kind,CASE WHEN se.section IS NULL OR se.section IN ('','عام','all') THEN 'lecture' ELSE 'section' END),se.term_id,jsonb_agg(r.student_snapshot ORDER BY se.created_at,se.id)->0
 FROM public.session_roster r JOIN public.sessions se ON se.id=r.session_id JOIN private.academic_terms t ON t.id=se.term_id
 JOIN public.subjects s ON s.id=se.subject_id JOIN public.users u ON u.id=r.student_id LEFT JOIN public.lectures l ON l.id=se.lecture_id
 LEFT JOIN public.attendance a ON a.session_id=se.id AND a.student_id=u.id
 WHERE auth.uid() IS NOT NULL AND (u.auth_id=auth.uid() OR private.can_manage_unit(se.subject_id,COALESCE(l.kind,CASE WHEN se.section IS NULL OR se.section IN ('','عام','all') THEN 'lecture' ELSE 'section' END)))
 AND ((p_term IS NULL AND t.status='active') OR se.term_id=p_term)
 GROUP BY COALESCE(se.lecture_id,se.id),se.lecture_id,se.subject_id,s.name,COALESCE(l.title,s.name),COALESCE(l.lecture_date,(se.created_at AT TIME ZONE 'Africa/Cairo')::date),u.id,u.full_name,
 COALESCE(l.kind,CASE WHEN se.section IS NULL OR se.section IN ('','عام','all') THEN 'lecture' ELSE 'section' END),se.term_id;
$$;
CREATE OR REPLACE FUNCTION private.attendance_register()
RETURNS TABLE(unit_id uuid,lecture_id uuid,subject_id uuid,subject_name text,title text,lecture_date date,student_id uuid,student_name text,status text,submitted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT unit_id,lecture_id,subject_id,subject_name,title,lecture_date,student_id,student_name,status,submitted_at FROM private.lifecycle_register(); $$;

CREATE FUNCTION private.lifecycle_notify(p_recipient uuid,p_category text,p_title text,p_body text,p_target text,p_event text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO private.academic_notifications(recipient_id,category,title,body,target,event_key)
 SELECT p_recipient,p_category,p_title,p_body,p_target,p_event
 WHERE NOT EXISTS(SELECT 1 FROM private.notification_preferences WHERE user_id=p_recipient AND p_category=ANY(muted_categories))
 ON CONFLICT(recipient_id,event_key) WHERE event_key IS NOT NULL DO NOTHING; $$;
CREATE FUNCTION private.notify_academic_department(p_department text,p_year text,p_category text,p_title text,p_body text,p_event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u record; BEGIN
 FOR u IN SELECT id FROM public.users WHERE department=p_department AND (role<>'student' OR academic_year=p_year OR p_year IS NULL) LOOP
 PERFORM private.lifecycle_notify(u.id,p_category,p_title,p_body,'/profile?section=notifications',p_event); END LOOP;
END $$;
CREATE FUNCTION private.lifecycle_session_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; name text; BEGIN
 IF NEW.expires_at>now() THEN
 SELECT s.name INTO name FROM public.subjects s WHERE s.id=NEW.subject_id;
 FOR r IN SELECT student_id FROM public.session_roster WHERE session_id=NEW.id LOOP
 PERFORM private.lifecycle_notify(r.student_id,'attendance','تسجيل الحضور متاح',name||' · أكّد حضورك خلال الوقت المحدد.','/student-panel','session:'||NEW.id); END LOOP;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER zz_academic_session_notice AFTER INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION private.lifecycle_session_notice();
CREATE FUNCTION private.lifecycle_exam_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' THEN PERFORM private.notify_academic_department(OLD.department,OLD.academic_year,'exam','تحديث جدول الامتحانات','أُزيل جدول امتحان. راجع آخر نسخة معتمدة.','exam:'||OLD.id||':'||gen_random_uuid()); RETURN OLD; END IF;
 PERFORM private.notify_academic_department(NEW.department,NEW.academic_year,'exam','تحديث جدول الامتحانات','نُشر أو عُدّل جدول امتحان. راجع آخر نسخة معتمدة.','exam:'||NEW.id||':'||gen_random_uuid()); RETURN NEW; END $$;
CREATE TRIGGER academic_exam_notice AFTER INSERT OR UPDATE OR DELETE ON public.exam_schedules FOR EACH ROW EXECUTE FUNCTION private.lifecycle_exam_notice();

CREATE FUNCTION private.lifecycle_inbox(p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.users; n uuid; BEGIN c:=private.get_caller_user(); IF auth.uid() IS NULL OR c.id IS NULL THEN RAISE EXCEPTION 'permission_denied'; END IF;
 IF p_action='read' THEN
 n:=NULLIF(p_payload->>'id','')::uuid; UPDATE private.academic_notifications SET read_at=COALESCE(read_at,now()) WHERE recipient_id=c.id AND (n IS NULL OR id=n);
 ELSIF p_action='preferences' THEN
 INSERT INTO private.notification_preferences(user_id,muted_categories) VALUES(c.id,ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'muted','[]')))) ON CONFLICT(user_id) DO UPDATE SET muted_categories=EXCLUDED.muted_categories;
 ELSIF p_action<>'list' THEN RAISE EXCEPTION 'validation_error: inbox action'; END IF;
 RETURN jsonb_build_object('items',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT id,category,title,body,target,created_at,read_at FROM private.academic_notifications WHERE recipient_id=c.id ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb),
 'unread',(SELECT count(*) FROM private.academic_notifications WHERE recipient_id=c.id AND read_at IS NULL),'muted',COALESCE((SELECT to_jsonb(muted_categories) FROM private.notification_preferences WHERE user_id=c.id),'[]'::jsonb)); END $$;
CREATE FUNCTION public.academic_inbox(p_action text DEFAULT 'list',p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.lifecycle_inbox(p_action,p_payload); $$;

CREATE FUNCTION private.lifecycle_case(p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.users; r record; x private.attendance_cases; sid uuid; v_status text; BEGIN
 c:=private.get_caller_user(); IF auth.uid() IS NULL OR c.id IS NULL THEN RAISE EXCEPTION 'permission_denied'; END IF;
 IF p_action='create' THEN
 IF c.role<>'student' THEN RAISE EXCEPTION 'permission_denied: student request'; END IF;
 SELECT * INTO r FROM private.lifecycle_register() WHERE unit_id=(p_payload->>'unit_id')::uuid AND student_id=c.id LIMIT 1;
 IF NOT FOUND OR r.status NOT IN ('absent','excused') THEN RAISE EXCEPTION 'validation_error: completed absence required'; END IF;
 PERFORM 1 FROM private.academic_terms WHERE id=r.term_id AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'term_closed'; END IF;
 IF EXISTS(SELECT 1 FROM private.attendance_cases WHERE unit_id=r.unit_id AND student_id=c.id AND status='approved' AND request_type=p_payload->>'request_type') THEN RAISE EXCEPTION 'validation_error: already approved'; END IF;
 INSERT INTO private.attendance_cases(term_id,unit_id,student_id,subject_id,kind,request_type,reason)
 VALUES(r.term_id,r.unit_id,c.id,r.subject_id,r.kind,p_payload->>'request_type',trim(p_payload->>'reason')) RETURNING * INTO x;
 PERFORM private.lifecycle_notify(c.id,'request','تم إرسال طلبك','سيظهر رد المسؤول هنا بعد المراجعة.','/profile?section=followup','case-created:'||x.id);
 PERFORM private.lifecycle_notify(u.id,'request','طلب مراجعة حضور جديد','يوجد طلب جديد لمادة ضمن مسؤوليتك.','/profile?section=followup','case-review:'||x.id)
 FROM public.users u WHERE u.role IN ('owner','coordinator','doctor','ta') AND (u.role='owner' OR u.department=c.department)
 AND (u.role IN ('owner','coordinator') OR ((u.role='doctor' AND r.kind='lecture') OR (u.role='ta' AND r.kind='section')) AND (u.subject_id=r.subject_id OR EXISTS(SELECT 1 FROM public.user_subjects us WHERE us.user_id=u.id AND us.subject_id=r.subject_id)));
 ELSIF p_action='decide' THEN
 SELECT * INTO x FROM private.attendance_cases WHERE id=(p_payload->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT private.can_manage_unit(x.subject_id,x.kind) THEN RAISE EXCEPTION 'permission_denied: case'; END IF;
 IF x.status<>'pending' OR x.version IS DISTINCT FROM (p_payload->>'version')::integer THEN RAISE EXCEPTION 'case_changed: reload'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.academic_terms WHERE id=x.term_id AND status='active') THEN RAISE EXCEPTION 'term_closed'; END IF;
 v_status:=p_payload->>'status'; IF v_status IS NULL OR v_status NOT IN ('approved','rejected') OR COALESCE(length(trim(p_payload->>'reason')),0) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'validation_error: decision and reason'; END IF;
 IF v_status='approved' AND x.request_type<>'excuse' THEN
 SELECT se.id INTO sid FROM public.sessions se JOIN public.session_roster sr ON sr.session_id=se.id WHERE COALESCE(se.lecture_id,se.id)=x.unit_id AND sr.student_id=x.student_id ORDER BY se.created_at DESC LIMIT 1;
 IF NOT EXISTS(SELECT 1 FROM public.attendance a JOIN public.sessions se ON se.id=a.session_id WHERE a.student_id=x.student_id AND COALESCE(se.lecture_id,se.id)=x.unit_id) THEN
 PERFORM private.record_manual_attendance(x.student_id,sid,left('طلب مراجعة '||x.id||': '||trim(p_payload->>'reason'),500)); END IF; END IF;
 UPDATE private.attendance_cases SET status=v_status,decided_at=now(),decided_by=c.id,decision_reason=trim(p_payload->>'reason'),version=version+1 WHERE id=x.id RETURNING * INTO x;
 PERFORM private.lifecycle_notify(x.student_id,'request',CASE WHEN v_status='approved' THEN 'قُبل طلب المراجعة' ELSE 'رُفض طلب المراجعة' END,x.decision_reason,'/profile?section=followup','case-decided:'||x.id||':'||x.version);
 ELSE RAISE EXCEPTION 'validation_error: case action'; END IF;
 INSERT INTO public.system_logs(actor_id,action,metadata) VALUES(c.id,'attendance_case_'||p_action,jsonb_build_object('case_id',x.id,'status',x.status));
 RETURN to_jsonb(x); END $$;
CREATE FUNCTION public.academic_case(p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.lifecycle_case(p_action,p_payload); $$;

CREATE OR REPLACE FUNCTION private.record_manual_attendance(p_student_id uuid,p_session_id uuid,p_reason text) RETURNS public.attendance LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.users; result public.attendance; sid uuid; k text; BEGIN
 c:=private.get_caller_user();
 SELECT se.subject_id,COALESCE(l.kind,CASE WHEN se.section IS NULL OR se.section IN ('','عام','all') THEN 'lecture' ELSE 'section' END) INTO sid,k FROM public.sessions se LEFT JOIN public.lectures l ON l.id=se.lecture_id WHERE se.id=p_session_id;
 IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_unit(sid,k),false) THEN RAISE EXCEPTION 'permission_denied: academic unit'; END IF;
 IF COALESCE(length(trim(p_reason)),0) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'validation_error: correction reason required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_roster WHERE student_id=p_student_id AND session_id=p_session_id) THEN RAISE EXCEPTION 'permission_denied: enrollment'; END IF;
 INSERT INTO public.attendance(student_id,session_id,metadata) VALUES(p_student_id,p_session_id,jsonb_build_object('manual',true,'reason',trim(p_reason),'recorded_by',c.id,'recorded_at',now())) RETURNING * INTO result;
 INSERT INTO public.system_logs(actor_id,action,metadata) VALUES(c.id,'manual_attendance',jsonb_build_object('student_id',p_student_id,'session_id',p_session_id,'reason',trim(p_reason)));
 RETURN result; END $$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('attendance-evidence','attendance-evidence',false,5242880,ARRAY['application/pdf','image/jpeg','image/png']);
CREATE FUNCTION private.case_file_access(p_name text,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM private.attendance_cases c JOIN public.users u ON u.id=c.student_id WHERE
 split_part(p_name,'/',1)=u.auth_id::text AND split_part(p_name,'/',2)=c.id::text AND
 CASE WHEN p_write THEN u.auth_id=auth.uid() AND c.status='pending' AND EXISTS(SELECT 1 FROM private.academic_terms t WHERE t.id=c.term_id AND t.status='active')
 ELSE c.file_path=p_name AND (u.auth_id=auth.uid() OR private.can_manage_unit(c.subject_id,c.kind)) END); $$;
CREATE POLICY attendance_evidence_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='attendance-evidence' AND private.case_file_access(name,true));
CREATE POLICY attendance_evidence_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='attendance-evidence' AND private.case_file_access(name,false));
CREATE FUNCTION private.lifecycle_case_attachment(p_case uuid,p_path text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT private.case_file_access(p_path,true) OR split_part(p_path,'/',2)<>p_case::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='attendance-evidence' AND name=p_path) THEN RAISE EXCEPTION 'permission_denied: case attachment'; END IF;
 UPDATE private.attendance_cases SET file_path=p_path,version=version+1 WHERE id=p_case AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'case_changed: reload'; END IF;
 END $$;
CREATE FUNCTION public.academic_case_attachment(p_case uuid,p_path text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.lifecycle_case_attachment(p_case,p_path); $$;

-- Reports use frozen enrollment; closed terms use a materialized, immutable result.
CREATE FUNCTION private.lifecycle_results(p_term uuid)
RETURNS SETOF private.term_results LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.users; d text; BEGIN
 c:=private.get_caller_user(); SELECT department INTO d FROM private.academic_terms WHERE id=p_term;
 PERFORM private.lifecycle_department(d);
 IF EXISTS(SELECT 1 FROM private.academic_terms WHERE id=p_term AND status='closed') THEN
 RETURN QUERY SELECT r.* FROM private.term_results r WHERE r.term_id=p_term AND
 (r.student_auth_id=auth.uid() OR private.can_manage_unit(r.subject_id,r.kind));
 ELSE
 RETURN QUERY SELECT p_term,r.student_id,u.auth_id,r.subject_id,r.kind,
 jsonb_agg(r.student_snapshot ORDER BY r.lecture_date,r.unit_id)->0,r.subject_name,
 count(*) FILTER(WHERE r.status='present')::integer,count(*) FILTER(WHERE r.status='absent')::integer,
 count(*) FILTER(WHERE r.status='excused')::integer,count(*) FILTER(WHERE r.status<>'pending')::integer,
 (SELECT to_jsonb(ar) FROM private.attendance_rules ar WHERE ar.term_id=p_term AND ar.subject_id=r.subject_id AND ar.kind=r.kind)
 FROM private.lifecycle_register(p_term) r JOIN public.users u ON u.id=r.student_id
 GROUP BY r.student_id,u.auth_id,r.subject_id,r.subject_name,r.kind;
 END IF; END $$;

CREATE FUNCTION private.lifecycle_overview(p_department text DEFAULT NULL,p_term uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.users; d text; tid uuid; BEGIN
 c:=private.get_caller_user(); d:=private.lifecycle_department(p_department);
 tid:=COALESCE(p_term,private.active_academic_term(d));
 IF tid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM private.academic_terms WHERE id=tid AND department=d) THEN RAISE EXCEPTION 'permission_denied: term'; END IF;
 RETURN jsonb_build_object('department',d,'selected_term',tid,
 'terms',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM private.academic_terms t WHERE department=d),'[]'),
 'subjects',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.name) FROM public.subjects s WHERE s.department=d AND (c.role IN ('owner','coordinator') OR private.can_manage_subject(s.id) OR c.role='student' AND (s.academic_year IS NULL OR s.academic_year=c.academic_year))),'[]'),
 'rules',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM private.attendance_rules r JOIN public.subjects s ON s.id=r.subject_id WHERE r.term_id=tid AND (c.role IN ('owner','coordinator') OR private.can_manage_unit(r.subject_id,r.kind) OR c.role='student' AND (s.academic_year IS NULL OR s.academic_year=c.academic_year))),'[]'),
 'results',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.student_snapshot->>'name',r.subject_name,r.kind) FROM private.lifecycle_results(tid) r),'[]'),
 'cases',COALESCE((SELECT jsonb_agg(to_jsonb(x)||jsonb_build_object('student_name',u.full_name,'subject_name',s.name) ORDER BY x.created_at DESC) FROM private.attendance_cases x JOIN public.users u ON u.id=x.student_id JOIN public.subjects s ON s.id=x.subject_id WHERE x.term_id=tid AND (x.student_id=c.id OR private.can_manage_unit(x.subject_id,x.kind))),'[]'),
 'absences',CASE WHEN c.role='student' THEN COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY lecture_date DESC) FROM private.lifecycle_register(tid) r WHERE r.student_id=c.id AND r.status='absent'),'[]') ELSE '[]'::jsonb END,
 'policy',CASE WHEN c.role IN ('owner','coordinator') THEN (SELECT to_jsonb(p) FROM private.department_data_policies p WHERE department=d) ELSE NULL END);
 END $$;
CREATE FUNCTION public.academic_overview(p_department text DEFAULT NULL,p_term uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.lifecycle_overview(p_department,p_term); $$;

CREATE FUNCTION private.lifecycle_alerts(p_department text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d text; tid uuid; r record; absent_count integer; denominator integer; percent numeric; level text; rule jsonb; BEGIN
 d:=private.lifecycle_department(p_department);tid:=private.active_academic_term(d);
 IF tid IS NULL THEN RETURN; END IF;
 FOR r IN SELECT * FROM private.lifecycle_results(tid) WHERE rule_snapshot IS NOT NULL LOOP
 rule:=r.rule_snapshot;
 IF r.excused>0 AND rule->>'excuse_mode' IS NULL THEN CONTINUE; END IF;
 absent_count:=r.absent+CASE WHEN rule->>'excuse_mode'='count_absent' THEN r.excused ELSE 0 END;
 denominator:=r.total-CASE WHEN rule->>'excuse_mode'='exclude' THEN r.excused ELSE 0 END;
 percent:=CASE WHEN denominator>0 THEN absent_count*100.0/denominator ELSE 0 END;
 level:=NULL;
 IF absent_count>=(rule->>'max_absences')::integer OR denominator>0 AND percent>=(rule->>'max_percent')::numeric THEN level:='limit';
 ELSIF absent_count>=(rule->>'warning_absences')::integer OR denominator>0 AND percent>=(rule->>'warning_percent')::numeric THEN level:='warning'; END IF;
 IF level IS NOT NULL THEN PERFORM private.lifecycle_notify(r.student_id,'attendance','راجع سجل حضورك',r.subject_name||' · وصل الغياب إلى مستوى المتابعة المحدد من الإدارة. هذا التنبيه لا يفرض قرار حرمان.','/student-panel?tab=followup','risk:'||tid||':'||r.subject_id||':'||r.kind||':'||level); END IF;
 END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.academic_overview(p_department text DEFAULT NULL,p_term uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF p_term IS NULL THEN PERFORM private.lifecycle_alerts(p_department); END IF;
 RETURN private.lifecycle_overview(p_department,p_term); END $$;

CREATE FUNCTION private.lifecycle_rule(p_department text,p_payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d text; tid uuid; sid uuid; BEGIN
 d:=private.lifecycle_department(p_department,true); tid:=(p_payload->>'term_id')::uuid; sid:=(p_payload->>'subject_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM private.academic_terms WHERE id=tid AND department=d AND status='active') OR NOT EXISTS(SELECT 1 FROM public.subjects WHERE id=sid AND department=d) THEN RAISE EXCEPTION 'permission_denied: rule scope'; END IF;
 INSERT INTO private.attendance_rules(term_id,subject_id,kind,max_absences,warning_absences,max_percent,warning_percent,excuse_mode)
 VALUES(tid,sid,p_payload->>'kind',NULLIF(p_payload->>'max_absences','')::integer,NULLIF(p_payload->>'warning_absences','')::integer,NULLIF(p_payload->>'max_percent','')::numeric,NULLIF(p_payload->>'warning_percent','')::numeric,NULLIF(p_payload->>'excuse_mode',''))
 ON CONFLICT(term_id,subject_id,kind) DO UPDATE SET max_absences=EXCLUDED.max_absences,warning_absences=EXCLUDED.warning_absences,max_percent=EXCLUDED.max_percent,warning_percent=EXCLUDED.warning_percent,excuse_mode=EXCLUDED.excuse_mode,updated_at=now();
 INSERT INTO public.system_logs(actor_id,action,metadata) VALUES((private.get_caller_user()).id,'attendance_rule_changed',jsonb_build_object('term_id',tid,'subject_id',sid,'kind',p_payload->>'kind'));
 END $$;
CREATE FUNCTION public.academic_rule(p_department text,p_payload jsonb) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.lifecycle_rule(p_department,p_payload); $$;

CREATE FUNCTION private.lifecycle_term(p_department text,p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d text; t private.academic_terms; y text; BEGIN
 d:=private.lifecycle_department(p_department,true);
 PERFORM pg_advisory_xact_lock(hashtextextended('term:'||d,0));
 IF p_action='create' THEN
 INSERT INTO private.academic_terms(department,name,academic_year_label,starts_on,ends_on,created_by)
 VALUES(d,trim(p_payload->>'name'),NULLIF(p_payload->>'academic_year_label',''),NULLIF(p_payload->>'starts_on','')::date,NULLIF(p_payload->>'ends_on','')::date,(private.get_caller_user()).id) RETURNING * INTO t;
 ELSE
 SELECT * INTO t FROM private.academic_terms WHERE id=(p_payload->>'id')::uuid AND department=d FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'permission_denied: term'; END IF;
 IF p_action='close' THEN
 IF t.status<>'active' THEN RAISE EXCEPTION 'validation_error: active term required'; END IF;
 IF EXISTS(SELECT 1 FROM private.attendance_cases WHERE term_id=t.id AND status='pending') THEN RAISE EXCEPTION 'pending_cases: review requests before closing'; END IF;
 UPDATE public.sessions SET expires_at=LEAST(expires_at,now()) WHERE term_id=t.id AND expires_at>now();
 INSERT INTO private.term_results SELECT * FROM private.lifecycle_results(t.id);
 FOR y IN SELECT DISTINCT academic_year FROM public.academic_schedule_entries WHERE department=d LOOP
 INSERT INTO private.term_schedule_archives(term_id,academic_year,snapshot) VALUES(t.id,y,private.academic_get_schedule(d,y)||jsonb_build_object('exams',COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM public.exam_schedules e WHERE department=d AND academic_year=y),'[]'),'cycles',private.academic_cycle_read(d,y))); END LOOP;
 UPDATE private.academic_terms SET status='closed',closed_at=now() WHERE id=t.id RETURNING * INTO t;
 ELSIF p_action='activate' THEN
 IF t.status<>'draft' OR private.active_academic_term(d) IS NOT NULL THEN RAISE EXCEPTION 'validation_error: close current term first'; END IF;
 PERFORM set_config('app.term_transition','on',true);
 DELETE FROM public.academic_schedule_entries WHERE department=d;
 DELETE FROM public.exam_schedules WHERE department=d;
 DELETE FROM private.academic_cycle_controls WHERE department=d;
 DELETE FROM private.academic_day_cycles WHERE department=d;
 UPDATE public.academic_schedule_settings SET semester_start=t.starts_on,updated_at=now() WHERE department=d;
 UPDATE private.academic_terms SET status='active' WHERE id=t.id RETURNING * INTO t;
 PERFORM set_config('app.term_transition','',true);
 ELSE RAISE EXCEPTION 'validation_error: term action'; END IF; END IF;
 PERFORM private.notify_academic_department(d,NULL,'term',CASE WHEN p_action='close' THEN 'أُغلق الفصل الدراسي' WHEN p_action='activate' THEN 'بدأ فصل دراسي جديد' ELSE 'أُضيف فصل دراسي' END,t.name,'term:'||t.id||':'||p_action);
 INSERT INTO public.system_logs(actor_id,action,metadata) VALUES((private.get_caller_user()).id,'academic_term_'||p_action,jsonb_build_object('term_id',t.id));
 RETURN to_jsonb(t); END $$;
CREATE FUNCTION public.academic_term(p_department text,p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.lifecycle_term(p_department,p_action,p_payload); $$;

-- Import and restore share validation and optimistic concurrency. Existing versions survive replacement.
ALTER FUNCTION private.academic_replace_schedule(text,text,jsonb,text) RENAME TO academic_replace_schedule_core;
CREATE FUNCTION private.schedule_checkpoint(p_department text,p_year text,p_label text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tid uuid; rev text; BEGIN
 PERFORM private.academic_scope(p_department,p_year,true); tid:=private.active_academic_term(p_department);
 IF tid IS NULL THEN RAISE EXCEPTION 'term_closed: schedule'; END IF;
 rev:=private.academic_schedule_revision(p_department,p_year);
 IF NOT EXISTS(SELECT 1 FROM private.schedule_versions WHERE term_id=tid AND department=p_department AND academic_year=p_year AND revision=rev) THEN
 INSERT INTO private.schedule_versions(term_id,department,academic_year,label,snapshot,revision,created_by) VALUES(tid,p_department,p_year,p_label,private.academic_get_schedule(p_department,p_year),rev,(private.get_caller_user()).id); END IF;
 END $$;
CREATE FUNCTION private.academic_replace_schedule(p_department text,p_year text,p_entries jsonb,p_expected_revision text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer; sc jsonb; d text; y text; previous_batch text; BEGIN
 sc:=private.academic_scope(p_department,p_year,true);d:=sc->>'department';y:=sc->>'academic_year';
 PERFORM pg_advisory_xact_lock(hashtextextended(d||':'||y,0));
 PERFORM private.schedule_checkpoint(d,y,'قبل الاستيراد');
 previous_batch:=current_setting('app.schedule_bulk',true);
 PERFORM set_config('app.schedule_bulk','on',true);
 n:=private.academic_replace_schedule_core(d,y,p_entries,p_expected_revision);
 PERFORM set_config('app.schedule_bulk',COALESCE(previous_batch,''),true);
 PERFORM private.schedule_checkpoint(d,y,'استيراد جدول الجامعة');
 PERFORM private.notify_academic_department(d,y,'schedule','تحديث الجدول الدراسي','نُشرت نسخة جديدة من جدولك. راجع المواعيد قبل الحضور.','schedule:'||private.academic_schedule_revision(d,y));
 RETURN n; END $$;
CREATE OR REPLACE FUNCTION public.replace_academic_schedule(p_department text,p_year text,p_entries jsonb,p_expected_revision text) RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.academic_replace_schedule(p_department,p_year,p_entries,p_expected_revision); $$;
CREATE OR REPLACE FUNCTION private.academic_import_entries(p_department text,p_year text,p_entries jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; item jsonb; existing uuid; n integer:=0; d text; y text; previous_batch text; BEGIN
 sc:=private.academic_scope(p_department,p_year,true);d:=sc->>'department';y:=sc->>'academic_year';
 IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 1200 THEN RAISE EXCEPTION 'validation_error: import size'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(d||':'||y,0)); PERFORM private.schedule_checkpoint(d,y,'قبل الاستيراد');
 previous_batch:=current_setting('app.schedule_bulk',true);PERFORM set_config('app.schedule_bulk','on',true);
 FOR item IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
 SELECT id INTO existing FROM public.academic_schedule_entries WHERE department=d AND academic_year=y AND section=(item->>'section')::integer AND day_index=(item->>'day_index')::integer AND period=(item->>'period')::integer AND week_pattern=COALESCE((item->>'week_pattern')::integer,0);
 item:=item-'id';IF existing IS NOT NULL THEN item:=item||jsonb_build_object('id',existing);END IF;
 PERFORM private.academic_save_entry(d,y,item);n:=n+1; END LOOP;
 PERFORM set_config('app.schedule_bulk',COALESCE(previous_batch,''),true);PERFORM private.schedule_checkpoint(d,y,'استيراد مواعيد');
 PERFORM private.notify_academic_department(d,y,'schedule','تحديث الجدول الدراسي','عُدّلت مواعيد جدولك. راجع آخر نسخة.','schedule:'||private.academic_schedule_revision(d,y));
 INSERT INTO public.system_logs(actor_id,action,metadata) VALUES((private.get_caller_user()).id,'import_academic_schedule',jsonb_build_object('department',d,'year',y,'count',n));RETURN n; END $$;
CREATE FUNCTION private.lifecycle_versions(p_department text,p_year text,p_restore uuid DEFAULT NULL,p_revision text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; v private.schedule_versions; BEGIN
 sc:=private.academic_scope(p_department,p_year,true);d:=sc->>'department';y:=sc->>'academic_year';
 IF p_restore IS NOT NULL THEN
 SELECT * INTO v FROM private.schedule_versions WHERE id=p_restore AND department=d AND academic_year=y AND term_id=private.active_academic_term(d);
 IF NOT FOUND THEN RAISE EXCEPTION 'permission_denied: version'; END IF;
 IF jsonb_array_length(v.snapshot->'entries')=0 THEN RAISE EXCEPTION 'validation_error: empty version cannot be published'; END IF;
 PERFORM private.academic_replace_schedule(d,y,v.snapshot->'entries',p_revision);
 PERFORM private.academic_save_settings(d,y,v.snapshot->'settings');
 END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'label',label,'created_at',created_at,'entries',jsonb_array_length(snapshot->'entries')) ORDER BY created_at DESC) FROM private.schedule_versions WHERE department=d AND academic_year=y AND term_id=private.active_academic_term(d)),'[]'); END $$;
CREATE FUNCTION public.academic_schedule_versions(p_department text,p_year text,p_restore uuid DEFAULT NULL,p_revision text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.lifecycle_versions(p_department,p_year,p_restore,p_revision); $$;

CREATE FUNCTION private.lifecycle_schedule_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d text; y text; BEGIN
 IF auth.uid() IS NULL OR current_setting('app.schedule_bulk',true)='on' THEN
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN d:=OLD.department;y:=OLD.academic_year; ELSE d:=NEW.department;y:=NEW.academic_year; END IF;
 IF private.active_academic_term(d) IS NULL AND current_setting('app.term_transition',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'term_closed: schedule'; END IF;
 IF private.active_academic_term(d) IS NOT NULL THEN
 PERFORM private.schedule_checkpoint(d,y,CASE WHEN TG_WHEN='BEFORE' THEN 'قبل التعديل' ELSE 'تعديل الجدول' END);
 IF TG_WHEN='AFTER' THEN PERFORM private.notify_academic_department(d,y,'schedule','تحديث الجدول الدراسي','عُدّلت مواعيد جدولك. راجع آخر نسخة.','schedule:'||private.academic_schedule_revision(d,y)); END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END $$;
CREATE TRIGGER academic_schedule_before_change BEFORE INSERT OR UPDATE OR DELETE ON public.academic_schedule_entries FOR EACH ROW EXECUTE FUNCTION private.lifecycle_schedule_change();
CREATE TRIGGER academic_schedule_after_change AFTER INSERT OR UPDATE OR DELETE ON public.academic_schedule_entries FOR EACH ROW EXECUTE FUNCTION private.lifecycle_schedule_change();
CREATE TRIGGER academic_settings_before_change BEFORE INSERT OR UPDATE OR DELETE ON public.academic_schedule_settings FOR EACH ROW EXECUTE FUNCTION private.lifecycle_schedule_change();
CREATE TRIGGER academic_settings_after_change AFTER INSERT OR UPDATE OR DELETE ON public.academic_schedule_settings FOR EACH ROW EXECUTE FUNCTION private.lifecycle_schedule_change();

-- Policies are opt-in. This endpoint only configures them; it never deletes personal data.
CREATE FUNCTION private.lifecycle_policy(p_department text,p_payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d text; BEGIN
 d:=private.lifecycle_department(p_department,true);
 UPDATE private.department_data_policies SET location_retention_days=NULLIF(p_payload->>'location_retention_days','')::integer,national_id_retention_days=NULLIF(p_payload->>'national_id_retention_days','')::integer,updated_at=now() WHERE department=d;
 INSERT INTO public.system_logs(actor_id,action,metadata) VALUES((private.get_caller_user()).id,'data_policy_changed',jsonb_build_object('department',d)); END $$;
CREATE FUNCTION public.academic_data_policy(p_department text,p_payload jsonb) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.lifecycle_policy(p_department,p_payload); $$;

CREATE FUNCTION private.current_term_visible(p_term uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM private.academic_terms t WHERE t.id=p_term AND t.status='active' AND ((private.get_caller_user()).role='owner' OR (private.get_caller_user()).department=t.department)); $$;
CREATE OR REPLACE FUNCTION public.fetch_lectures(p_subject_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,subject_id uuid,title text,lecture_date date,created_by uuid,created_at timestamptz,subject_name text,session_count bigint,attendee_count bigint,is_ended boolean,kind text,section text,duration_minutes integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT l.id,l.subject_id,l.title,l.lecture_date,l.created_by,l.created_at,s.name,count(DISTINCT se.id),count(DISTINCT a.student_id),count(DISTINCT se.id)>0 AND COALESCE(bool_and(se.expires_at<=now()),false),l.kind,l.section,l.duration_minutes
 FROM public.lectures l JOIN public.subjects s ON s.id=l.subject_id LEFT JOIN public.sessions se ON se.lecture_id=l.id LEFT JOIN public.attendance a ON a.session_id=se.id
 WHERE (p_subject_id IS NULL OR l.subject_id=p_subject_id) AND private.current_term_visible(l.term_id) AND (private.can_manage_unit(l.subject_id,l.kind) OR private.get_current_user_role()='student')
 GROUP BY l.id,s.name ORDER BY l.lecture_date DESC,l.created_at DESC; $$;

-- Capture the pre-existing timetable without altering a single class.
INSERT INTO private.schedule_versions(term_id,department,academic_year,label,snapshot,revision)
SELECT t.id,e.department,e.academic_year,'الجدول الحالي',jsonb_build_object('entries',jsonb_agg(to_jsonb(e) ORDER BY e.section,e.day_index,e.period),'settings',(SELECT to_jsonb(s) FROM public.academic_schedule_settings s WHERE s.department=e.department AND s.academic_year=e.academic_year)),md5(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text)
FROM public.academic_schedule_entries e JOIN private.academic_terms t ON t.department=e.department AND t.status='active' GROUP BY t.id,e.department,e.academic_year;

-- Anonymous execution and direct private-table access are never granted.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('private','public') AND p.proname IN
 ('lifecycle_department','active_academic_term','current_term_visible','guard_term_record','guard_term_attendance','roster_identity_snapshot','lifecycle_register','lifecycle_notify','notify_academic_department','lifecycle_session_notice','lifecycle_exam_notice','lifecycle_inbox','lifecycle_case','case_file_access','lifecycle_case_attachment','academic_case_attachment','lifecycle_results','lifecycle_overview','lifecycle_alerts','lifecycle_rule','lifecycle_term','schedule_checkpoint','lifecycle_versions','lifecycle_schedule_change','lifecycle_policy','academic_import_entries','replace_academic_schedule','academic_replace_schedule','academic_replace_schedule_core','academic_inbox','academic_case','academic_overview','academic_rule','academic_term','academic_schedule_versions','academic_data_policy') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature); END LOOP;
 END $$;
GRANT EXECUTE ON FUNCTION private.lifecycle_inbox(text,jsonb),private.lifecycle_case(text,jsonb),private.lifecycle_overview(text,uuid),private.lifecycle_rule(text,jsonb),private.lifecycle_term(text,text,jsonb),private.lifecycle_versions(text,text,uuid,text),private.lifecycle_policy(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.academic_replace_schedule(text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.academic_import_entries(text,text,jsonb),public.replace_academic_schedule(text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_term_visible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.lifecycle_alerts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.case_file_access(text,boolean),private.lifecycle_case_attachment(uuid,text),public.academic_case_attachment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.academic_inbox(text,jsonb),public.academic_case(text,jsonb),public.academic_overview(text,uuid),public.academic_rule(text,jsonb),public.academic_term(text,text,jsonb),public.academic_schedule_versions(text,text,uuid,text),public.academic_data_policy(text,jsonb) TO authenticated;
COMMIT;
