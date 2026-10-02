-- Academic units are one hour; attendance windows remain independently configurable.
ALTER TABLE public.lectures ADD COLUMN kind text NOT NULL DEFAULT 'lecture' CHECK(kind IN ('lecture','section'));
ALTER TABLE public.lectures ADD COLUMN section text CHECK(section IS NULL OR section ~ '^(?:[1-9]|1[0-5])$');
ALTER TABLE public.lectures ADD COLUMN duration_minutes integer NOT NULL DEFAULT 60 CHECK(duration_minutes=60);
UPDATE public.lectures l SET kind='section' FROM public.users u WHERE u.id=l.created_by AND u.role='ta';

CREATE OR REPLACE FUNCTION private.can_manage_unit(p_subject_id uuid,p_kind text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.can_manage_subject(p_subject_id) AND EXISTS(SELECT 1 FROM public.users u WHERE u.auth_id=auth.uid()
 AND (u.role IN ('owner','coordinator') OR (u.role='doctor' AND p_kind='lecture') OR (u.role='ta' AND p_kind='section')));
$$;
REVOKE ALL ON FUNCTION private.can_manage_unit(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_manage_unit(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.academic_create_unit(p_subject_id uuid,p_title text,p_kind text,p_section text)
RETURNS public.lectures LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.users; k text; r public.lectures;
BEGIN
 c:=private.get_caller_user();
 k:=COALESCE(p_kind,CASE WHEN c.role='ta' THEN 'section' ELSE 'lecture' END);
 IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_unit(p_subject_id,k),false) THEN RAISE EXCEPTION 'permission_denied: session type or subject'; END IF;
 IF k='section' AND (p_section IS NULL OR p_section !~ '^(?:[1-9]|1[0-5])$') THEN RAISE EXCEPTION 'validation_error: select section 1 to 15'; END IF;
 IF k='lecture' AND p_section IS NOT NULL THEN RAISE EXCEPTION 'validation_error: lecture applies to all sections'; END IF;
 IF length(trim(p_title)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'validation_error: title'; END IF;
 INSERT INTO public.lectures(subject_id,title,created_by,kind,section,duration_minutes)
 VALUES(p_subject_id,trim(p_title),c.id,k,p_section,60) RETURNING * INTO r;
 INSERT INTO public.system_logs(actor_id,action) VALUES(c.id,'create_academic_unit: '||r.id||' '||k);
 RETURN r;
END;
$$;
DROP FUNCTION public.create_lecture(uuid,text);
CREATE FUNCTION public.create_lecture(p_subject_id uuid,p_title text DEFAULT 'محاضرة',p_kind text DEFAULT NULL,p_section text DEFAULT NULL)
RETURNS public.lectures LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.academic_create_unit(p_subject_id,p_title,p_kind,p_section); $$;
REVOKE ALL ON FUNCTION private.academic_create_unit(uuid,text,text,text),public.create_lecture(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.academic_create_unit(uuid,text,text,text),public.create_lecture(uuid,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION private.attendance_create_lecture(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.guard_academic_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.lectures; c public.users; k text;
BEGIN
 -- Backend maintenance uses service-role or the database owner; client workers retain auth.uid().
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 c:=private.get_caller_user();
 IF NEW.lecture_id IS NOT NULL THEN
   SELECT * INTO l FROM public.lectures WHERE id=NEW.lecture_id;
   IF NOT FOUND OR l.subject_id<>NEW.subject_id THEN RAISE EXCEPTION 'validation_error: invalid academic unit'; END IF;
   k:=l.kind;
   IF l.section IS NOT NULL AND NEW.section IS NOT NULL AND NEW.section<>l.section THEN RAISE EXCEPTION 'validation_error: section mismatch'; END IF;
   IF k='section' THEN NEW.section:=COALESCE(l.section,NEW.section);
   ELSE IF NEW.section IS NOT NULL AND NEW.section NOT IN ('','عام','all') THEN RAISE EXCEPTION 'validation_error: lecture has no section filter'; END IF; NEW.section:=NULL; END IF;
 ELSE
   k:=CASE WHEN NEW.section IS NULL OR NEW.section IN ('','عام','all') THEN 'lecture' ELSE 'section' END;
 END IF;
 IF NOT COALESCE(private.can_manage_unit(NEW.subject_id,k),false) THEN RAISE EXCEPTION 'permission_denied: academic session type'; END IF;
 IF k='section' AND (TG_OP='INSERT' OR NEW.section IS DISTINCT FROM OLD.section) AND (NEW.section IS NULL OR NEW.section !~ '^(?:[1-9]|1[0-5])$') THEN RAISE EXCEPTION 'validation_error: section 1 to 15 required'; END IF;
 IF NEW.lecture_id IS NOT NULL AND l.section IS NOT NULL AND NEW.section<>l.section THEN RAISE EXCEPTION 'validation_error: section mismatch'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_academic_session() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_academic_session_kind BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION private.guard_academic_session();

-- One explicitly scoped schedule per department and academic year.
CREATE TABLE public.academic_schedule_settings(
 department text NOT NULL, academic_year text NOT NULL,
 semester_start date, week_start_day integer NOT NULL DEFAULT 5 CHECK(week_start_day BETWEEN 0 AND 6),
 days_off integer[] NOT NULL DEFAULT '{}' CHECK(days_off <@ ARRAY[0,1,2,3,4,5,6]),
 start_time time NOT NULL DEFAULT '09:00', slot_minutes integer NOT NULL DEFAULT 60 CHECK(slot_minutes=60),
 section_count integer NOT NULL DEFAULT 15 CHECK(section_count=15),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(department,academic_year)
);
CREATE TABLE public.academic_schedule_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department text NOT NULL,academic_year text NOT NULL,
 section integer NOT NULL CHECK(section BETWEEN 1 AND 15),day_index integer NOT NULL CHECK(day_index BETWEEN 0 AND 6),
 period integer NOT NULL CHECK(period BETWEEN 1 AND 11),subject_id uuid NOT NULL REFERENCES public.subjects(id),
 instructor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,instructor_name text NOT NULL DEFAULT '',
 kind text NOT NULL CHECK(kind IN ('lecture','section')),week_pattern integer NOT NULL DEFAULT 0 CHECK(week_pattern IN(0,1,2)),
 room text NOT NULL DEFAULT '',uses_rotation boolean NOT NULL DEFAULT false,lab_room text NOT NULL DEFAULT '',hall_room text NOT NULL DEFAULT '',
 lab_week integer NOT NULL DEFAULT 1 CHECK(lab_week IN(1,2)),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(department,academic_year,section,day_index,period,week_pattern),
 CHECK(NOT uses_rotation OR (kind='section' AND length(trim(lab_room))>0 AND length(trim(hall_room))>0))
);
CREATE INDEX academic_schedule_subject_idx ON public.academic_schedule_entries(subject_id);
CREATE INDEX academic_schedule_instructor_idx ON public.academic_schedule_entries(instructor_id);
ALTER TABLE public.academic_schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_schedule_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academic_schedule_settings,public.academic_schedule_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.academic_schedule_settings,public.academic_schedule_entries TO authenticated;
GRANT ALL ON public.academic_schedule_settings,public.academic_schedule_entries TO service_role;

CREATE OR REPLACE FUNCTION private.academic_scope(p_department text,p_year text,p_write boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.users; d text; y text;
BEGIN
 c:=private.get_caller_user();
 IF auth.uid() IS NULL OR c.id IS NULL THEN RAISE EXCEPTION 'permission_denied: sign in'; END IF;
 d:=COALESCE(NULLIF(p_department,''),c.department); y:=COALESCE(NULLIF(p_year,''),c.academic_year,'1');
 IF d IS NULL OR d NOT IN ('cybersecurity','ai','data_science','mechatronics','autotronics','control_systems','garments') OR y NOT IN ('1','2','3','4') THEN RAISE EXCEPTION 'validation_error: department and year'; END IF;
 IF c.role<>'owner' AND c.department IS DISTINCT FROM d THEN RAISE EXCEPTION 'permission_denied: another department'; END IF;
 IF c.role='student' AND c.academic_year IS DISTINCT FROM y THEN RAISE EXCEPTION 'permission_denied: another academic year'; END IF;
 IF p_write AND c.role NOT IN ('owner','coordinator') THEN RAISE EXCEPTION 'permission_denied: schedule management'; END IF;
 RETURN jsonb_build_object('department',d,'academic_year',y,'can_edit',c.role IN ('owner','coordinator'),'student_section',CASE WHEN c.role='student' THEN c.section_number::text ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION private.academic_scope(text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.academic_scope(text,text,boolean) TO authenticated;
CREATE POLICY academic_settings_read ON public.academic_schedule_settings FOR SELECT TO authenticated USING
 ((private.get_current_user_role()='owner') OR (department=(private.get_caller_user()).department AND ((private.get_current_user_role()<>'student') OR academic_year=(private.get_caller_user()).academic_year)));
CREATE POLICY academic_entries_read ON public.academic_schedule_entries FOR SELECT TO authenticated USING
 ((private.get_current_user_role()='owner') OR (department=(private.get_caller_user()).department AND ((private.get_current_user_role()<>'student') OR academic_year=(private.get_caller_user()).academic_year)));

CREATE OR REPLACE FUNCTION private.academic_get_schedule(p_department text,p_year text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; settings jsonb; entries jsonb; subjects jsonb; instructors jsonb;
BEGIN
 sc:=private.academic_scope(p_department,p_year);d:=sc->>'department';y:=sc->>'academic_year';
 SELECT to_jsonb(s) INTO settings FROM public.academic_schedule_settings s WHERE s.department=d AND s.academic_year=y;
 SELECT COALESCE(jsonb_agg(to_jsonb(e)||jsonb_build_object('subject_name',s.name) ORDER BY e.section,e.day_index,e.period),'[]') INTO entries
 FROM public.academic_schedule_entries e JOIN public.subjects s ON s.id=e.subject_id WHERE e.department=d AND e.academic_year=y;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.name),'[]') INTO subjects FROM public.subjects s WHERE s.department=d AND s.academic_year=y;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name,'role',u.role,'subjects',
 (SELECT COALESCE(jsonb_agg(x.sid),'[]') FROM (SELECT u.subject_id sid WHERE u.subject_id IS NOT NULL UNION SELECT us.subject_id FROM public.user_subjects us WHERE us.user_id=u.id) x)) ORDER BY u.full_name),'[]')
 INTO instructors FROM public.users u WHERE u.department=d AND u.role IN ('doctor','ta');
 RETURN sc||jsonb_build_object('settings',COALESCE(settings,jsonb_build_object('department',d,'academic_year',y,'semester_start',NULL,'week_start_day',5,'days_off','[]'::jsonb,'start_time','09:00:00','slot_minutes',60,'section_count',15)),
 'entries',entries,'subjects',subjects,'instructors',instructors);
END;
$$;
CREATE FUNCTION public.get_academic_schedule(p_department text DEFAULT NULL,p_year text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.academic_get_schedule(p_department,p_year);$$;

CREATE OR REPLACE FUNCTION private.academic_save_settings(p_department text,p_year text,p_settings jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; BEGIN
 sc:=private.academic_scope(p_department,p_year,true);
 INSERT INTO public.academic_schedule_settings(department,academic_year,semester_start,week_start_day,start_time,days_off)
 VALUES(sc->>'department',sc->>'academic_year',NULLIF(p_settings->>'semester_start','')::date,(p_settings->>'week_start_day')::integer,(p_settings->>'start_time')::time,
 ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_settings->'days_off','[]'))::integer))
 ON CONFLICT(department,academic_year) DO UPDATE SET semester_start=EXCLUDED.semester_start,week_start_day=EXCLUDED.week_start_day,start_time=EXCLUDED.start_time,days_off=EXCLUDED.days_off,updated_at=now();
 END; $$;
CREATE FUNCTION public.save_academic_settings(p_department text,p_year text,p_settings jsonb)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.academic_save_settings(p_department,p_year,p_settings);$$;

CREATE OR REPLACE FUNCTION private.academic_save_entry(p_department text,p_year text,p_entry jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; r public.academic_schedule_entries; saved uuid; instructor public.users;
BEGIN
 sc:=private.academic_scope(p_department,p_year,true);d:=sc->>'department';y:=sc->>'academic_year';
 r:=jsonb_populate_record(NULL::public.academic_schedule_entries,p_entry);r.id:=COALESCE(r.id,gen_random_uuid());
 IF r.department IS NOT NULL AND r.department<>d OR r.academic_year IS NOT NULL AND r.academic_year<>y THEN RAISE EXCEPTION 'permission_denied: entry scope'; END IF;
 IF EXISTS(SELECT 1 FROM public.academic_schedule_entries WHERE id=r.id AND (department<>d OR academic_year<>y)) THEN RAISE EXCEPTION 'permission_denied: entry scope'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subjects s WHERE s.id=r.subject_id AND s.department=d AND s.academic_year=y) THEN RAISE EXCEPTION 'validation_error: subject scope'; END IF;
 IF r.instructor_id IS NOT NULL THEN
 SELECT * INTO instructor FROM public.users WHERE id=r.instructor_id;
 IF NOT FOUND OR instructor.department IS DISTINCT FROM d OR NOT ((instructor.role='doctor' AND r.kind='lecture') OR (instructor.role='ta' AND r.kind='section'))
 OR NOT (instructor.subject_id=r.subject_id OR EXISTS(SELECT 1 FROM public.user_subjects us WHERE us.user_id=instructor.id AND us.subject_id=r.subject_id)) THEN RAISE EXCEPTION 'validation_error: instructor assignment'; END IF;
 r.instructor_name:=instructor.full_name;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(d||':'||y,0));
 IF EXISTS(SELECT 1 FROM public.academic_schedule_entries e WHERE e.department=d AND e.academic_year=y AND e.section=r.section AND e.day_index=r.day_index AND e.period=r.period AND e.id<>r.id
 AND (e.week_pattern=0 OR COALESCE(r.week_pattern,0)=0 OR e.week_pattern=r.week_pattern)) THEN RAISE EXCEPTION 'conflict: this section already has a class at this time'; END IF;
 IF r.instructor_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.academic_schedule_entries e WHERE e.instructor_id=r.instructor_id AND e.day_index=r.day_index AND e.period=r.period AND e.id<>r.id
 AND (e.week_pattern=0 OR COALESCE(r.week_pattern,0)=0 OR e.week_pattern=r.week_pattern) AND (r.kind<>'lecture' OR e.kind<>'lecture' OR e.subject_id<>r.subject_id OR e.room IS DISTINCT FROM r.room)) THEN RAISE EXCEPTION 'conflict: instructor has another class'; END IF;
 INSERT INTO public.academic_schedule_entries(id,department,academic_year,section,day_index,period,subject_id,instructor_id,instructor_name,kind,week_pattern,room,uses_rotation,lab_room,hall_room,lab_week)
 VALUES(r.id,d,y,r.section,r.day_index,r.period,r.subject_id,r.instructor_id,COALESCE(r.instructor_name,''),r.kind,COALESCE(r.week_pattern,0),COALESCE(r.room,''),COALESCE(r.uses_rotation,false),COALESCE(r.lab_room,''),COALESCE(r.hall_room,''),COALESCE(r.lab_week,1))
 ON CONFLICT(id) DO UPDATE SET section=EXCLUDED.section,day_index=EXCLUDED.day_index,period=EXCLUDED.period,subject_id=EXCLUDED.subject_id,instructor_id=EXCLUDED.instructor_id,instructor_name=EXCLUDED.instructor_name,
 kind=EXCLUDED.kind,week_pattern=EXCLUDED.week_pattern,room=EXCLUDED.room,uses_rotation=EXCLUDED.uses_rotation,lab_room=EXCLUDED.lab_room,hall_room=EXCLUDED.hall_room,lab_week=EXCLUDED.lab_week,updated_at=now() RETURNING id INTO saved;
 RETURN saved;
END; $$;
CREATE FUNCTION public.save_academic_entry(p_department text,p_year text,p_entry jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.academic_save_entry(p_department,p_year,p_entry);$$;
CREATE OR REPLACE FUNCTION private.academic_delete_entry(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.academic_schedule_entries; BEGIN
 SELECT * INTO e FROM public.academic_schedule_entries WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found: schedule entry'; END IF;
 PERFORM private.academic_scope(e.department,e.academic_year,true);
 DELETE FROM public.academic_schedule_entries WHERE id=p_id;
END; $$;
CREATE FUNCTION public.delete_academic_entry(p_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.academic_delete_entry(p_id);$$;

REVOKE ALL ON FUNCTION private.academic_get_schedule(text,text),public.get_academic_schedule(text,text),private.academic_save_settings(text,text,jsonb),public.save_academic_settings(text,text,jsonb),private.academic_save_entry(text,text,jsonb),public.save_academic_entry(text,text,jsonb),private.academic_delete_entry(uuid),public.delete_academic_entry(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.academic_get_schedule(text,text),public.get_academic_schedule(text,text),private.academic_save_settings(text,text,jsonb),public.save_academic_settings(text,text,jsonb),private.academic_save_entry(text,text,jsonb),public.save_academic_entry(text,text,jsonb),private.academic_delete_entry(uuid),public.delete_academic_entry(uuid) TO authenticated;

-- Verified credentials are private and can only be created/updated by the server.
DROP POLICY IF EXISTS webauthn_read_policy ON public.webauthn_credentials;
DROP POLICY IF EXISTS webauthn_auth_manage ON public.webauthn_credentials;
REVOKE ALL ON public.webauthn_credentials FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.webauthn_credentials TO authenticated;
CREATE POLICY webauthn_own_read ON public.webauthn_credentials FOR SELECT TO authenticated USING(auth_id=(SELECT auth.uid()));
CREATE POLICY webauthn_own_delete ON public.webauthn_credentials FOR DELETE TO authenticated USING(auth_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION private.limit_passkey_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.auth_id::text,0));
 IF (SELECT count(*) FROM public.webauthn_credentials WHERE auth_id=NEW.auth_id AND credential_id<>NEW.credential_id)>=2 THEN RAISE EXCEPTION 'validation_error: two passkeys maximum'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.limit_passkey_count() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_passkey_limit BEFORE INSERT ON public.webauthn_credentials FOR EACH ROW EXECUTE FUNCTION private.limit_passkey_count();

CREATE FUNCTION private.academic_import_entries(p_department text,p_year text,p_entries jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; item jsonb; existing uuid; n integer:=0;
BEGIN
 sc:=private.academic_scope(p_department,p_year,true);
 IF jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 1200 THEN RAISE EXCEPTION 'validation_error: import size'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended((sc->>'department')||':'||(sc->>'academic_year'),0));
 FOR item IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
 SELECT id INTO existing FROM public.academic_schedule_entries WHERE department=sc->>'department' AND academic_year=sc->>'academic_year'
 AND section=(item->>'section')::integer AND day_index=(item->>'day_index')::integer AND period=(item->>'period')::integer AND week_pattern=COALESCE((item->>'week_pattern')::integer,0);
 item:=item-'id';IF existing IS NOT NULL THEN item:=item||jsonb_build_object('id',existing);END IF;
 PERFORM private.academic_save_entry(sc->>'department',sc->>'academic_year',item); n:=n+1;
 END LOOP;
 INSERT INTO public.system_logs(actor_id,action) VALUES((private.get_caller_user()).id,'import_academic_schedule: '||n||' '||(sc->>'department'));
 RETURN n;
END; $$;
CREATE FUNCTION public.import_academic_entries(p_department text,p_year text,p_entries jsonb) RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.academic_import_entries(p_department,p_year,p_entries); $$;
REVOKE ALL ON FUNCTION private.academic_import_entries(text,text,jsonb),public.import_academic_entries(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.academic_import_entries(text,text,jsonb),public.import_academic_entries(text,text,jsonb) TO authenticated;

ALTER TABLE public.exam_schedules ADD COLUMN department text NOT NULL DEFAULT 'cybersecurity';
ALTER TABLE public.exam_schedules ADD COLUMN academic_year text NOT NULL DEFAULT '1';
CREATE INDEX academic_exams_scope_idx ON public.exam_schedules(department,academic_year);
REVOKE ALL ON public.exam_schedules FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.exam_schedules TO authenticated;
CREATE POLICY academic_exams_scope ON public.exam_schedules AS RESTRICTIVE FOR SELECT TO authenticated USING
 ((private.get_current_user_role()='owner') OR (department=(private.get_caller_user()).department AND ((private.get_current_user_role()<>'student') OR academic_year=(private.get_caller_user()).academic_year)));
CREATE FUNCTION private.academic_save_exam(p_department text,p_year text,p_exam jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; saved uuid; BEGIN
 sc:=private.academic_scope(p_department,p_year,true);
 IF p_exam->>'exam_type' NOT IN ('midterm','final') OR length(trim(p_exam->>'title')) NOT BETWEEN 1 AND 200 OR COALESCE(p_exam->>'file_url','') !~ '^https://clfhllujvxhfvhenvwfz\.supabase\.co/storage/v1/object/public/exam-files/' THEN RAISE EXCEPTION 'validation_error: exam file'; END IF;
 IF p_exam->>'section' IS NOT NULL AND (p_exam->>'section') !~ '^(?:[1-9]|1[0-5])$' THEN RAISE EXCEPTION 'validation_error: exam section'; END IF;
 IF (p_exam->>'file_url') NOT LIKE '%/exam-files/'||(sc->>'department')||'/'||(sc->>'academic_year')||'/%' THEN RAISE EXCEPTION 'permission_denied: exam path'; END IF;
 INSERT INTO public.exam_schedules(title,exam_type,file_url,file_name,section,department,academic_year)
 VALUES(p_exam->>'title',p_exam->>'exam_type',p_exam->>'file_url',p_exam->>'file_name',p_exam->>'section',sc->>'department',sc->>'academic_year') RETURNING id INTO saved;
 RETURN saved;
END; $$;
CREATE FUNCTION public.save_academic_exam(p_department text,p_year text,p_exam jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.academic_save_exam(p_department,p_year,p_exam);$$;
CREATE FUNCTION private.academic_delete_exam(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.exam_schedules; BEGIN SELECT * INTO e FROM public.exam_schedules WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found: exam'; END IF;
 PERFORM private.academic_scope(e.department,e.academic_year,true);
 DELETE FROM public.exam_schedules WHERE id=p_id;
END; $$;
CREATE FUNCTION public.delete_academic_exam(p_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.academic_delete_exam(p_id);$$;
REVOKE ALL ON FUNCTION private.academic_save_exam(text,text,jsonb),public.save_academic_exam(text,text,jsonb),private.academic_delete_exam(uuid),public.delete_academic_exam(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.academic_save_exam(text,text,jsonb),public.save_academic_exam(text,text,jsonb),private.academic_delete_exam(uuid),public.delete_academic_exam(uuid) TO authenticated;
DROP POLICY IF EXISTS "Authenticated Upload exam-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete exam-files" ON storage.objects;
CREATE POLICY academic_exam_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='exam-files' AND
 ((private.get_current_user_role()='owner') OR (private.get_current_user_role()='coordinator' AND (storage.foldername(name))[1]=(private.get_caller_user()).department)));
CREATE POLICY academic_exam_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='exam-files' AND
 ((private.get_current_user_role()='owner') OR (private.get_current_user_role()='coordinator' AND (storage.foldername(name))[1]=(private.get_caller_user()).department)));

CREATE POLICY coordinator_join_scope ON public.join_requests AS RESTRICTIVE FOR SELECT TO authenticated USING
 (private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND department=(private.get_caller_user()).department AND role NOT IN ('owner','coordinator')));
CREATE POLICY coordinator_device_scope ON public.device_locks AS RESTRICTIVE FOR ALL TO authenticated USING
 (student_auth_id=(SELECT auth.uid()) OR private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND EXISTS(SELECT 1 FROM public.users u WHERE u.auth_id=student_auth_id AND u.department=(private.get_caller_user()).department AND u.role='student')))
 WITH CHECK(student_auth_id=(SELECT auth.uid()) OR private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND EXISTS(SELECT 1 FROM public.users u WHERE u.auth_id=student_auth_id AND u.department=(private.get_caller_user()).department AND u.role='student')));

ALTER TABLE public.webauthn_challenges ADD COLUMN purpose text NOT NULL DEFAULT 'login' CHECK(purpose IN ('registration','login','attendance','verify'));
UPDATE public.webauthn_challenges SET purpose=CASE WHEN type='registration' THEN 'registration' WHEN attendance_hash IS NOT NULL THEN 'attendance' ELSE 'login' END;

DROP FUNCTION public.fetch_lectures(uuid);
CREATE FUNCTION public.fetch_lectures(p_subject_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,subject_id uuid,title text,lecture_date date,created_by uuid,created_at timestamptz,subject_name text,session_count bigint,attendee_count bigint,is_ended boolean,kind text,section text,duration_minutes integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT l.id,l.subject_id,l.title,l.lecture_date,l.created_by,l.created_at,s.name,count(DISTINCT se.id),count(DISTINCT a.student_id),COALESCE(bool_and(se.expires_at<=now()),true),l.kind,l.section,l.duration_minutes
 FROM public.lectures l JOIN public.subjects s ON s.id=l.subject_id LEFT JOIN public.sessions se ON se.lecture_id=l.id LEFT JOIN public.attendance a ON a.session_id=se.id
 WHERE (p_subject_id IS NULL OR l.subject_id=p_subject_id) AND (private.can_manage_unit(l.subject_id,l.kind) OR (private.get_current_user_role()='student'))
 GROUP BY l.id,s.name ORDER BY l.lecture_date DESC,l.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.fetch_lectures(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fetch_lectures(uuid) TO authenticated;

CREATE FUNCTION private.guard_academic_unit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target public.lectures; BEGIN
 target:=CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 IF auth.uid() IS NOT NULL AND NOT COALESCE(private.can_manage_unit(target.subject_id,target.kind),false) THEN RAISE EXCEPTION 'permission_denied: academic unit type'; END IF;
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL AND NOT COALESCE(private.can_manage_unit(OLD.subject_id,OLD.kind),false) THEN RAISE EXCEPTION 'permission_denied: original academic unit'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_academic_unit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_academic_unit_kind BEFORE INSERT OR UPDATE OR DELETE ON public.lectures FOR EACH ROW EXECUTE FUNCTION private.guard_academic_unit();

CREATE FUNCTION private.can_view_academic_unit(p_subject uuid,p_kind text,p_section text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.can_manage_unit(p_subject,p_kind) OR EXISTS(SELECT 1 FROM public.users u JOIN public.subjects s ON s.id=p_subject
 WHERE u.auth_id=auth.uid() AND u.role='student' AND (s.department IS NULL OR u.department=s.department) AND (s.academic_year IS NULL OR u.academic_year=s.academic_year)
 AND (p_kind='lecture' OR p_section IS NULL OR regexp_replace(p_section,'[^0-9]','','g')=u.section_number::text));
$$;
REVOKE ALL ON FUNCTION private.can_view_academic_unit(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_view_academic_unit(uuid,text,text) TO authenticated;
DROP POLICY lectures_select_consolidated ON public.lectures;
CREATE POLICY lectures_select_consolidated ON public.lectures FOR SELECT TO authenticated USING(private.can_view_academic_unit(subject_id,kind,section));
DROP POLICY sessions_select_consolidated ON public.sessions;
CREATE POLICY sessions_select_consolidated ON public.sessions FOR SELECT TO authenticated USING(private.can_view_academic_unit(subject_id,
 COALESCE((SELECT l.kind FROM public.lectures l WHERE l.id=lecture_id),CASE WHEN section IS NULL OR section IN ('','عام') THEN 'lecture' ELSE 'section' END),section));

CREATE POLICY coordinator_join_update_scope ON public.join_requests AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND department=(private.get_caller_user()).department AND role NOT IN ('owner','coordinator')))
 WITH CHECK(private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND department=(private.get_caller_user()).department AND role NOT IN ('owner','coordinator')));
CREATE POLICY coordinator_join_delete_scope ON public.join_requests AS RESTRICTIVE FOR DELETE TO authenticated
 USING(private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND department=(private.get_caller_user()).department AND role NOT IN ('owner','coordinator')));

CREATE FUNCTION private.guard_manual_unit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE se public.sessions; k text; BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE((NEW.metadata->>'manual')::boolean,false) THEN RETURN NEW; END IF;
 SELECT * INTO se FROM public.sessions WHERE id=NEW.session_id;
 SELECT kind INTO k FROM public.lectures WHERE id=se.lecture_id;
 k:=COALESCE(k,CASE WHEN se.section IS NULL THEN 'lecture' ELSE 'section' END);
 IF NOT COALESCE(private.can_manage_unit(se.subject_id,k),false) THEN RAISE EXCEPTION 'permission_denied: manual attendance unit'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_manual_unit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_manual_unit_kind BEFORE INSERT ON public.attendance FOR EACH ROW EXECUTE FUNCTION private.guard_manual_unit();

CREATE FUNCTION private.can_manage_academic_session(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sessions se LEFT JOIN public.lectures l ON l.id=se.lecture_id WHERE se.id=p_id
 AND private.can_manage_unit(se.subject_id,COALESCE(l.kind,CASE WHEN se.section IS NULL OR se.section IN ('','عام') THEN 'lecture' ELSE 'section' END)));
$$;
REVOKE ALL ON FUNCTION private.can_manage_academic_session(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_manage_academic_session(uuid) TO authenticated;
DROP POLICY attendance_select_consolidated ON public.attendance;
CREATE POLICY attendance_select_consolidated ON public.attendance FOR SELECT TO authenticated USING
 (student_id=(private.get_caller_user()).id OR private.can_manage_academic_session(session_id));

CREATE OR REPLACE FUNCTION private.attendance_register()
 RETURNS TABLE(unit_id uuid, lecture_id uuid, subject_id uuid, subject_name text, title text, lecture_date date, student_id uuid, student_name text, status text, submitted_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT COALESCE(se.lecture_id,se.id),se.lecture_id,se.subject_id,s.name,
 COALESCE(l.title,s.name),COALESCE(l.lecture_date,se.created_at::date),u.id,u.full_name,
 CASE WHEN COUNT(a.id)>0 THEN 'present' WHEN BOOL_OR(se.expires_at>now()) THEN 'pending' ELSE 'absent' END,
 MIN(a.created_at)
 FROM public.session_roster r JOIN public.sessions se ON se.id=r.session_id
 JOIN public.subjects s ON s.id=se.subject_id JOIN public.users u ON u.id=r.student_id
 LEFT JOIN public.lectures l ON l.id=se.lecture_id
 LEFT JOIN public.attendance a ON a.session_id=se.id AND a.student_id=u.id
 WHERE auth.uid() IS NOT NULL AND (u.auth_id=auth.uid() OR private.can_manage_unit(se.subject_id,COALESCE(l.kind,CASE WHEN se.section IS NULL OR se.section IN ('','عام') THEN 'lecture' ELSE 'section' END)))
 GROUP BY COALESCE(se.lecture_id,se.id),se.lecture_id,se.subject_id,s.name,COALESCE(l.title,s.name),
 COALESCE(l.lecture_date,se.created_at::date),u.id,u.full_name;
$function$;
