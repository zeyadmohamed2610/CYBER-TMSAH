-- Full, scoped replacement of a reviewed university workbook; no schedule is populated here.
CREATE FUNCTION private.academic_schedule_revision(p_department text,p_year text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; result text;
BEGIN
 sc:=private.academic_scope(p_department,p_year); d:=sc->>'department'; y:=sc->>'academic_year';
 SELECT md5(jsonb_build_object('settings',
  (SELECT to_jsonb(s) FROM public.academic_schedule_settings s WHERE s.department=d AND s.academic_year=y),
  'entries',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM public.academic_schedule_entries e WHERE e.department=d AND e.academic_year=y))::text) INTO result;
 RETURN result;
END; $$;
CREATE OR REPLACE FUNCTION public.get_academic_schedule(p_department text DEFAULT NULL,p_year text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT private.academic_get_schedule(p_department,p_year)||jsonb_build_object('revision',private.academic_schedule_revision(p_department,p_year));
$$;
CREATE FUNCTION private.academic_replace_schedule(p_department text,p_year text,p_entries jsonb,p_expected_revision text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; item jsonb; n integer:=0;
BEGIN
 sc:=private.academic_scope(p_department,p_year,true); d:=sc->>'department'; y:=sc->>'academic_year';
 IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 1200 THEN RAISE EXCEPTION 'validation_error: import size'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(d||':'||y,0));
 IF p_expected_revision IS NULL OR p_expected_revision IS DISTINCT FROM private.academic_schedule_revision(d,y) THEN RAISE EXCEPTION 'schedule_changed: reload and review latest schedule'; END IF;
 DELETE FROM public.academic_schedule_entries WHERE department=d AND academic_year=y;
 FOR item IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
  -- Incoming workbook identifiers cannot update an entry in another scope.
  PERFORM private.academic_save_entry(d,y,item-'id'-'department'-'academic_year');
  n:=n+1;
 END LOOP;
 INSERT INTO public.system_logs(actor_id,action) VALUES((private.get_caller_user()).id,'replace_academic_schedule: '||d||'/'||y||' '||n);
 RETURN n;
END; $$;
CREATE FUNCTION public.replace_academic_schedule(p_department text,p_year text,p_entries jsonb,p_expected_revision text)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.academic_replace_schedule(p_department,p_year,p_entries,p_expected_revision); $$;
REVOKE ALL ON FUNCTION private.academic_schedule_revision(text,text),private.academic_replace_schedule(text,text,jsonb,text),public.replace_academic_schedule(text,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.academic_schedule_revision(text,text),private.academic_replace_schedule(text,text,jsonb,text),public.replace_academic_schedule(text,text,jsonb,text) TO authenticated;

-- All management paths share the same scope lock as a replacement.
CREATE OR REPLACE FUNCTION private.academic_save_settings(p_department text,p_year text,p_settings jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; BEGIN
 sc:=private.academic_scope(p_department,p_year,true);
 PERFORM pg_advisory_xact_lock(hashtextextended((sc->>'department')||':'||(sc->>'academic_year'),0));
 INSERT INTO public.academic_schedule_settings(department,academic_year,semester_start,week_start_day,start_time,days_off)
 VALUES(sc->>'department',sc->>'academic_year',NULLIF(p_settings->>'semester_start','')::date,(p_settings->>'week_start_day')::integer,(p_settings->>'start_time')::time,
 ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_settings->'days_off','[]'))::integer))
 ON CONFLICT(department,academic_year) DO UPDATE SET semester_start=EXCLUDED.semester_start,week_start_day=EXCLUDED.week_start_day,start_time=EXCLUDED.start_time,days_off=EXCLUDED.days_off,updated_at=now();
END; $$;
CREATE OR REPLACE FUNCTION private.academic_delete_entry(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.academic_schedule_entries; BEGIN
 SELECT * INTO e FROM public.academic_schedule_entries WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found: schedule entry'; END IF;
 PERFORM private.academic_scope(e.department,e.academic_year,true);
 PERFORM pg_advisory_xact_lock(hashtextextended(e.department||':'||e.academic_year,0));
 DELETE FROM public.academic_schedule_entries WHERE id=p_id;
END; $$;
