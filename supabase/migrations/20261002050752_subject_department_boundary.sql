CREATE POLICY subjects_department_insert_boundary ON public.subjects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND department=(private.get_caller_user()).department));
CREATE POLICY subjects_department_update_boundary ON public.subjects AS RESTRICTIVE FOR UPDATE TO authenticated
USING(private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND department=(private.get_caller_user()).department))
WITH CHECK(private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND department=(private.get_caller_user()).department));
CREATE POLICY subjects_department_delete_boundary ON public.subjects AS RESTRICTIVE FOR DELETE TO authenticated
USING(private.get_current_user_role()='owner' OR (private.get_current_user_role()='coordinator' AND department=(private.get_caller_user()).department));
-- The obsolete browser lookup is no longer used by signed passkey login.
REVOKE EXECUTE ON FUNCTION public.passkey_lookup_user(text,text) FROM PUBLIC,anon,authenticated;
