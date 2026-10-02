-- Legacy subjects without a year remain available; no schedule rows are populated.
ALTER TABLE public.academic_schedule_settings ALTER COLUMN days_off SET DEFAULT ARRAY[4,6];
CREATE OR REPLACE FUNCTION private.academic_get_schedule(p_department text,p_year text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; settings jsonb; entries jsonb; subjects jsonb; instructors jsonb;
BEGIN
 sc:=private.academic_scope(p_department,p_year);d:=sc->>'department';y:=sc->>'academic_year';
 SELECT to_jsonb(s) INTO settings FROM public.academic_schedule_settings s WHERE s.department=d AND (s.academic_year=y OR s.academic_year IS NULL);
 SELECT COALESCE(jsonb_agg(to_jsonb(e)||jsonb_build_object('subject_name',s.name) ORDER BY e.section,e.day_index,e.period),'[]') INTO entries
 FROM public.academic_schedule_entries e JOIN public.subjects s ON s.id=e.subject_id WHERE e.department=d AND e.academic_year=y;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.name),'[]') INTO subjects FROM public.subjects s WHERE s.department=d AND s.academic_year=y;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name,'role',u.role,'subjects',
 (SELECT COALESCE(jsonb_agg(x.sid),'[]') FROM (SELECT u.subject_id sid WHERE u.subject_id IS NOT NULL UNION SELECT us.subject_id FROM public.user_subjects us WHERE us.user_id=u.id) x)) ORDER BY u.full_name),'[]')
 INTO instructors FROM public.users u WHERE u.department=d AND u.role IN ('doctor','ta');
 RETURN sc||jsonb_build_object('settings',COALESCE(settings,jsonb_build_object('department',d,'academic_year',y,'semester_start',NULL,'week_start_day',5,'days_off','[4,6]'::jsonb,'start_time','09:00:00','slot_minutes',60,'section_count',15)),
 'entries',entries,'subjects',subjects,'instructors',instructors);
END;
$$;
CREATE OR REPLACE FUNCTION private.academic_save_entry(p_department text,p_year text,p_entry jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; r public.academic_schedule_entries; saved uuid; instructor public.users;
BEGIN
 sc:=private.academic_scope(p_department,p_year,true);d:=sc->>'department';y:=sc->>'academic_year';
 r:=jsonb_populate_record(NULL::public.academic_schedule_entries,p_entry);r.id:=COALESCE(r.id,gen_random_uuid());
 IF r.department IS NOT NULL AND r.department<>d OR r.academic_year IS NOT NULL AND r.academic_year<>y THEN RAISE EXCEPTION 'permission_denied: entry scope'; END IF;
 IF EXISTS(SELECT 1 FROM public.academic_schedule_entries WHERE id=r.id AND (department<>d OR academic_year<>y)) THEN RAISE EXCEPTION 'permission_denied: entry scope'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subjects s WHERE s.id=r.subject_id AND s.department=d AND (s.academic_year=y OR s.academic_year IS NULL)) THEN RAISE EXCEPTION 'validation_error: subject scope'; END IF;
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
