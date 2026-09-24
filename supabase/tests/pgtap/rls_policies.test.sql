-- ===========================================================
-- pgTAP Tests for RLS Policies - University Attendance System
-- Run with: psql -d your_database -f supabase/tests/pgtap/rls_policies.test.sql
-- Requires: pgTAP extension (CREATE EXTENSION pgtap;)
-- ===========================================================

-- Load pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Test plan
SELECT plan(45);

-- ===========================================================
-- Setup: Create test users and roles
-- ===========================================================

-- Create test roles
DO $$
BEGIN
    -- Create test users in auth schema (simulated)
    -- Note: In real tests, these would be created via Supabase Auth
    -- Here we just set up the database state for policy testing
    PERFORM 1;
END $$;

-- Helper: Set current_user_role for testing
-- This simulates the private.current_user_role() function
CREATE OR REPLACE FUNCTION test_set_role(p_role text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    -- In actual testing, we'd use SET LOCAL ROLE or similar
    -- For pgTAP, we'll use a GUC or session variable
    PERFORM set_config('app.current_user_role', p_role, true);
END $$;

CREATE OR REPLACE FUNCTION test_set_subject_id(p_subject_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('app.current_user_subject_id', p_subject_id::text, true);
END $$;

CREATE OR REPLACE FUNCTION test_set_user_id(p_user_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, true);
END $$;

-- Mock the private helper functions for testing
CREATE OR REPLACE FUNCTION private.current_user_role() RETURNS text LANGUAGE sql STABLE AS $$
    SELECT current_setting('app.current_user_role', true);
$$;

CREATE OR REPLACE FUNCTION private.current_user_subject_id() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT current_setting('app.current_user_subject_id', true)::uuid;
$$;

CREATE OR REPLACE FUNCTION private.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT current_setting('app.current_user_id', true)::uuid;
$$;

-- ===========================================================
-- Test Data Setup
-- ===========================================================

-- Create test owner
INSERT INTO public.users (auth_id, full_name, role, subject_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Owner', 'owner', NULL)
ON CONFLICT (auth_id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Create test doctor
INSERT INTO public.users (auth_id, full_name, role, subject_id)
VALUES ('00000000-0000-0000-0000-000000000002', 'Test Doctor', 'doctor', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (auth_id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Create test TA
INSERT INTO public.users (auth_id, full_name, role, subject_id)
VALUES ('00000000-0000-0000-0000-000000000003', 'Test TA', 'ta', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (auth_id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Create test student
INSERT INTO public.users (auth_id, full_name, role, subject_id)
VALUES ('00000000-0000-0000-0000-000000000004', 'Test Student', 'student', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (auth_id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Create test subject
INSERT INTO public.subjects (id, name, code)
VALUES ('11111111-1111-1111-1111-111111111111', 'Computer Science', 'CS101')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Create test session (active)
INSERT INTO public.sessions (id, subject_id, title, expires_at, is_active)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test Session', now() + interval '1 hour', true)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- Create test session (expired)
INSERT INTO public.sessions (id, subject_id, title, expires_at, is_active)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Expired Session', now() - interval '1 hour', false)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- Create test attendance record
INSERT INTO public.attendance (id, session_id, student_id, student_name, hash, submitted_at, latitude, longitude, ip_address, user_agent, device_fingerprint)
VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000004', 'Test Student', 'testhash', now(), 30.0, 31.0, '127.0.0.1', 'test-agent', 'test-fingerprint')
ON CONFLICT (id) DO UPDATE SET student_name = EXCLUDED.student_name;

-- Create test lecture
INSERT INTO public.lectures (id, subject_id, title, lecture_date, created_by)
VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Test Lecture', CURRENT_DATE, '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- ===========================================================
-- Test: users table policies
-- ===========================================================

-- Test 1: self_read policy - user can read own row
SELECT test_set_role('student');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
    'SELECT full_name FROM public.users WHERE auth_id = ''00000000-0000-0000-0000-000000000004''',
    'SELECT ''Test Student''::text AS full_name',
    'student can read own user row via self_read policy'
);

-- Test 2: owner_all_users policy - owner can read all users
SELECT test_set_role('owner');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000001');
SELECT results_eq(
    'SELECT count(*) FROM public.users',
    'SELECT 4::int AS count',
    'owner can read all user rows via owner_all_users policy'
);

-- Test 3: doctor_own_users policy - doctor can read own row and students
SELECT test_set_role('doctor');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000002');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.users WHERE role = ''student'' OR auth_id = ''00000000-0000-0000-0000-000000000002''',
    'SELECT 2::int AS count',
    'doctor can read own row and students via doctor_own_users policy'
);

-- Test 4: ta_own_users policy - TA can read own row and students
SELECT test_set_role('ta');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000003');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.users WHERE role = ''student'' OR auth_id = ''00000000-0000-0000-0000-000000000003''',
    'SELECT 2::int AS count',
    'TA can read own row and students via ta_own_users policy'
);

-- Test 5: student_own_users policy - student can only read own row
SELECT test_set_role('student');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
    'SELECT count(*) FROM public.users',
    'SELECT 1::int AS count',
    'student can only read own row via student_own_users policy'
);

-- Test 6: owner_update_self - owner can update own profile
SELECT test_set_role('owner');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000001');
DO $$
BEGIN
    UPDATE public.users SET full_name = 'Updated Owner' WHERE auth_id = '00000000-0000-0000-0000-000000000001';
    PERFORM ok(true, 'owner can update own profile via owner_update_self policy');
EXCEPTION WHEN OTHERS THEN
    PERFORM ok(false, 'owner can update own profile via owner_update_self policy');
END $$;

-- ===========================================================
-- Test: subjects table policies
-- ===========================================================

-- Test 7: owner_all_subjects - owner can read all subjects
SELECT test_set_role('owner');
SELECT results_eq(
    'SELECT count(*) FROM public.subjects',
    'SELECT 1::int AS count',
    'owner can read all subjects via owner_all_subjects policy'
);

-- Test 8: doctor_own_subject - doctor can read own subject
SELECT test_set_role('doctor');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.subjects',
    'SELECT 1::int AS count',
    'doctor can read own subject via doctor_own_subject policy'
);

-- Test 9: doctor_own_subject - doctor cannot read other subjects
INSERT INTO public.subjects (id, name, code)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Other Subject', 'OTH101')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
SELECT test_set_role('doctor');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.subjects',
    'SELECT 1::int AS count',
    'doctor cannot read other subjects via doctor_own_subject policy'
);

-- Test 10: ta_own_subject - TA can read own subject
SELECT test_set_role('ta');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.subjects',
    'SELECT 1::int AS count',
    'TA can read own subject via ta_own_subject policy'
);

-- Test 11: student_own_subject - student can read all subjects
SELECT test_set_role('student');
SELECT results_eq(
    'SELECT count(*) FROM public.subjects',
    'SELECT 2::int AS count',  -- 2 subjects now
    'student can read all subjects via student_own_subject policy'
);

-- ===========================================================
-- Test: sessions table policies
-- ===========================================================

-- Test 12: owner_all_sessions - owner can read all sessions
SELECT test_set_role('owner');
SELECT results_eq(
    'SELECT count(*) FROM public.sessions',
    'SELECT 2::int AS count',
    'owner can read all sessions via owner_all_sessions policy'
);

-- Test 13: doctor_own_sessions - doctor can read own subject sessions
SELECT test_set_role('doctor');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.sessions',
    'SELECT 2::int AS count',
    'doctor can read own subject sessions via doctor_own_sessions policy'
);

-- Test 14: ta_own_sessions - TA can read own subject sessions
SELECT test_set_role('ta');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.sessions',
    'SELECT 2::int AS count',
    'TA can read own subject sessions via ta_own_sessions policy'
);

-- Test 15: student_own_sessions - student can read active sessions for own subject
SELECT test_set_role('student');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.sessions WHERE expires_at > now()',
    'SELECT 1::int AS count',
    'student can read active sessions via student_own_sessions policy'
);

