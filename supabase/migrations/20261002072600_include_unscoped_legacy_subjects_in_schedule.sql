CREATE OR REPLACE FUNCTION private.academic_get_schedule(p_department text,p_year text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; settings jsonb; entries jsonb; subjects jsonb; instructors jsonb;
BEGIN
 sc:=private.academic_scope(p_department,p_year);d:=sc->>'department';y:=sc->>'academic_year';
 SELECT to_jsonb(s) INTO settings FROM public.academic_schedule_settings s WHERE s.department=d AND (s.academic_year=y OR s.academic_year IS NULL);
 SELECT COALESCE(jsonb_agg(to_jsonb(e)||jsonb_build_object('subject_name',s.name) ORDER BY e.section,e.day_index,e.period),'[]') INTO entries
 FROM public.academic_schedule_entries e JOIN public.subjects s ON s.id=e.subject_id WHERE e.department=d AND e.academic_year=y;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.name),'[]') INTO subjects FROM public.subjects s WHERE s.department=d AND (s.academic_year=y OR s.academic_year IS NULL);
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name,'role',u.role,'subjects',
 (SELECT COALESCE(jsonb_agg(x.sid),'[]') FROM (SELECT u.subject_id sid WHERE u.subject_id IS NOT NULL UNION SELECT us.subject_id FROM public.user_subjects us WHERE us.user_id=u.id) x)) ORDER BY u.full_name),'[]')
 INTO instructors FROM public.users u WHERE u.department=d AND u.role IN ('doctor','ta');
 RETURN sc||jsonb_build_object('settings',COALESCE(settings,jsonb_build_object('department',d,'academic_year',y,'semester_start',NULL,'week_start_day',5,'days_off','[4,6]'::jsonb,'start_time','09:00:00','slot_minutes',60,'section_count',15)),
 'entries',entries,'subjects',subjects,'instructors',instructors);
END;
$$;
