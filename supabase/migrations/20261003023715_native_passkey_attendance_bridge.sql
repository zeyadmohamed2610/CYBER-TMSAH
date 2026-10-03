CREATE TABLE public.native_passkey_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),challenge_id uuid NOT NULL UNIQUE,
 auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK(purpose IN ('attendance','verify')),
 attendance_hash text,device_fingerprint text,selected_key uuid,
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '2 minutes')
);
ALTER TABLE public.native_passkey_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_passkey_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.native_passkey_requests TO service_role;
CREATE INDEX native_passkey_requests_expiry ON public.native_passkey_requests(expires_at);
ALTER TABLE public.attendance_biometric_proofs ADD COLUMN native_credential_uuid uuid
 REFERENCES auth.webauthn_credentials(id) ON DELETE CASCADE;
CREATE INDEX attendance_native_credential_idx ON public.attendance_biometric_proofs(native_credential_uuid);
CREATE FUNCTION public.lookup_native_passkey(p_auth_id uuid,p_credential_id text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF p_credential_id IS NULL OR length(p_credential_id)>2048 OR p_credential_id !~ '^[A-Za-z0-9_-]+$' THEN RETURN NULL; END IF;
 SELECT id INTO result FROM auth.webauthn_credentials
 WHERE user_id=p_auth_id AND credential_id=pg_catalog.decode(pg_catalog.rpad(pg_catalog.translate(p_credential_id,'-_','+/'),((length(p_credential_id)+3)/4)*4,'='),'base64');
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.lookup_native_passkey(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_native_passkey(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION private.guard_passkey_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 NEW.native_credential_uuid:=public.lookup_native_passkey(NEW.auth_id,NEW.credential_id);
 IF NEW.native_credential_uuid IS NULL THEN RAISE EXCEPTION 'credential_revoked: verify with a current registered key'; END IF;
 PERFORM 1 FROM auth.webauthn_credentials WHERE id=NEW.native_credential_uuid AND user_id=NEW.auth_id FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'credential_revoked: verify with a current registered key'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_passkey_receipt() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.webauthn_credentials,public.webauthn_challenges FROM anon,authenticated;