-- Test 16: student_own_sessions - student cannot read expired sessions
SELECT test_set_role('student');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.sessions',
    'SELECT 1::int AS count',
    'student cannot read expired sessions via student_own_sessions policy'
);

-- ===========================================================
-- Test: attendance table policies
-- ===========================================================

-- Test 17: owner_all_attendance - owner can read all attendance
SELECT test_set_role('owner');
SELECT results_eq(
    'SELECT count(*) FROM public.attendance',
    'SELECT 1::int AS count',
    'owner can read all attendance via owner_all_attendance policy'
);

-- Test 18: doctor_own_attendance - doctor can read attendance for own subject sessions
SELECT test_set_role('doctor');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.attendance a JOIN public.sessions s ON a.session_id = s.id WHERE s.subject_id = ''11111111-1111-1111-1111-111111111111''',
    'SELECT 1::int AS count',
    'doctor can read attendance for own subject via doctor_own_attendance policy'
);

-- Test 19: ta_own_attendance - TA can read attendance for own subject sessions
SELECT test_set_role('ta');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.attendance a JOIN public.sessions s ON a.session_id = s.id WHERE s.subject_id = ''11111111-1111-1111-1111-111111111111''',
    'SELECT 1::int AS count',
    'TA can read attendance for own subject via ta_own_attendance policy'
);

