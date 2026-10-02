-- Authoritative profile scope also applies to administrative support records.
CREATE POLICY users_coordinator_rank_boundary ON public.users AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  auth_id = (SELECT auth.uid()) OR (SELECT private.get_current_user_role()) <> 'coordinator'
  OR role IN ('doctor','ta','student')
);

CREATE POLICY user_subjects_department_boundary ON public.user_subjects AS RESTRICTIVE
FOR ALL TO authenticated USING (
  user_id = (SELECT (private.get_caller_user()).id)
  OR (SELECT private.get_current_user_role()) = 'owner'
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_subjects.user_id
    AND u.role IN ('doctor','ta') AND u.department = (SELECT (private.get_caller_user()).department)
    AND (SELECT private.get_current_user_role()) = 'coordinator')
) WITH CHECK (
  (SELECT private.get_current_user_role()) = 'owner'
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_subjects.user_id
    AND u.role IN ('doctor','ta') AND u.department = (SELECT (private.get_caller_user()).department)
    AND (SELECT private.get_current_user_role()) = 'coordinator')
);

CREATE POLICY error_reports_department_boundary ON public.error_reports AS RESTRICTIVE
FOR ALL TO authenticated USING (
  (SELECT private.get_current_user_role()) = 'owner'
  OR ((SELECT private.get_current_user_role()) = 'coordinator'
    AND department = (SELECT (private.get_caller_user()).department)
    AND user_role IN ('doctor','ta','student'))
) WITH CHECK (
  (SELECT private.get_current_user_role()) = 'owner'
  OR ((SELECT private.get_current_user_role()) = 'coordinator'
    AND department = (SELECT (private.get_caller_user()).department)
    AND user_role IN ('doctor','ta','student'))
  OR user_id IN ((SELECT auth.uid()), (SELECT (private.get_caller_user()).id))
);

CREATE POLICY system_logs_department_boundary ON public.system_logs AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  (SELECT private.get_current_user_role()) = 'owner'
  OR ((SELECT private.get_current_user_role()) = 'coordinator' AND EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = system_logs.actor_id
      AND (u.auth_id = (SELECT auth.uid()) OR (u.role IN ('doctor','ta','student')
        AND u.department = (SELECT (private.get_caller_user()).department)))
  ))
);
CREATE POLICY system_logs_owner_delete_boundary ON public.system_logs AS RESTRICTIVE
FOR DELETE TO authenticated USING ((SELECT private.get_current_user_role()) = 'owner');

CREATE OR REPLACE FUNCTION private.read_user_subjects(p_user_id uuid)
RETURNS TABLE(subject_id uuid, subject_name text, department text, assigned_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE caller public.users; target public.users;
BEGIN
  caller := private.get_caller_user();
  SELECT * INTO target FROM public.users WHERE id = p_user_id;
  IF auth.uid() IS NULL OR caller.id IS NULL OR NOT
    (caller.id = p_user_id OR caller.role = 'owner' OR
      (caller.role = 'coordinator' AND target.role IN ('doctor','ta')
       AND caller.department IS NOT DISTINCT FROM target.department)) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;
  RETURN QUERY SELECT s.id,s.name,s.department,us.assigned_at
    FROM public.user_subjects us JOIN public.subjects s ON s.id = us.subject_id
    WHERE us.user_id = p_user_id ORDER BY s.name;
END $function$;
