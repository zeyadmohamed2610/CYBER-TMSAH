-- ===========================================================
-- 20260101000100_functions.sql
-- University Attendance System — RPC functions (ordered: 3 of 5)
--
-- Canonical signatures (single overload per RPC) match the
-- frontend call sites exactly:
--   generate_rotating_hash(p_subject_id, p_duration_minutes,
--     p_latitude, p_longitude, p_radius_meters,
--     p_lecture_id DEFAULT NULL, p_section DEFAULT NULL)
--   submit_attendance(p_hash, p_device_fingerprint,
--     p_student_latitude, p_student_longitude)
-- All audit writes populate the structured system_logs.metadata
-- JSONB column.  No 1-arg wrapper overload is exposed (security).
-- ===========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- 1. create_user  (owner only)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_user(
  p_auth_id    UUID,
  p_full_name  TEXT,
  p_role       public.user_role,
  p_subject_id UUID DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
  v_new    public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may create users';
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'validation_error: full_name cannot be empty';
  END IF;

  IF p_role = 'doctor' AND p_subject_id IS NULL THEN
    RAISE EXCEPTION 'validation_error: doctors require a subject_id';
  END IF;

  IF p_role = 'owner' AND p_subject_id IS NOT NULL THEN
    RAISE EXCEPTION 'validation_error: owners cannot have a subject_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_id) THEN
    RAISE EXCEPTION 'not_found: auth_id % does not exist in auth.users', p_auth_id;
  END IF;

  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subjects WHERE id = p_subject_id
  ) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE auth_id = p_auth_id) THEN
    RAISE EXCEPTION 'conflict: auth_id % already mapped to a user', p_auth_id;
  END IF;

  INSERT INTO public.users (auth_id, full_name, role, subject_id)
  VALUES (p_auth_id, trim(p_full_name), p_role, p_subject_id)
  RETURNING * INTO v_new;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('create_user: created %s (auth_id=%s, role=%s)', v_new.id, p_auth_id, p_role),
    jsonb_build_object(
      'user_id', v_new.id::text,
      'auth_id', p_auth_id::text,
      'role', p_role::text
    )
  );

  RETURN v_new;
END;
$$;

-- ─────────────────────────────────────────────
-- 2. generate_rotating_hash (CONSOLIDATED, single 7-param signature)
--    Matches frontend: subject_id, duration, latitude, longitude,
--    radius, optional lecture_id, optional section.
--    Callable by: OWNER, DOCTOR (own subject), TA (own subject)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_subject_id       UUID,
  p_duration_minutes INTEGER          DEFAULT 10,
  p_latitude         DOUBLE PRECISION DEFAULT NULL,
  p_longitude        DOUBLE PRECISION DEFAULT NULL,
  p_radius_meters    INTEGER          DEFAULT 50,
  p_lecture_id       UUID             DEFAULT NULL,
  p_section          TEXT             DEFAULT NULL
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller     public.users;
  v_hash       TEXT;
  v_short_code TEXT;
  v_session    public.sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may generate sessions';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 180 THEN
    RAISE EXCEPTION 'validation_error: duration must be between 1 and 180 minutes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_caller.subject_id IS DISTINCT FROM p_subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only create sessions for their assigned subject';
  END IF;

  v_hash := replace(gen_random_uuid()::text, '-', '') ||
            replace(gen_random_uuid()::text, '-', '');

  v_short_code := lpad(floor(random() * 1000000)::text, 6, '0');

  INSERT INTO public.sessions (
    subject_id, rotating_hash, short_code, expires_at,
    latitude, longitude, radius_meters, lecture_id, section
  )
  VALUES (
    p_subject_id, v_hash, v_short_code,
    now() + make_interval(mins => p_duration_minutes),
    p_latitude, p_longitude, p_radius_meters, p_lecture_id, p_section
  )
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format(
      'generate_session: created session %s for subject %s (%s minutes, GPS: %s, code: %s, section: %s)',
      v_session.id, p_subject_id, p_duration_minutes,
      p_latitude IS NOT NULL, v_short_code,
      COALESCE(p_section, 'none')
    ),
    jsonb_build_object(
      'session_id', v_session.id::text,
      'subject_id', p_subject_id::text,
      'duration_minutes', p_duration_minutes,
      'gps_enabled', p_latitude IS NOT NULL,
      'short_code', v_short_code,
      'lecture_id', p_lecture_id::text,
      'section', p_section
    )
  );

  RETURN v_session;