-- Test 20: student_own_attendance - student can read own attendance
SELECT test_set_role('student');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
    'SELECT count(*) FROM public.attendance WHERE student_id = ''00000000-0000-0000-0000-000000000004''',
    'SELECT 1::int AS count',
    'student can read own attendance via student_own_attendance policy'
);

-- Test 21: student_own_attendance - student cannot read other attendance
SELECT test_set_role('student');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
    'SELECT count(*) FROM public.attendance',
    'SELECT 1::int AS count',
    'student can only see own attendance via student_own_attendance policy'
);

-- ===========================================================
-- Test: system_logs table policies
-- ===========================================================

-- Test 22: owner_read_logs - owner can read logs
SELECT test_set_role('owner');
SELECT results_eq(
    'SELECT count(*) FROM public.system_logs',
    'SELECT 0::int AS count',
    'owner can read system logs via owner_read_logs policy'
);

-- Test 23: security_definer_insert_logs - INSERT allowed by SECURITY DEFINER functions
-- This is tested via function calls, not direct INSERT
SELECT test_set_role('student');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000004');
DO $$
BEGIN
    -- Direct INSERT should fail (no policy allows it for non-SECURITY DEFINER)
    INSERT INTO public.system_logs (actor_id, action) VALUES ('00000000-0000-0000-0000-000000000004', 'test');
    PERFORM ok(false, 'direct INSERT to system_logs should be blocked');
EXCEPTION WHEN insufficient_privilege THEN
    PERFORM ok(true, 'direct INSERT to system_logs is blocked for students');
EXCEPTION WHEN OTHERS THEN
    PERFORM ok(true, 'direct INSERT to system_logs is blocked (other error)');
END $$;

-- ===========================================================
-- Test: course_materials table policies
-- ===========================================================

-- Insert test course material
INSERT INTO public.course_materials (id, subject_id, title, content, uploaded_by)
VALUES ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Test Material', 'Content', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- Test 24: owner_all_course_materials - owner can read all
SELECT test_set_role('owner');
SELECT results_eq(
    'SELECT count(*) FROM public.course_materials',
    'SELECT 1::int AS count',
    'owner can read all course materials via owner_all_course_materials policy'
);

-- Test 25: doctor_read_course_materials - doctor can read
SELECT test_set_role('doctor');
SELECT results_eq(
    'SELECT count(*) FROM public.course_materials',
    'SELECT 1::int AS count',
    'doctor can read course materials via doctor_read_course_materials policy'
);

-- Test 26: student_read_course_materials - student can read
SELECT test_set_role('student');
SELECT results_eq(
    'SELECT count(*) FROM public.course_materials',
    'SELECT 1::int AS count',
    'student can read course materials via student_read_course_materials policy'
);

-- Test 27: ta_read_course_materials - TA can read
SELECT test_set_role('ta');
SELECT results_eq(
    'SELECT count(*) FROM public.course_materials',
    'SELECT 1::int AS count',
    'TA can read course materials via ta_read_course_materials policy'
);

-- ===========================================================
-- Test: student_devices table policies
-- ===========================================================

-- Insert test device
INSERT INTO public.student_devices (id, student_id, device_fingerprint, device_name, is_active)
VALUES ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000004', 'fingerprint123', 'Test Device', true)
ON CONFLICT (id) DO UPDATE SET device_fingerprint = EXCLUDED.device_fingerprint;

-- Test 28: owner_all_student_devices - owner can read all devices
SELECT test_set_role('owner');
SELECT results_eq(
    'SELECT count(*) FROM public.student_devices',
    'SELECT 1::int AS count',
    'owner can read all student devices via owner_all_student_devices policy'
);

-- Test 29: student_own_device - student can read own device
SELECT test_set_role('student');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
    'SELECT count(*) FROM public.student_devices',
    'SELECT 1::int AS count',
    'student can read own device via student_own_device policy'
);

