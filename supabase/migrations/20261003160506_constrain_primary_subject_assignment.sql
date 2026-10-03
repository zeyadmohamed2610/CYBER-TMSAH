BEGIN;
CREATE OR REPLACE FUNCTION private.guard_primary_subject_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller public.users;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 caller:=private.get_caller_user();
 IF caller.role='coordinator' AND NEW.subject_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.subjects s WHERE s.id=NEW.subject_id AND s.department=caller.department) THEN
  RAISE EXCEPTION 'permission_denied: primary subject outside department';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_primary_subject_assignment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_primary_subject_assignment BEFORE INSERT OR UPDATE OF subject_id ON public.users FOR EACH ROW EXECUTE FUNCTION private.guard_primary_subject_assignment();
COMMIT;
