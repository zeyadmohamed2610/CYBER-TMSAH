-- A unit with no sessions has not ended. Keep caller RLS and academic scope.
CREATE OR REPLACE FUNCTION public.fetch_lectures(p_subject_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,subject_id uuid,title text,lecture_date date,created_by uuid,created_at timestamptz,subject_name text,session_count bigint,attendee_count bigint,is_ended boolean,kind text,section text,duration_minutes integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT l.id,l.subject_id,l.title,l.lecture_date,l.created_by,l.created_at,s.name,
   count(DISTINCT se.id),count(DISTINCT a.student_id),
   count(DISTINCT se.id)>0 AND COALESCE(bool_and(se.expires_at<=now()),false),
   l.kind,l.section,l.duration_minutes
 FROM public.lectures l
 JOIN public.subjects s ON s.id=l.subject_id
 LEFT JOIN public.sessions se ON se.lecture_id=l.id
 LEFT JOIN public.attendance a ON a.session_id=se.id
 WHERE (p_subject_id IS NULL OR l.subject_id=p_subject_id)
   AND (private.can_manage_unit(l.subject_id,l.kind) OR private.get_current_user_role()='student')
 GROUP BY l.id,s.name ORDER BY l.lecture_date DESC,l.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.fetch_lectures(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fetch_lectures(uuid) TO authenticated;
