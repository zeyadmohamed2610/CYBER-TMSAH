-- Revocation must also invalidate any unused attendance confirmation.
CREATE INDEX attendance_proof_credential_idx ON public.attendance_biometric_proofs(auth_id,credential_id);
CREATE FUNCTION private.guard_passkey_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.webauthn_credentials c WHERE c.auth_id=NEW.auth_id AND c.credential_id=NEW.credential_id AND c.public_key IS NOT NULL FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'credential_revoked: verify with a current registered key'; END IF;
 RETURN NEW;
END; $$;
CREATE FUNCTION private.revoke_passkey_receipts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.attendance_biometric_proofs WHERE auth_id=OLD.auth_id AND credential_id=OLD.credential_id;
 RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION private.guard_passkey_receipt(),private.revoke_passkey_receipts() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_current_passkey_receipt BEFORE INSERT ON public.attendance_biometric_proofs FOR EACH ROW EXECUTE FUNCTION private.guard_passkey_receipt();
CREATE TRIGGER revoke_unused_passkey_receipts AFTER DELETE ON public.webauthn_credentials FOR EACH ROW EXECUTE FUNCTION private.revoke_passkey_receipts();