END;
$$;

-- ─────────────────────────────────────────────
-- 3. refresh_session_hash
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_session_hash(
  p_session_id UUID
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller     public.users;
  v_session    public.sessions;
  v_hash       TEXT;
  v_short_code TEXT;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may refresh sessions';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only refresh their assigned subject sessions';
  END IF;

  IF v_session.expires_at <= now() THEN
    RAISE EXCEPTION 'conflict: session is already expired';
  END IF;

  v_hash := replace(gen_random_uuid()::text, '-', '') ||
            replace(gen_random_uuid()::text, '-', '');

  v_short_code := lpad(floor(random() * 1000000)::text, 6, '0');

  UPDATE public.sessions
  SET rotating_hash = v_hash, short_code = v_short_code
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('refresh_session_hash: refreshed session %s (code: %s)', p_session_id, v_short_code),
    jsonb_build_object('session_id', p_session_id::text, 'short_code', v_short_code)
  );

  RETURN v_session;
END;
$$;

-- ─────────────────────────────────────────────
-- 4. stop_session (immediate expiry)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stop_session(
  p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may stop sessions';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only stop their assigned subject sessions';
  END IF;

  UPDATE public.sessions SET expires_at = now() WHERE id = p_session_id;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('stop_session: stopped session %s', p_session_id),
    jsonb_build_object('session_id', p_session_id::text)
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 5. set_session_duration  (reset remaining time from now)
--    update_session_duration(p_session_id, p_new_duration_minutes)
--    is a thin alias the frontend calls — defined right after.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_session_duration(
  p_session_id       UUID,
  p_duration_minutes INTEGER
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may update session duration';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 OR p_duration_minutes > 180 THEN
    RAISE EXCEPTION 'validation_error: duration must be between 1 and 180 minutes';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only update their assigned subject sessions';
  END IF;

  UPDATE public.sessions
  SET expires_at = now() + make_interval(mins => p_duration_minutes)
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('set_session_duration: session %s -> %s minutes', p_session_id, p_duration_minutes),
    jsonb_build_object('session_id', p_session_id::text, 'duration_minutes', p_duration_minutes)
  );

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_session_duration(
  p_session_id           UUID,
  p_new_duration_minutes INTEGER
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  RETURN public.set_session_duration(p_session_id, p_new_duration_minutes);
END;
$$;

-- ─────────────────────────────────────────────
-- 6. set_session_expiry (open / close to exact timestamp)
--    Frontend calls "set_session_expiry".
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_session_expiry(
  p_session_id  UUID,
  p_expires_at  TIMESTAMPTZ
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may modify sessions';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only modify their assigned subject sessions';
  END IF;

  UPDATE public.sessions
  SET expires_at = p_expires_at
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('set_session_expiry: session %s expires_at -> %s', p_session_id, p_expires_at),
    jsonb_build_object('session_id', p_session_id::text, 'expires_at', p_expires_at::text)
  );

  RETURN v_session;
END;
$$;

-- ─────────────────────────────────────────────
-- 7. cleanup_expired_sessions  (pg_cron target, >1h expired)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.sessions
  WHERE expires_at < now() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ─────────────────────────────────────────────
-- 8. log_login_session  (dedup within 10 min)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_login_session()
RETURNS public.login_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller     public.users;
  v_ip         TEXT;
  v_agent      TEXT;
  v_existing   public.login_sessions;
  v_row        public.login_sessions;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'permission_denied: authenticated user required';
  END IF;

  v_ip := private.current_request_ip();
  v_agent := private.current_request_user_agent();

  SELECT * INTO v_existing
  FROM public.login_sessions
  WHERE user_id = v_caller.id
    AND ip_address IS NOT DISTINCT FROM v_ip
    AND user_agent IS NOT DISTINCT FROM v_agent
    AND created_at > now() - INTERVAL '10 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.login_sessions (user_id, ip_address, user_agent)
  VALUES (v_caller.id, v_ip, v_agent)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ─────────────────────────────────────────────
-- 9. submit_attendance (CONSOLIDATED, 4-param — matches frontend)
--    student hash + device fingerprint + GPS.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_hash                   TEXT,
  p_device_fingerprint     TEXT            DEFAULT NULL,
  p_student_latitude       DOUBLE PRECISION DEFAULT NULL,
  p_student_longitude      DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller   public.users;
  v_session  public.sessions;
  v_record   public.attendance;
  v_device   public.student_devices;
  v_fp       TEXT;
  v_ip       TEXT;
  v_recent   INTEGER;
  v_distance DOUBLE PRECISION;
  v_window   BIGINT;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  -- Rate limiting: max 10 log lines per minute from this student.
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

  -- Auto-generate fingerprint from request headers if not provided.
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

  -- Match by TOTP (current/previous window) OR short_code.
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

  -- Cross-subject check (students belong to no subject; compare session's).
  IF v_caller.subject_id IS DISTINCT FROM v_session.subject_id THEN
    RAISE EXCEPTION 'permission_denied: session does not belong to your subject';
  END IF;

  -- GPS verification.
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
  ELSIF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
          AND (p_student_latitude IS NULL OR p_student_longitude IS NULL) THEN
    RAISE EXCEPTION 'location_denied: this session requires GPS verification, please enable location.';
  END IF;

  -- Device binding.
  SELECT * INTO v_device
  FROM public.student_devices
  WHERE student_id = v_caller.id;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.student_devices
      WHERE device_fingerprint = v_fp AND student_id <> v_caller.id
    ) THEN
      RAISE EXCEPTION 'device_conflict: this device is already linked to another student';
    END IF;

    INSERT INTO public.student_devices (student_id, device_fingerprint, ip_address, bound_at, last_seen_at)
    VALUES (v_caller.id, v_fp, v_ip, now(), now());
  ELSIF v_device.device_fingerprint IS DISTINCT FROM v_fp THEN
    RAISE EXCEPTION 'device_mismatch: this account is already linked to another device';
  ELSE
    UPDATE public.student_devices
    SET ip_address = v_ip, last_seen_at = now()
    WHERE student_id = v_caller.id;
  END IF;

  -- Duplicate check (UNIQUE constraint is the hard stop).
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'conflict: attendance already submitted for this session';
  END IF;

  INSERT INTO public.attendance (
    student_id, session_id,
    student_latitude, student_longitude,
    ip_address, section
  )
  VALUES (
    v_caller.id, v_session.id,
    p_student_latitude, p_student_longitude,
    v_ip, v_session.section
  )
  RETURNING * INTO v_record;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format(
      'submit_attendance: student %s -> session %s (device bound, GPS: %s)',
      v_caller.id, v_session.id,
      CASE WHEN p_student_latitude IS NOT NULL THEN 'yes' ELSE 'no' END
    ),
    jsonb_build_object(
      'session_id', v_session.id::text,
      'device_bound', TRUE,
      'gps_enabled', p_student_latitude IS NOT NULL
    )
  );

  RETURN v_record;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'device_conflict: this device is already linked to another student';
END;
$$;

-- ─────────────────────────────────────────────
-- 10. delete_student_device  (owner only)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_student_device(
  p_student_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
  v_target public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may clear student devices';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: student % does not exist', p_student_id;
  END IF;

  IF v_target.role <> 'student' THEN
    RAISE EXCEPTION 'validation_error: target user must be a student';
  END IF;

  DELETE FROM public.student_devices WHERE student_id = p_student_id;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('delete_student_device: cleared device binding for student %s', p_student_id),
    jsonb_build_object('student_id', p_student_id::text)
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 11. fetch_lectures
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fetch_lectures(
  p_subject_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  subject_id     UUID,
  title          TEXT,
  lecture_date   DATE,
  created_by     UUID,
  created_at     TIMESTAMPTZ,
  subject_name   TEXT,
  session_count  BIGINT,
  attendee_count BIGINT,
  is_ended       BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    l.id,
    l.subject_id,
    l.title,
    l.lecture_date,
    l.created_by,
    l.created_at,
    s.name                                       AS subject_name,
    COUNT(DISTINCT se.id)                        AS session_count,
    COUNT(DISTINCT a.id)                         AS attendee_count,
    COALESCE(BOOL_AND(se.expires_at <= now()), TRUE) AS is_ended
  FROM   public.lectures  l
  JOIN   public.subjects  s  ON s.id = l.subject_id
  LEFT JOIN public.sessions  se ON se.lecture_id = l.id
  LEFT JOIN public.attendance a  ON a.session_id = se.id
  WHERE  (p_subject_id IS NULL OR l.subject_id = p_subject_id)
  GROUP  BY l.id, l.subject_id, l.title, l.lecture_date,
            l.created_by, l.created_at, s.name
  ORDER  BY l.lecture_date DESC, l.created_at DESC;
$$;

-- ─────────────────────────────────────────────
-- 12. create_lecture
-- ─────────────────────────────────────────────
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
  v_caller  public.users;
  v_lecture public.lectures;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may create lectures';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
    RAISE EXCEPTION 'not_found: subject % does not exist', p_subject_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_caller.subject_id IS DISTINCT FROM p_subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only create lectures for their assigned subject';
  END IF;

  INSERT INTO public.lectures (subject_id, title, created_by)
  VALUES (p_subject_id, COALESCE(NULLIF(trim(p_title), ''), 'محاضرة'), v_caller.id)
  RETURNING * INTO v_lecture;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('create_lecture: created lecture %s for subject %s', v_lecture.id, p_subject_id),
    jsonb_build_object('lecture_id', v_lecture.id::text, 'subject_id', p_subject_id::text)
  );

  RETURN v_lecture;
END;
$$;

-- ─────────────────────────────────────────────
-- 13. get_lecture_attendees
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_lecture_attendees(
  p_lecture_id UUID
)
RETURNS TABLE (
  attendance_id     UUID,
  student_name      TEXT,
  national_id       TEXT,
  session_id        UUID,
  short_code        TEXT,
  submitted_at      TIMESTAMPTZ,
  ip_address        TEXT,
  student_latitude  DOUBLE PRECISION,
  student_longitude DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    a.id            AS attendance_id,
    u.full_name     AS student_name,
    u.national_id,
    a.session_id,
    se.short_code,
    a.created_at    AS submitted_at,
    sd.ip_address,
    a.student_latitude,
    a.student_longitude
  FROM public.attendance     a
  JOIN public.sessions       se ON se.id  = a.session_id
  JOIN public.users          u  ON u.id   = a.student_id
  LEFT JOIN public.student_devices sd ON sd.student_id = a.student_id
  WHERE se.lecture_id = p_lecture_id
  ORDER BY a.created_at DESC;
$$;

-- ─────────────────────────────────────────────
-- 14. end_lecture  (expire all active sessions)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.end_lecture(
  p_lecture_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may end lectures';
  END IF;

  UPDATE public.sessions
  SET    expires_at = now()
  WHERE  lecture_id = p_lecture_id
    AND  expires_at > now();

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('end_lecture: ended all sessions for lecture %s', p_lecture_id),
    jsonb_build_object('lecture_id', p_lecture_id::text)
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 15. delete_lecture  (owner only)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_lecture(
  p_lecture_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may delete lectures';
  END IF;

  DELETE FROM public.attendance
  WHERE session_id IN (SELECT id FROM public.sessions WHERE lecture_id = p_lecture_id);

  DELETE FROM public.sessions WHERE lecture_id = p_lecture_id;

  DELETE FROM public.lectures WHERE id = p_lecture_id;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('delete_lecture: permanently deleted lecture %s with all sessions and attendance', p_lecture_id),
    jsonb_build_object('lecture_id', p_lecture_id::text)
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 16. clear_system_logs  (owner only)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_system_logs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may clear system logs';
  END IF;

  DELETE FROM public.system_logs;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (v_caller.id, 'clear_system_logs: all previous logs cleared by owner', '{}');
END;
$$;

-- ─────────────────────────────────────────────
-- 17. delete_user_by_id  (owner only)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_by_id(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_caller  public.users;
  v_target  public.users;
  v_auth_id uuid;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may delete users';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  IF v_target.role = 'owner' AND v_caller.id = p_user_id THEN
    RAISE EXCEPTION 'validation_error: owners cannot delete themselves';
  END IF;

  v_auth_id := v_target.auth_id;

  DELETE FROM public.users WHERE id = p_user_id;

  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('delete_user: deleted user %s (role=%s, name=%s)', p_user_id, v_target.role, v_target.full_name),
    jsonb_build_object('user_id', p_user_id::text, 'role', v_target.role::text)
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 18. add_manual_attendance  (owner / doctor / ta)
-- ─────────────────────────────────────────────
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
  v_caller  public.users;
  v_student public.users;
  v_session public.sessions;
  v_record  public.attendance;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may add manual attendance';
  END IF;

  SELECT * INTO v_student FROM public.users WHERE id = p_student_id AND role = 'student';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: student % does not exist', p_student_id;
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role = 'doctor' AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors may only add attendance for their assigned subject';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = p_student_id AND session_id = p_session_id
  ) THEN
    RAISE EXCEPTION 'conflict: attendance already recorded for this student/session';
  END IF;

  INSERT INTO public.attendance (student_id, session_id)
  VALUES (p_student_id, p_session_id)
  RETURNING * INTO v_record;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('add_manual_attendance: student %s -> session %s (by %s)', p_student_id, p_session_id, v_caller.id),
    jsonb_build_object(
      'student_id', p_student_id::text,
      'session_id', p_session_id::text,
      'by_user_id', v_caller.id::text
    )
  );

  RETURN v_record;
END;
$$;

-- ─────────────────────────────────────────────
-- 19. update_user  (owner only)
--    Frontend: update_user(p_user_id, p_full_name, p_national_id, p_subject_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_user(
  p_user_id     UUID,
  p_full_name   TEXT,
  p_national_id TEXT DEFAULT NULL,
  p_subject_id  UUID DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_caller  public.users;
  v_target  public.users;
  v_updated public.users;
BEGIN
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may update user profiles';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) < 5 THEN
    RAISE EXCEPTION 'validation_error: full_name must be at least 5 characters';
  END IF;

  UPDATE public.users
  SET
    full_name   = trim(p_full_name),
    national_id = CASE WHEN v_target.role = 'student' THEN p_national_id ELSE v_target.national_id END,
    subject_id  = CASE WHEN v_target.role IN ('doctor', 'ta') THEN p_subject_id ELSE v_target.subject_id END
  WHERE id = p_user_id
  RETURNING * INTO v_updated;

  INSERT INTO public.system_logs (actor_id, action, metadata)
  VALUES (
    v_caller.id,
    format('update_user: updated user %s (role=%s)', p_user_id, v_target.role),
    jsonb_build_object('user_id', p_user_id::text, 'role', v_target.role::text)
  );

  RETURN v_updated;
END;
$$;
