CREATE OR REPLACE FUNCTION public.get_attendance_summary(p_sections text[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
 WITH register AS (SELECT r.* FROM private.attendance_register() r WHERE p_sections IS NULL OR EXISTS
  (SELECT 1 FROM public.sessions se WHERE COALESCE(se.lecture_id,se.id)=r.unit_id AND se.section=ANY(p_sections))),
 summary AS (SELECT COUNT(DISTINCT unit_id) total,COUNT(DISTINCT student_id) students,
 COUNT(*) FILTER(WHERE status='present') present,COUNT(*) FILTER(WHERE status='absent') absent,
 COUNT(*) FILTER(WHERE status='pending') pending FROM register),
 subjects AS (SELECT subject_id,subject_name,COUNT(DISTINCT unit_id) total,
 COUNT(*) FILTER(WHERE status='present') present,COUNT(*) FILTER(WHERE status='absent') absent
 FROM register GROUP BY subject_id,subject_name)
 SELECT jsonb_build_object('dashboard',jsonb_build_object('totalSessions',total,'totalStudents',students,
 'activeSessions',(SELECT COUNT(*) FROM public.sessions WHERE expires_at>now()),
 'attendanceRate',CASE WHEN present+absent=0 THEN 0 ELSE 100.0*present/(present+absent) END,
 'pendingSubmissions',pending,'completedOpportunities',present+absent,'absenceRate',CASE WHEN present+absent=0 THEN 0 ELSE 100.0*absent/(present+absent) END),'subjects',COALESCE((SELECT jsonb_agg(jsonb_build_object('subjectName',subject_name,
 'totalSessions',total,'attendanceRate',CASE WHEN present+absent=0 THEN 0 ELSE 100.0*present/(present+absent) END)
 ORDER BY subject_name) FROM subjects),'[]'::jsonb)) FROM summary;
$$;
REVOKE ALL ON FUNCTION public.get_attendance_summary(text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION private.record_manual_attendance(p_student_id uuid,p_session_id uuid,p_reason text)
RETURNS public.attendance LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller public.users; record public.attendance; subject uuid;
BEGIN
 caller := private.get_caller_user(); SELECT subject_id INTO subject FROM public.sessions WHERE id=p_session_id;
 IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject(subject),false) THEN RAISE EXCEPTION 'permission_denied'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason))<3 OR length(p_reason)>500 THEN RAISE EXCEPTION 'validation_error: correction reason required'; END IF;
 INSERT INTO public.attendance(student_id,session_id,metadata)
 VALUES(p_student_id,p_session_id,jsonb_build_object('manual',true,'reason',trim(p_reason),'recorded_by',caller.id,'recorded_at',now())) RETURNING * INTO record;
 INSERT INTO public.system_logs(actor_id,action) VALUES(caller.id,'add_manual_attendance: '||p_student_id::text||' in '||p_session_id::text||': '||trim(p_reason));
 RETURN record;
END $$;
REVOKE ALL ON FUNCTION private.record_manual_attendance(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.record_manual_attendance(uuid,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.add_manual_attendance(p_student_id uuid,p_session_id uuid,p_reason text)
RETURNS public.attendance LANGUAGE sql SET search_path = '' AS $$ SELECT private.record_manual_attendance(p_student_id,p_session_id,p_reason) $$;
REVOKE ALL ON FUNCTION public.add_manual_attendance(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_manual_attendance(uuid,uuid,text) TO authenticated;
