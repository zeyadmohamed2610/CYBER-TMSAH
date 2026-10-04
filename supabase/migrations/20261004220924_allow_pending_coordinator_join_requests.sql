BEGIN;

-- Coordinator applications require owner approval; an application grants no role.
CREATE OR REPLACE FUNCTION private.protect_join_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role NOT IN ('student', 'doctor', 'ta', 'coordinator')
      OR NEW.status <> 'pending'
      OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
      OR NEW.rejection_note IS NOT NULL
    THEN
      RAISE EXCEPTION 'invalid_join_request';
    END IF;
    IF NEW.password IS NULL OR length(NEW.password) < 6 OR octet_length(NEW.password) > 72 THEN
      RAISE EXCEPTION 'invalid_password_length';
    END IF;
    NEW.password := extensions.crypt(NEW.password, extensions.gen_salt('bf', 10));
  ELSE
    IF NEW.password IS DISTINCT FROM OLD.password AND NEW.password IS NOT NULL THEN
      RAISE EXCEPTION 'request_password_is_immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.protect_join_request() FROM PUBLIC, anon, authenticated;

COMMIT;
