-- Preserve registered credentials; expand the account-wide capacity atomically.
CREATE OR REPLACE FUNCTION private.limit_passkey_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.auth_id::text,0));
 IF (SELECT count(*) FROM public.webauthn_credentials WHERE auth_id=NEW.auth_id AND credential_id<>NEW.credential_id)>=10
 THEN RAISE EXCEPTION 'validation_error: ten passkeys maximum'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.limit_passkey_count() FROM PUBLIC,anon,authenticated;
