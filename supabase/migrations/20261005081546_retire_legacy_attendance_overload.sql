BEGIN;
-- The application uses the five-argument receipt-verified entry point. Remove
-- the denied public compatibility overload and its unused receipt-free worker.
DROP FUNCTION public.submit_attendance(text,text,double precision,double precision);
DROP FUNCTION private.account_submit_attendance(text,text,double precision,double precision);
COMMIT;
