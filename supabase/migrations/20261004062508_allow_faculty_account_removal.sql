BEGIN;
-- FK-driven removal changes only the creator reference, including in an archived term.
CREATE OR REPLACE FUNCTION private.is_creator_detachment(p_old jsonb,p_new jsonb)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT pg_trigger_depth()>1 AND p_old->>'created_by' IS NOT NULL
 AND p_new->>'created_by' IS NULL
 AND p_old-'created_by'=p_new-'created_by'
 AND NOT EXISTS(SELECT 1 FROM public.users WHERE id=(p_old->>'created_by')::uuid);
$$;
REVOKE ALL ON FUNCTION private.is_creator_detachment(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.guard_academic_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.lectures; c public.users; k text;
BEGIN
 IF TG_OP='UPDATE' AND private.is_creator_detachment(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;

 -- Backend maintenance uses service-role or the database owner; client workers retain auth.uid().
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 c:=private.get_caller_user();
 IF NEW.lecture_id IS NOT NULL THEN
   SELECT * INTO l FROM public.lectures WHERE id=NEW.lecture_id;
   IF NOT FOUND OR l.subject_id<>NEW.subject_id THEN RAISE EXCEPTION 'validation_error: invalid academic unit'; END IF;
   k:=l.kind;
   IF l.section IS NOT NULL AND NEW.section IS NOT NULL AND NEW.section<>l.section THEN RAISE EXCEPTION 'validation_error: section mismatch'; END IF;
   IF k='section' THEN NEW.section:=COALESCE(l.section,NEW.section);
   ELSE IF NEW.section IS NOT NULL AND NEW.section NOT IN ('','عام','all') THEN RAISE EXCEPTION 'validation_error: lecture has no section filter'; END IF; NEW.section:=NULL; END IF;
 ELSE
   k:=CASE WHEN NEW.section IS NULL OR NEW.section IN ('','عام','all') THEN 'lecture' ELSE 'section' END;
 END IF;
 IF NOT COALESCE(private.can_manage_unit(NEW.subject_id,k),false) THEN RAISE EXCEPTION 'permission_denied: academic session type'; END IF;
 IF k='section' AND (TG_OP='INSERT' OR NEW.section IS DISTINCT FROM OLD.section) AND (NEW.section IS NULL OR NEW.section !~ '^(?:[1-9]|1[0-5])$') THEN RAISE EXCEPTION 'validation_error: section 1 to 15 required'; END IF;
 IF NEW.lecture_id IS NOT NULL AND l.section IS NOT NULL AND NEW.section<>l.section THEN RAISE EXCEPTION 'validation_error: section mismatch'; END IF;
 RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION private.guard_academic_unit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE target public.lectures; BEGIN
 IF TG_OP='UPDATE' AND private.is_creator_detachment(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;

 target:=CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 IF auth.uid() IS NOT NULL AND NOT COALESCE(private.can_manage_unit(target.subject_id,target.kind),false) THEN RAISE EXCEPTION 'permission_denied: academic unit type'; END IF;
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL AND NOT COALESCE(private.can_manage_unit(OLD.subject_id,OLD.kind),false) THEN RAISE EXCEPTION 'permission_denied: original academic unit'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $function$
;
CREATE OR REPLACE FUNCTION private.guard_term_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE tid uuid; d text; BEGIN
 IF TG_OP='UPDATE' AND private.is_creator_detachment(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;

 IF TG_OP<>'INSERT' THEN tid:=OLD.term_id; END IF;
 IF TG_OP='INSERT' THEN
  SELECT COALESCE(s.department,(SELECT department FROM public.users WHERE id=NEW.created_by),'cybersecurity') INTO d FROM public.subjects s WHERE s.id=NEW.subject_id;
  tid:=private.active_academic_term(d);
  IF TG_TABLE_NAME='sessions' THEN
   IF NEW.lecture_id IS NOT NULL THEN SELECT term_id INTO tid FROM public.lectures WHERE id=NEW.lecture_id; END IF;
  END IF;
  IF NEW.term_id IS NOT NULL AND NEW.term_id IS DISTINCT FROM tid THEN RAISE EXCEPTION 'validation_error: term binding'; END IF;
  NEW.term_id:=tid;
 END IF;
 PERFORM 1 FROM private.academic_terms WHERE id=tid AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'term_closed: academic records are read only'; END IF;
 IF TG_OP='UPDATE' AND NEW.term_id IS DISTINCT FROM OLD.term_id THEN RAISE EXCEPTION 'permission_denied: historical term'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $function$
;

ALTER TABLE public.lectures DROP CONSTRAINT lectures_created_by_fkey;
ALTER TABLE public.lectures ADD CONSTRAINT lectures_created_by_fkey FOREIGN KEY(created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.sessions DROP CONSTRAINT sessions_created_by_fkey;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_created_by_fkey FOREIGN KEY(created_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION private.account_delete_user_by_id(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller public.users; target public.users; history jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'permission_denied: sign in'; END IF;
 caller:=private.get_caller_user();
 IF caller.id IS NULL OR caller.role NOT IN ('owner','coordinator') THEN RAISE EXCEPTION 'permission_denied: account management'; END IF;
 SELECT * INTO target FROM public.users WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found: account'; END IF;
 IF caller.id=target.id THEN RAISE EXCEPTION 'validation_error: users cannot delete their own account'; END IF;
 IF caller.role='coordinator' AND (target.role IN ('owner','coordinator') OR target.department IS DISTINCT FROM caller.department) THEN RAISE EXCEPTION 'permission_denied: outside department'; END IF;
 history:=jsonb_build_object('deleted_profile',jsonb_build_object('id',target.id,'full_name',target.full_name,'role',target.role,'department',target.department),
  'lecture_ids',COALESCE((SELECT jsonb_agg(id) FROM public.lectures WHERE created_by=target.id),'[]'::jsonb),
  'session_ids',COALESCE((SELECT jsonb_agg(id) FROM public.sessions WHERE created_by=target.id),'[]'::jsonb));
 INSERT INTO public.system_logs(actor_id,action,metadata) VALUES(caller.id,'delete_user_by_id',history);
 DELETE FROM public.users WHERE id=target.id;
 IF target.auth_id IS NOT NULL THEN DELETE FROM auth.users WHERE id=target.auth_id; END IF;
END $$;
REVOKE ALL ON FUNCTION private.account_delete_user_by_id(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.account_delete_user_by_id(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.delete_user_by_id(p_user_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.account_delete_user_by_id(p_user_id); $$;
REVOKE ALL ON FUNCTION public.delete_user_by_id(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_user_by_id(uuid) TO authenticated;
COMMIT;
