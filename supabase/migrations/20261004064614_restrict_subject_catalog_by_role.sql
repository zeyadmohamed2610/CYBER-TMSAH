BEGIN;

-- Enforce the same scope for direct API reads as for dashboard destinations.
CREATE POLICY subjects_role_read_boundary ON public.subjects
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  (SELECT private.get_current_user_role()) = 'owner'
  OR (
    (SELECT private.get_current_user_role()) = 'coordinator'
    AND department = (SELECT (private.get_caller_user()).department)
  )
  OR (
    (SELECT private.get_current_user_role()) = 'student'
    AND department = (SELECT (private.get_caller_user()).department)
    AND (academic_year IS NULL OR academic_year = (SELECT (private.get_caller_user()).academic_year))
  )
  OR (
    (SELECT private.get_current_user_role()) IN ('doctor', 'ta')
    AND private.can_manage_subject(id)
  )
);

COMMIT;
