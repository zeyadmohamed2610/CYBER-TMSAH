BEGIN;
CREATE OR REPLACE FUNCTION public.get_attendance_summary(p_sections text[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 WITH visible_sessions AS (
  SELECT se.* FROM public.sessions se WHERE private.current_term_visible(se.term_id)
  AND (p_sections IS NULL OR se.section=ANY(p_sections))
 ), register AS (
  SELECT r.*, NOT EXISTS(SELECT 1 FROM visible_sessions se WHERE COALESCE(se.lecture_id,se.id)=r.unit_id AND se.expires_at>now()) closed
  FROM private.attendance_register() r
  WHERE p_sections IS NULL OR EXISTS(SELECT 1 FROM visible_sessions se WHERE COALESCE(se.lecture_id,se.id)=r.unit_id)
 ), summary AS (
  SELECT COUNT(*) FILTER(WHERE closed AND status='present') present,
  COUNT(*) FILTER(WHERE closed AND status='absent') absent,
  COUNT(*) FILTER(WHERE status='pending') pending FROM register
 ), subjects AS (
  SELECT subject_id,subject_name,COUNT(DISTINCT unit_id) total,
  COUNT(*) FILTER(WHERE closed AND status='present') present,
  COUNT(*) FILTER(WHERE closed AND status='absent') absent FROM register GROUP BY subject_id,subject_name
 )
 SELECT jsonb_build_object('dashboard',jsonb_build_object(
  'totalSessions',(SELECT count(*) FROM visible_sessions),
  'totalStudents',(SELECT count(*) FROM public.users WHERE role='student' AND (p_sections IS NULL OR section_number::text=ANY(p_sections))),
  'facultyCount',(SELECT count(*) FROM public.users WHERE role IN ('doctor','ta')),
  'pendingRequests',CASE WHEN private.get_current_user_role() IN ('owner','coordinator') THEN (SELECT count(*) FROM public.join_requests WHERE status='pending') ELSE 0 END,
  'pendingFixes',CASE WHEN private.get_current_user_role() IN ('owner','coordinator') THEN (SELECT count(*) FROM public.error_reports WHERE status='pending') ELSE 0 END,
  'activeSessions',(SELECT count(*) FROM visible_sessions WHERE expires_at>now()),
  'attendanceRate',CASE WHEN present+absent=0 THEN 0 ELSE 100.0*present/(present+absent) END,
  'pendingSubmissions',pending,'completedOpportunities',present+absent,
  'absenceRate',CASE WHEN present+absent=0 THEN 0 ELSE 100.0*absent/(present+absent) END),
  'subjects',COALESCE((SELECT jsonb_agg(jsonb_build_object('subjectName',subject_name,'totalSessions',total,
  'attendanceRate',CASE WHEN present+absent=0 THEN 0 ELSE 100.0*present/(present+absent) END) ORDER BY subject_name) FROM subjects),'[]'::jsonb)) FROM summary;
$$;
REVOKE ALL ON FUNCTION public.get_attendance_summary(text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary(text[]) TO authenticated;

-- Read-only default: choose a published academic year, while students stay in their own year.
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
 IF c.role<>'owner' AND c.department IS DISTINCT FROM d THEN RAISE EXCEPTION 'permission_denied: another department'; END IF;
 IF c.role='student' AND c.academic_year IS DISTINCT FROM y THEN RAISE EXCEPTION 'permission_denied: another academic year'; END IF;
 IF p_write AND c.role NOT IN ('owner','coordinator') THEN RAISE EXCEPTION 'permission_denied: schedule management'; END IF;
 RETURN jsonb_build_object('department',d,'academic_year',y,'can_edit',c.role IN ('owner','coordinator'),'student_section',CASE WHEN c.role='student' THEN c.section_number::text ELSE NULL END);
END;
$function$;


DO $$DECLARE item text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH item IN ARRAY ARRAY['users','user_subjects','subjects','sessions','attendance','lectures','join_requests','error_reports','academic_schedule_entries','academic_schedule_settings'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=item) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',item);
   END IF;
  END LOOP;
 END IF;
END $$;
COMMIT;
