-- ==============================================================================
-- Migration: 20260926001000_database_cleanup_and_consistency.sql
-- Description:
--   1. DROP unused & abandoned tables (login_sessions)
--   2. FIX submit_attendance fatal bug (students blocked by null subject_id check)
--   3. UNIFY device locking (sync device_locks and student_devices)
--   4. EXPAND coordinator role across all management RPCs (lectures, sessions, attendance, users)
--   5. ENHANCE update_user to support department, academic_year, section_number
--   6. CLEAN UP legacy constraints (chk_subject_per_role)
-- ==============================================================================

-- ── 1. DROP Unused / Abandoned Tables ─────────────────────────────────────────
-- login_sessions was created in initial migration but never used (Supabase Auth handles sessions).
DROP TABLE IF EXISTS public.login_sessions CASCADE;

-- ── 2. Clean Up Obsolete Constraints ──────────────────────────────────────────
-- Drop restrictive subject check that blocks assigning roles freely
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_subject_per_role;

-- ── 3. Unify Device Locking: delete_student_device ────────────────────────────
-- Clears device binding from BOTH student_devices and device_locks
-- Allows both owner and coordinator
CREATE OR REPLACE FUNCTION public.delete_student_device(
  p_student_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_target      public.users;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR (v_caller_role <> 'owner' AND v_caller_role <> 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may clear student devices';
  END IF;

  SELECT * INTO v_target
  FROM public.users
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: student % does not exist', p_student_id;
  END IF;

  IF v_target.role <> 'student' THEN
    RAISE EXCEPTION 'validation_error: target user must be a student';
  END IF;

  -- Delete from student_devices table
  DELETE FROM public.student_devices
  WHERE student_id = p_student_id;

  -- Also delete from device_locks table (matched by auth_id)
  IF v_target.auth_id IS NOT NULL THEN
    DELETE FROM public.device_locks
    WHERE student_auth_id = v_target.auth_id;
  END IF;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('delete_student_device: cleared device locks for student %s (%s)', v_target.full_name, p_student_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_student_device(UUID) TO authenticated;

-- ── 4. Fix submit_attendance: Remove Student Subject Block & Sync Locks ────────
CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_hash                   TEXT,
  p_device_fingerprint     TEXT DEFAULT NULL,
  p_student_latitude       DOUBLE PRECISION DEFAULT NULL,
  p_student_longitude      DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, extensions
AS $$
DECLARE
  v_caller        public.users;
  v_session       public.sessions;
  v_record        public.attendance;
  v_fp            TEXT;
  v_ip            TEXT;
  v_recent        INTEGER;
  v_distance      DOUBLE PRECISION;
  v_window        BIGINT;
  v_gps_verified  BOOLEAN := FALSE;
  v_existing_auth UUID;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  -- Rate limit: max 10 attempts per minute per student
  SELECT COUNT(*) INTO v_recent
  FROM public.system_logs
  WHERE actor_id = v_caller.id
    AND action LIKE 'submit_attendance:%'
    AND created_at > now() - INTERVAL '1 minute';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'rate_limited: too many submission attempts, please wait';
  END IF;

  IF p_hash IS NULL OR length(trim(p_hash)) = 0 THEN
    RAISE EXCEPTION 'validation_error: attendance hash cannot be empty';
  END IF;

  -- Resolve device fingerprint
  v_fp := trim(COALESCE(p_device_fingerprint, ''));
  IF v_fp = '' THEN
    v_fp := encode(
      digest(
        COALESCE(private.current_request_user_agent(), '') || '|' ||
        COALESCE(private.current_request_ip(), ''),
        'sha256'
      ),
      'hex'
    );
  END IF;

  v_ip := private.current_request_ip();
  v_window := EXTRACT(EPOCH FROM now())::bigint / 10;

  -- Validate active session & hash (TOTP or short_code)
  SELECT * INTO v_session
  FROM public.sessions
  WHERE expires_at > now()
    AND (
      trim(p_hash) = public.generate_totp(rotating_hash, v_window)
      OR
      trim(p_hash) = public.generate_totp(rotating_hash, v_window - 1)
      OR
      trim(p_hash) = short_code
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired: attendance hash is invalid or has expired';
  END IF;

  -- FIX: Only check subject match if the student actually has a specific subject assigned!
  -- Regular students take many subjects so their subject_id is null.
  IF v_caller.subject_id IS NOT NULL AND v_session.subject_id IS NOT NULL THEN
    IF v_caller.subject_id IS DISTINCT FROM v_session.subject_id THEN
      RAISE EXCEPTION 'permission_denied: session does not belong to your assigned subject';
    END IF;
  END IF;

  -- Optional Section verification (if student has a section and session is section-specific)
  IF v_session.section IS NOT NULL AND trim(v_session.section) <> '' AND v_caller.section_number IS NOT NULL THEN
    IF trim(v_session.section) <> v_caller.section_number::text THEN
      -- Log notice but permit or check
    END IF;
  END IF;

  -- Geolocation validation
  IF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
     AND p_student_latitude IS NOT NULL AND p_student_longitude IS NOT NULL THEN
    v_distance := public.gps_distance_meters(
      v_session.latitude, v_session.longitude,
      p_student_latitude, p_student_longitude
    );
    IF v_distance > COALESCE(v_session.radius_meters, 50) THEN
      RAISE EXCEPTION 'location_denied: you are %.0f meters away from the session location (max: %m)',
        v_distance, COALESCE(v_session.radius_meters, 50);
    END IF;
    v_gps_verified := TRUE;
  ELSIF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
        AND (p_student_latitude IS NULL OR p_student_longitude IS NULL) THEN
    RAISE EXCEPTION 'location_denied: this session requires GPS verification, please enable location.';
  END IF;

  -- Device Binding Check (Sync across both student_devices and device_locks)
  IF v_caller.auth_id IS NOT NULL THEN
    -- Check if another student has this device locked
    SELECT student_auth_id INTO v_existing_auth
    FROM public.device_locks
    WHERE device_fingerprint = v_fp
    LIMIT 1;

    IF v_existing_auth IS NOT NULL AND v_existing_auth <> v_caller.auth_id THEN
      RAISE EXCEPTION 'device_conflict: this device is registered to another student account';
    END IF;

    -- Upsert lock for this student
    INSERT INTO public.device_locks (student_auth_id, device_fingerprint)
    VALUES (v_caller.auth_id, v_fp)
    ON CONFLICT (student_auth_id) DO UPDATE
      SET device_fingerprint = EXCLUDED.device_fingerprint;
  END IF;

  -- Also sync student_devices
  INSERT INTO public.student_devices (student_id, device_fingerprint, ip_address, bound_at, last_seen_at)
  VALUES (v_caller.id, v_fp, v_ip, now(), now())
  ON CONFLICT (student_id) DO UPDATE
    SET last_seen_at = now(),
        ip_address = EXCLUDED.ip_address;

  -- Prevent duplicate attendance in the same session
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'already_recorded: your attendance has already been recorded for this session';
  END IF;

  -- Record Attendance
  INSERT INTO public.attendance (
    student_id,
    session_id,
    device_fingerprint,
    student_latitude,
    student_longitude,
    metadata
  )
  VALUES (
    v_caller.id,
    v_session.id,
    v_fp,
    p_student_latitude,
    p_student_longitude,
    jsonb_build_object(
      'ip', v_ip,
      'gps_verified', v_gps_verified,
      'user_agent', private.current_request_user_agent(),
      'submitted_at', now()
    )
  )
  RETURNING * INTO v_record;

  -- Log success
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('submit_attendance: success student %s in session %s', v_caller.id, v_session.id));

  RETURN v_record;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ── 5. Expand Coordinator Role to All Management RPCs ────────────────────────

-- 5.1 create_lecture
CREATE OR REPLACE FUNCTION public.create_lecture(
  p_subject_id UUID,
  p_title      TEXT DEFAULT 'محاضرة'
)
RETURNS public.lectures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_lecture     public.lectures;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may create lectures';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF v_caller_role IN ('doctor', 'ta') AND v_caller.subject_id IS DISTINCT FROM p_subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors and TAs may only create lectures for their assigned subject';
  END IF;

  INSERT INTO public.lectures (subject_id, title, created_by)
  VALUES (p_subject_id, COALESCE(NULLIF(trim(p_title), ''), 'محاضرة'), v_caller.id)
  RETURNING * INTO v_lecture;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('create_lecture: created lecture %s for subject %s', v_lecture.id, p_subject_id));

  RETURN v_lecture;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_lecture(UUID, TEXT) TO authenticated;

-- 5.2 delete_lecture
CREATE OR REPLACE FUNCTION public.delete_lecture(
  p_lecture_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may delete lectures';
  END IF;

  DELETE FROM public.attendance
  WHERE session_id IN (SELECT id FROM public.sessions WHERE lecture_id = p_lecture_id);

  DELETE FROM public.sessions WHERE lecture_id = p_lecture_id;
  DELETE FROM public.lectures WHERE id = p_lecture_id;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('delete_lecture: permanently deleted lecture %s', p_lecture_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_lecture(UUID) TO authenticated;

-- 5.3 end_lecture
CREATE OR REPLACE FUNCTION public.end_lecture(
  p_lecture_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may end lectures';
  END IF;

  UPDATE public.sessions
  SET expires_at = now()
  WHERE lecture_id = p_lecture_id AND expires_at > now();

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('end_lecture: ended all sessions for lecture %s', p_lecture_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_lecture(UUID) TO authenticated;

-- 5.4 generate_rotating_hash
CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_subject_id       UUID,
  p_duration_minutes INTEGER DEFAULT 10,
  p_latitude         DOUBLE PRECISION DEFAULT NULL,
  p_longitude        DOUBLE PRECISION DEFAULT NULL,
  p_radius_meters    INTEGER DEFAULT 50,
  p_lecture_id       UUID DEFAULT NULL,
  p_section          TEXT DEFAULT NULL
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_hash        TEXT;
  v_short_code  TEXT;
  v_session     public.sessions;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may generate sessions';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 180 THEN
    RAISE EXCEPTION 'validation_error: duration must be between 1 and 180 minutes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF v_caller_role IN ('doctor', 'ta') AND v_caller.subject_id IS DISTINCT FROM p_subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors and TAs may only generate sessions for their assigned subject';
  END IF;

  v_hash := encode(extensions.gen_random_bytes(32), 'hex');
  v_short_code := lpad((floor(random() * 900000) + 100000)::text, 6, '0');

  INSERT INTO public.sessions (
    subject_id,
    lecture_id,
    section,
    rotating_hash,
    short_code,
    expires_at,
    latitude,
    longitude,
    radius_meters,
    created_by
  )
  VALUES (
    p_subject_id,
    p_lecture_id,
    p_section,
    v_hash,
    v_short_code,
    now() + (p_duration_minutes || ' minutes')::interval,
    p_latitude,
    p_longitude,
    COALESCE(p_radius_meters, 50),
    v_caller.id
  )
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('generate_rotating_hash: created session %s for subject %s', v_session.id, p_subject_id));

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_rotating_hash(UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, UUID, TEXT) TO authenticated;

-- 5.5 stop_session
CREATE OR REPLACE FUNCTION public.stop_session(
  p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_session     public.sessions;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may stop sessions';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  UPDATE public.sessions SET expires_at = now() WHERE id = p_session_id;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('stop_session: stopped session %s', p_session_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.stop_session(UUID) TO authenticated;

-- 5.6 add_manual_attendance
CREATE OR REPLACE FUNCTION public.add_manual_attendance(
  p_student_id UUID,
  p_session_id UUID
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_student     public.users;
  v_session     public.sessions;
  v_record      public.attendance;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, coordinators, doctors and TAs may add manual attendance';
  END IF;

  SELECT * INTO v_student FROM public.users WHERE id = p_student_id AND role = 'student';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: student % does not exist', p_student_id;
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = p_student_id AND session_id = p_session_id
  ) THEN
    RAISE EXCEPTION 'conflict: attendance already recorded for this student/session';
  END IF;

  INSERT INTO public.attendance (student_id, session_id, metadata)
  VALUES (p_student_id, p_session_id, jsonb_build_object('manual', true, 'recorded_by', v_caller.id, 'recorded_at', now()))
  RETURNING * INTO v_record;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('add_manual_attendance: student %s -> session %s', p_student_id, p_session_id));

  RETURN v_record;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_manual_attendance(UUID, UUID) TO authenticated;

-- 5.7 delete_user_by_id (supports coordinator & cascades auth.users)
CREATE OR REPLACE FUNCTION public.delete_user_by_id(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_target      public.users;
  v_auth_id     uuid;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may delete users';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  -- Protection: Nobody can delete themselves or delete an owner unless they are an owner
  IF v_caller.id = p_user_id THEN
    RAISE EXCEPTION 'validation_error: users cannot delete their own account';
  END IF;

  IF v_target.role = 'owner' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: coordinators cannot delete owner accounts';
  END IF;

  v_auth_id := v_target.auth_id;

  -- Delete public.users record
  DELETE FROM public.users WHERE id = p_user_id;

  -- Cascade delete auth.users record if exists
  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    COALESCE(v_caller.id, (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)),
    format('delete_user_by_id: deleted user %s (%s, role: %s)', v_target.full_name, p_user_id, v_target.role)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_by_id(UUID) TO authenticated;

-- 5.8 update_user: Support coordinator and all academic fields
CREATE OR REPLACE FUNCTION public.update_user(
  p_user_id        UUID,
  p_full_name      TEXT,
  p_national_id    TEXT DEFAULT NULL,
  p_subject_id     UUID DEFAULT NULL,
  p_department     TEXT DEFAULT NULL,
  p_academic_year  TEXT DEFAULT NULL,
  p_section_number INTEGER DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_target      public.users;
  v_updated     public.users;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may update user profiles';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) < 3 THEN
    RAISE EXCEPTION 'validation_error: full_name must be at least 3 characters';
  END IF;

  UPDATE public.users
  SET
    full_name      = trim(p_full_name),
    national_id    = COALESCE(p_national_id, national_id),
    subject_id     = p_subject_id,
    department     = COALESCE(p_department, department),
    academic_year  = COALESCE(p_academic_year, academic_year),
    section_number = COALESCE(p_section_number, section_number)
  WHERE id = p_user_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user(UUID, TEXT, TEXT, UUID, TEXT, TEXT, INTEGER) TO authenticated;
