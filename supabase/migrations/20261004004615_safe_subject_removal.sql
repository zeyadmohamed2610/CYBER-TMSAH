BEGIN;

-- Deleting a subject must never cascade through academic attendance history.
CREATE OR REPLACE FUNCTION private.remove_academic_subject(p_subject_id uuid, p_department text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller public.users; subject public.subjects;
BEGIN
 caller := private.get_caller_user();
 IF caller.id IS NULL OR caller.role NOT IN ('owner','coordinator')
    OR (caller.role='coordinator' AND caller.department IS DISTINCT FROM p_department) THEN
   RAISE EXCEPTION 'permission_denied' USING ERRCODE='42501';
 END IF;
 -- Referencing FK inserts acquire a key-share lock, so they cannot race this deletion.
 SELECT * INTO subject FROM public.subjects WHERE id=p_subject_id AND department=p_department FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('deleted',false,'reason','not_found'); END IF;
 IF EXISTS(SELECT 1 FROM public.lectures WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM public.sessions WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM public.academic_schedule_entries WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM public.user_subjects WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM public.users WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM private.attendance_rules WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM private.attendance_cases WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM private.term_results WHERE subject_id=p_subject_id) THEN
   RETURN jsonb_build_object('deleted',false,'reason','in_use');
 END IF;
 DELETE FROM public.subjects WHERE id=p_subject_id;
 RETURN jsonb_build_object('deleted',true);
END;
$$;
CREATE OR REPLACE FUNCTION public.remove_academic_subject(p_subject_id uuid,p_department text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.remove_academic_subject(p_subject_id,p_department);
$$;
REVOKE ALL ON FUNCTION private.remove_academic_subject(uuid,text),public.remove_academic_subject(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.remove_academic_subject(uuid,text),public.remove_academic_subject(uuid,text) TO authenticated;
REVOKE DELETE ON public.subjects FROM PUBLIC,anon,authenticated;
COMMIT;
