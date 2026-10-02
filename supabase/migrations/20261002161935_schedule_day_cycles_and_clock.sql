-- Owner-controlled alternation, dated exceptions and an authoritative clock.
CREATE TABLE private.academic_cycle_controls (
 department text NOT NULL, academic_year text NOT NULL CHECK(academic_year IN ('1','2','3','4')),
 anchor_date date NOT NULL, anchor_cycle integer NOT NULL CHECK(anchor_cycle IN (1,2)),
 PRIMARY KEY(department,academic_year)
);
CREATE TABLE private.academic_day_cycles (
 department text NOT NULL, academic_year text NOT NULL CHECK(academic_year IN ('1','2','3','4')),
 on_date date NOT NULL, cycle integer NOT NULL CHECK(cycle IN (1,2)),
 PRIMARY KEY(department,academic_year,on_date)
);
ALTER TABLE private.academic_cycle_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.academic_day_cycles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.academic_cycle_controls,private.academic_day_cycles FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.academic_cycle_controls,private.academic_day_cycles TO service_role;
CREATE FUNCTION private.academic_cycle_read(p_department text,p_year text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; BEGIN
 sc:=private.academic_scope(p_department,p_year);d:=sc->>'department';y:=sc->>'academic_year';
 RETURN jsonb_build_object('anchor',(SELECT jsonb_build_object('date',anchor_date,'cycle',anchor_cycle) FROM private.academic_cycle_controls WHERE department=d AND academic_year=y),
 'days',(SELECT COALESCE(jsonb_object_agg(on_date::text,cycle),'{}') FROM private.academic_day_cycles WHERE department=d AND academic_year=y));
END; $$;
CREATE FUNCTION private.academic_cycle_write(p_department text,p_year text,p_date date,p_cycle integer,p_scope text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; c public.users; BEGIN
 sc:=private.academic_scope(p_department,p_year,true); c:=private.get_caller_user();
 IF c.role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'permission_denied: owner only'; END IF;
 IF p_date IS NULL OR p_scope IS NULL OR p_scope NOT IN ('week','day') OR (p_cycle IS NOT NULL AND p_cycle NOT IN (1,2)) THEN RAISE EXCEPTION 'validation_error: cycle'; END IF;
 d:=sc->>'department';y:=sc->>'academic_year';
 PERFORM pg_advisory_xact_lock(hashtextextended(d||':'||y,0));
 IF p_scope='week' THEN
  IF p_cycle IS NULL THEN DELETE FROM private.academic_cycle_controls WHERE department=d AND academic_year=y;
  ELSE INSERT INTO private.academic_cycle_controls VALUES(d,y,p_date,p_cycle) ON CONFLICT(department,academic_year) DO UPDATE SET anchor_date=EXCLUDED.anchor_date,anchor_cycle=EXCLUDED.anchor_cycle; END IF;
 ELSE
  IF p_cycle IS NULL THEN DELETE FROM private.academic_day_cycles WHERE department=d AND academic_year=y AND on_date=p_date;
  ELSE INSERT INTO private.academic_day_cycles VALUES(d,y,p_date,p_cycle) ON CONFLICT(department,academic_year,on_date) DO UPDATE SET cycle=EXCLUDED.cycle; END IF;
 END IF;
 INSERT INTO public.system_logs(actor_id,action) VALUES(c.id,'academic_cycle: '||d||'/'||y||' '||p_scope||' '||p_date||' '||COALESCE(p_cycle::text,'auto'));
END; $$;
CREATE FUNCTION public.save_academic_cycle(p_department text,p_year text,p_date date,p_cycle integer,p_scope text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.academic_cycle_write(p_department,p_year,p_date,p_cycle,p_scope); $$;
CREATE FUNCTION public.academic_clock() RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT clock_timestamp(); $$;
CREATE OR REPLACE FUNCTION public.get_academic_schedule(p_department text DEFAULT NULL,p_year text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT private.academic_get_schedule(p_department,p_year)||jsonb_build_object('revision',private.academic_schedule_revision(p_department,p_year),'cycles',private.academic_cycle_read(p_department,p_year),'server_time',now());
$$;
REVOKE ALL ON FUNCTION private.academic_cycle_read(text,text),private.academic_cycle_write(text,text,date,integer,text),public.save_academic_cycle(text,text,date,integer,text),public.academic_clock() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.academic_cycle_read(text,text),private.academic_cycle_write(text,text,date,integer,text),public.save_academic_cycle(text,text,date,integer,text),public.academic_clock() TO authenticated;

CREATE OR REPLACE FUNCTION private.academic_replace_schedule(p_department text,p_year text,p_entries jsonb,p_expected_revision text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sc jsonb; d text; y text; item jsonb; source_time text; n integer:=0;
BEGIN
 sc:=private.academic_scope(p_department,p_year,true); d:=sc->>'department'; y:=sc->>'academic_year';
 IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 1200 THEN RAISE EXCEPTION 'validation_error: import size'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(d||':'||y,0));
 IF p_expected_revision IS NULL OR p_expected_revision IS DISTINCT FROM private.academic_schedule_revision(d,y) THEN RAISE EXCEPTION 'schedule_changed: reload and review latest schedule'; END IF;
 source_time:=p_entries->0->>'source_start_time';
 IF source_time IS NOT NULL THEN
  IF source_time !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_entries) v WHERE v->>'source_start_time' IS DISTINCT FROM source_time) THEN RAISE EXCEPTION 'validation_error: source time'; END IF;
  INSERT INTO public.academic_schedule_settings(department,academic_year,start_time) VALUES(d,y,source_time::time)
  ON CONFLICT(department,academic_year) DO UPDATE SET start_time=EXCLUDED.start_time,updated_at=now();
 END IF;
 DELETE FROM public.academic_schedule_entries WHERE department=d AND academic_year=y;
 FOR item IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
  -- Incoming workbook identifiers cannot update an entry in another scope.
  PERFORM private.academic_save_entry(d,y,item-'id'-'department'-'academic_year');
  n:=n+1;
 END LOOP;
 -- First publication starts a predictable weekly alternation, adjustable by the owner.
 INSERT INTO private.academic_cycle_controls(department,academic_year,anchor_date,anchor_cycle)
 SELECT d,y,(now() AT TIME ZONE 'Africa/Cairo')::date,1
 WHERE NOT EXISTS(SELECT 1 FROM public.academic_schedule_settings WHERE department=d AND academic_year=y AND semester_start IS NOT NULL)
 ON CONFLICT(department,academic_year) DO NOTHING;
 INSERT INTO public.system_logs(actor_id,action) VALUES((private.get_caller_user()).id,'replace_academic_schedule: '||d||'/'||y||' '||n);
 RETURN n;
END; $$;
