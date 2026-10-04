BEGIN;
-- Password recovery is now handled exclusively by Supabase Auth email links.
-- The user explicitly requested removal of the old support-request data.
DROP TABLE IF EXISTS public.password_reset_requests;
DROP FUNCTION IF EXISTS private.can_manage_account_email(text);
COMMIT;
