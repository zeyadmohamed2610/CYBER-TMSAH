BEGIN;
CREATE OR REPLACE FUNCTION private.guard_term_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sid uuid;
BEGIN
  IF TG_OP='DELETE' THEN sid:=OLD.session_id; ELSE sid:=NEW.session_id; END IF;
  -- FK cascades run after the parent has disappeared. The parent's own term
  -- guard and authorization already decided whether that deletion is allowed.
  IF TG_OP='DELETE' AND (
    NOT EXISTS(SELECT 1 FROM public.users WHERE id=OLD.student_id)
    OR NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=OLD.session_id)
  ) THEN RETURN OLD; END IF;
  PERFORM 1 FROM private.academic_terms t
    JOIN public.sessions se ON t.id=se.term_id
    WHERE se.id=sid AND t.status='active' FOR SHARE OF t;
  IF NOT FOUND THEN RAISE EXCEPTION 'term_closed: attendance is read only'; END IF;
  IF TG_OP='UPDATE' AND (
    NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.student_id IS DISTINCT FROM OLD.student_id
  ) THEN RAISE EXCEPTION 'permission_denied: attendance binding'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_term_attendance() FROM PUBLIC, anon, authenticated;
COMMIT;