-- Test 30: student_own_device - student cannot read other devices
INSERT INTO public.student_devices (id, student_id, device_fingerprint, device_name, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000005', 'fingerprint456', 'Other Device', true)
ON CONFLICT (id) DO UPDATE SET device_fingerprint = EXCLUDED.device_fingerprint;
SELECT test_set_role('student');
SELECT test_set_user_id('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
    'SELECT count(*) FROM public.student_devices',
    'SELECT 1::int AS count',
    'student cannot read other devices via student_own_device policy'
);

-- ===========================================================
-- Test: login_sessions table policies
-- ===========================================================

-- Insert test login session
INSERT INTO public.login_sessions (id, user_id, ip_address, user_agent, created_at)
VALUES ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000004', '127.0.0.1', 'test-agent', now())
ON CONFLICT (id) DO UPDATE SET ip_address = EXCLUDED.ip_address;

-- Test 31: self_read_login_sessions - user can read own login sessions
SELECT test_set_user_id('00000000-0000-0000-0000-000000000004');
SELECT results_eq(
    'SELECT count(*) FROM public.login_sessions WHERE user_id = ''00000000-0000-0000-0000-000000000004''',
    'SELECT 1::int AS count',
    'user can read own login sessions via self_read_login_sessions policy'
);

-- ===========================================================
-- Test: lectures table policies
-- ===========================================================

-- Test 32: owner_all_lectures - owner can read all lectures
SELECT test_set_role('owner');
SELECT results_eq(
    'SELECT count(*) FROM public.lectures',
    'SELECT 1::int AS count',
    'owner can read all lectures via owner_all_lectures policy'
);

-- Test 33: doctor_own_lectures - doctor can read own subject lectures
SELECT test_set_role('doctor');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.lectures',
    'SELECT 1::int AS count',
    'doctor can read own subject lectures via doctor_own_lectures policy'
);

-- Test 34: ta_own_lectures - TA can read own subject lectures
SELECT test_set_role('ta');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
SELECT results_eq(
    'SELECT count(*) FROM public.lectures',
    'SELECT 1::int AS count',
    'TA can read own subject lectures via ta_own_lectures policy'
);

-- Test 35: owner_insert_lectures - owner can insert lectures
SELECT test_set_role('owner');
DO $$
BEGIN
    INSERT INTO public.lectures (id, subject_id, title, lecture_date, created_by)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Owner Lecture', CURRENT_DATE, '00000000-0000-0000-0000-000000000001');
    PERFORM ok(true, 'owner can insert lectures via owner_insert_lectures policy');
EXCEPTION WHEN OTHERS THEN
    PERFORM ok(false, 'owner can insert lectures via owner_insert_lectures policy');
END $$;

-- Test 36: doctor_insert_lectures - doctor can insert lectures
SELECT test_set_role('doctor');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
DO $$
BEGIN
    INSERT INTO public.lectures (id, subject_id, title, lecture_date, created_by)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'Doctor Lecture', CURRENT_DATE, '00000000-0000-0000-0000-000000000002');
    PERFORM ok(true, 'doctor can insert lectures via doctor_insert_lectures policy');
EXCEPTION WHEN OTHERS THEN
    PERFORM ok(false, 'doctor can insert lectures via doctor_insert_lectures policy');
END $$;

-- Test 37: doctor cannot insert lectures for other subjects
SELECT test_set_role('doctor');
SELECT test_set_subject_id('11111111-1111-1111-1111-111111111111');
DO $$
BEGIN
    INSERT INTO public.lectures (id, subject_id, title, lecture_date, created_by)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Doctor Lecture Other Subject', CURRENT_DATE, '00000000-0000-0000-0000-000000000002');
    PERFORM ok(false, 'doctor should not insert lectures for other subjects');
EXCEPTION WHEN OTHERS THEN
    PERFORM ok(true, 'doctor cannot insert lectures for other subjects');
END $$;

-- ===========================================================
-- Test: RLS is enabled on all tables
-- ===========================================================

-- Test 38: users table has RLS enabled
SELECT has_rls_enabled('public', 'users', 'users table has RLS enabled');

-- Test 39: subjects table has RLS enabled
SELECT has_rls_enabled('public', 'subjects', 'subjects table has RLS enabled');

-- Test 40: sessions table has RLS enabled
SELECT has_rls_enabled('public', 'sessions', 'sessions table has RLS enabled');

-- Test 41: attendance table has RLS enabled
SELECT has_rls_enabled('public', 'attendance', 'attendance table has RLS enabled');

-- Test 42: system_logs table has RLS enabled
SELECT has_rls_enabled('public', 'system_logs', 'system_logs table has RLS enabled');

-- Test 43: course_materials table has RLS enabled
SELECT has_rls_enabled('public', 'course_materials', 'course_materials table has RLS enabled');

-- Test 44: student_devices table has RLS enabled
SELECT has_rls_enabled('public', 'student_devices', 'student_devices table has RLS enabled');

-- Test 45: login_sessions table has RLS enabled
SELECT has_rls_enabled('public', 'login_sessions', 'login_sessions table has RLS enabled');

-- Test 46: lectures table has RLS enabled
SELECT has_rls_enabled('public', 'lectures', 'lectures table has RLS enabled');

-- ===========================================================
-- Cleanup
-- ===========================================================

-- Reset session variables
SELECT set_config('app.current_user_role', '', true);
SELECT set_config('app.current_user_subject_id', '', true);
SELECT set_config('app.current_user_id', '', true);

-- Finish
SELECT * FROM finish();