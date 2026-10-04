BEGIN;
-- The removed results/excuses APIs were the only users of this scope helper.
DROP FUNCTION private.lifecycle_department(text,boolean);
COMMIT;
