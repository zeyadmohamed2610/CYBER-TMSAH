-- Run against a QA-enabled project. All fixtures and changes are rolled back.
BEGIN;
CREATE TEMP TABLE security_audit_results(name text PRIMARY KEY);
CREATE TEMP TABLE security_audit_context AS SELECT role::text AS role,auth_id,id,email FROM public.users WHERE email IN ('qa.owner.20261002@example.com','qa.coordinator.20261002@example.com','qa.doctor.20261002@example.com','qa.ta.20261002@example.com','qa.student.20261002@example.com');
DO $$ BEGIN IF (SELECT count(*) FROM security_audit_context)<>5 THEN RAISE EXCEPTION 'Dedicated QA accounts are required'; END IF; END $$;
GRANT ALL ON security_audit_results TO authenticated,anon;
GRANT SELECT ON security_audit_context TO authenticated,anon;
-- Exercise RLS even for tables whose production write grants are already revoked.
-- These additional test grants are rolled back with the fixtures.
GRANT INSERT,UPDATE,DELETE ON public.exam_schedules,public.user_subjects TO authenticated;
CREATE FUNCTION pg_temp.expect_blocked(command text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE command;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE='42501' OR (SQLSTATE='P0001' AND SQLERRM ~ '(permission_denied|invalid_join_request|invalid_password_length)') THEN INSERT INTO security_audit_results VALUES(label); RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'Unexpectedly allowed: %',label;
END $$;
CREATE FUNCTION pg_temp.expect_count(command text,expected integer,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE amount bigint;
BEGIN EXECUTE command INTO amount; IF amount<>expected THEN RAISE EXCEPTION 'Wrong row count %: %',amount,label; END IF; INSERT INTO security_audit_results VALUES(label); END $$;
CREATE FUNCTION pg_temp.expect_no_write(command text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE amount bigint;
BEGIN EXECUTE command;GET DIAGNOSTICS amount=ROW_COUNT;IF amount<>0 THEN RAISE EXCEPTION 'Unexpected rows modified: %',label;END IF;INSERT INTO security_audit_results VALUES(label);END $$;
-- Use only the dedicated QA doctor to create foreign-department fixtures.
UPDATE public.users SET department='ai' WHERE id=(SELECT id FROM security_audit_context WHERE role='doctor');
INSERT INTO public.subjects(id,name,department,academic_year) VALUES('90000000-0000-0000-0000-000000000001','QA rollback subject','ai','2'),('90000000-0000-0000-0000-000000000002','QA rollback subject','cybersecurity','2');
INSERT INTO public.exam_schedules(id,title,department,academic_year,exam_type) VALUES('90000000-0000-0000-0000-000000000003','QA rollback exam','ai','2','midterm');
INSERT INTO public.password_reset_requests(id,email,status) SELECT '90000000-0000-0000-0000-000000000004',email,'pending' FROM security_audit_context WHERE role='doctor';
INSERT INTO public.user_subjects(user_id,subject_id) SELECT id,'90000000-0000-0000-0000-000000000002' FROM security_audit_context WHERE role IN ('doctor','ta');
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT auth_id FROM security_audit_context WHERE role='coordinator'),'role','authenticated','app_metadata',json_build_object('role','owner'))::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_count($q$SELECT count(*) FROM public.password_reset_requests WHERE id='90000000-0000-0000-0000-000000000004'$q$,0,'coordinator cannot read foreign password reset even with stale elevated app metadata');
SELECT pg_temp.expect_no_write($q$UPDATE public.password_reset_requests SET notes='forged' WHERE id='90000000-0000-0000-0000-000000000004'$q$,'coordinator cannot modify foreign password reset');
SELECT pg_temp.expect_no_write($q$DELETE FROM public.exam_schedules WHERE id='90000000-0000-0000-0000-000000000003'$q$,'coordinator cannot delete foreign exam');
SELECT pg_temp.expect_blocked($q$INSERT INTO public.exam_schedules(title,department,academic_year,exam_type) VALUES('forged','ai','2','midterm')$q$,'coordinator cannot insert foreign exam');
SELECT pg_temp.expect_blocked($q$INSERT INTO public.user_subjects(user_id,subject_id) SELECT id,'90000000-0000-0000-0000-000000000001' FROM security_audit_context WHERE role='ta'$q$,'coordinator cannot assign foreign subject to own TA');
SELECT pg_temp.expect_blocked($q$UPDATE public.users SET subject_id='90000000-0000-0000-0000-000000000001' WHERE id=(SELECT id FROM security_audit_context WHERE role='ta')$q$,'coordinator cannot assign foreign primary subject to own TA');
SELECT pg_temp.expect_blocked($q$SELECT public.admin_create_user('QA rollback teacher','qa_rollback_teacher','qa.rollback.teacher@example.com','NotReal!Example123','doctor','cybersecurity',NULL,NULL,'90000000-0000-0000-0000-000000000001')$q$,'coordinator cannot create teacher with foreign primary subject');
SELECT pg_temp.expect_count($q$SELECT count(*) FROM public.audit_logs$q$,0,'coordinator cannot read global authentication reports');
SELECT pg_temp.expect_blocked($q$INSERT INTO public.system_logs(actor_id,action) SELECT id,'forged actor' FROM security_audit_context WHERE role='owner'$q$,'coordinator cannot forge another actor in system log');
SELECT pg_temp.expect_blocked('TRUNCATE public.device_locks','authenticated cannot bypass RLS with truncate');
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT auth_id FROM security_audit_context WHERE role='doctor'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_blocked($q$SELECT public.create_lecture('90000000-0000-0000-0000-000000000002','QA rollback','section','1')$q$,'doctor cannot create section attendance unit');
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT auth_id FROM security_audit_context WHERE role='ta'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_blocked($q$SELECT public.create_lecture('90000000-0000-0000-0000-000000000002','QA rollback','lecture',NULL)$q$,'TA cannot create lecture attendance unit');
RESET ROLE;
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT auth_id FROM security_audit_context WHERE role='student'),'role','authenticated','user_metadata',json_build_object('role','owner'))::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_blocked($q$UPDATE public.users SET national_id='29901019999997' WHERE auth_id=auth.uid()$q$,'student cannot change managed national identifier');
SELECT pg_temp.expect_blocked($q$UPDATE public.users SET role='owner' WHERE auth_id=auth.uid()$q$,'editable owner metadata cannot elevate student rank');
RESET ROLE;
SELECT name FROM security_audit_results ORDER BY name;
ROLLBACK;
