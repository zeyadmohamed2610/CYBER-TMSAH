-- Apply after account-login and the new frontend have been published.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.check_email_exists(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_username_exists(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.check_username_exists(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_national_id_exists(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.check_national_id_exists(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_login_identifier(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO service_role;
COMMIT;
