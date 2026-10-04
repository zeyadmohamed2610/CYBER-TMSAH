BEGIN;
-- This private trigger validates untrusted department arrays and reads the trusted
-- caller profile. Anonymous join submissions and Auth administrators have no
-- private-schema access; the trigger must perform that internal lookup itself.
-- It remains non-callable, preserves role/array checks and grants no table access.
ALTER FUNCTION private.validate_department_memberships() SECURITY DEFINER;
REVOKE ALL ON FUNCTION private.validate_department_memberships() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
