BEGIN;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.assert_owner()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN;
  END IF;

  IF public.current_app_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Owner role required';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.private_haversine_meters(
  p_lat1 DOUBLE PRECISION,
  p_lon1 DOUBLE PRECISION,
  p_lat2 DOUBLE PRECISION,
  p_lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_earth_radius DOUBLE PRECISION := 6371000.0;
  v_d_lat DOUBLE PRECISION;
  v_d_lon DOUBLE PRECISION;
  v_a DOUBLE PRECISION;
  v_c DOUBLE PRECISION;
BEGIN
  v_d_lat := radians(p_lat2 - p_lat1);
  v_d_lon := radians(p_lon2 - p_lon1);

  v_a :=
    sin(v_d_lat / 2) * sin(v_d_lat / 2) +
    cos(radians(p_lat1)) * cos(radians(p_lat2)) *
    sin(v_d_lon / 2) * sin(v_d_lon / 2);

  v_c := 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
  RETURN v_earth_radius * v_c;
END;
$$;

CREATE OR REPLACE FUNCTION public.private_expected_rotating_hash(
  p_session_id UUID,
  p_time_window BIGINT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT := current_setting('app.settings.server_secret', true);
BEGIN
  IF v_secret IS NULL OR length(v_secret) = 0 THEN
    RAISE EXCEPTION 'Server secret is not configured (app.settings.server_secret)';
  END IF;

  RETURN encode(
    hmac(format('%s:%s', p_session_id, p_time_window), v_secret, 'sha256'),
    'hex'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_record_failed_login(
  p_email CITEXT,
  p_ip_address INET DEFAULT NULL,
  p_device_hash TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = p_email;

  IF v_user_id IS NULL THEN
    INSERT INTO public.system_logs (action, severity, metadata, ip_address, device_hash)
    VALUES (
      'auth_failed_login_unknown_user',
      'warning',
      jsonb_build_object('email', p_email),
      p_ip_address,
      p_device_hash
    );
    RETURN;
  END IF;

  UPDATE public.users
  SET
    failed_login_attempts = failed_login_attempts + 1,
    last_failed_login_at = now(),
    account_locked_until = CASE
      WHEN failed_login_attempts + 1 >= 5 THEN greatest(coalesce(account_locked_until, now()), now() + interval '15 minutes')
      ELSE account_locked_until
    END
  WHERE id = v_user_id
  RETURNING failed_login_attempts, account_locked_until
  INTO v_attempts, v_locked_until;

  INSERT INTO public.system_logs (actor_user_id, action, severity, metadata, ip_address, device_hash)
  VALUES (
    v_user_id,
    'auth_failed_login',
    CASE WHEN v_attempts >= 5 THEN 'critical' ELSE 'warning' END,
    jsonb_build_object(
      'failed_attempts', v_attempts,
      'locked_until', v_locked_until
    ),
    p_ip_address,
    p_device_hash
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_clear_failed_login(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND public.current_app_role() IS DISTINCT FROM 'owner'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to clear failed login attempts';
  END IF;

  UPDATE public.users
  SET
    failed_login_attempts = 0,
    account_locked_until = NULL,
    last_failed_login_at = NULL,
    updated_by = auth.uid()
  WHERE id = p_user_id;

  INSERT INTO public.system_logs (actor_user_id, action, severity, metadata)
  VALUES (
    auth.uid(),
    'auth_failed_login_reset',
    'info',
    jsonb_build_object('target_user_id', p_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_owner_set_user_role(
  p_target_user_id UUID,
  p_new_role public.user_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_owner();

  UPDATE public.users
  SET role = p_new_role, updated_by = auth.uid()
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.system_logs (actor_user_id, action, severity, metadata)
  VALUES (
    auth.uid(),
    'owner_set_user_role',
    'warning',
    jsonb_build_object('target_user_id', p_target_user_id, 'new_role', p_new_role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_owner_reset_student_device(
  student_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR public.current_app_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Owner role required';
  END IF;

  UPDATE public.users
  SET
    device_fingerprint_hash = NULL,
    updated_by = auth.uid()
  WHERE id = student_id
    AND role = 'student';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  INSERT INTO public.system_logs (actor_user_id, action, severity, metadata)
  VALUES (
    auth.uid(),
    'owner_reset_device_binding',
    'warning',
    jsonb_build_object('student_id', student_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_owner_upsert_subject(
  p_subject_id UUID DEFAULT NULL,
  p_code TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject_id UUID;
BEGIN
  PERFORM public.assert_owner();

  IF p_subject_id IS NULL THEN
    IF p_code IS NULL OR p_name IS NULL THEN
      RAISE EXCEPTION 'code and name are required for subject creation';
    END IF;

    INSERT INTO public.subjects (code, name, owner_id, is_active, created_by, updated_by)
    VALUES (p_code, p_name, auth.uid(), p_is_active, auth.uid(), auth.uid())
    RETURNING id INTO v_subject_id;
  ELSE
    UPDATE public.subjects
    SET
      code = coalesce(p_code, code),
      name = coalesce(p_name, name),
      is_active = coalesce(p_is_active, is_active),
      updated_by = auth.uid()
    WHERE id = p_subject_id
    RETURNING id INTO v_subject_id;

    IF v_subject_id IS NULL THEN
      RAISE EXCEPTION 'Subject not found';
    END IF;
  END IF;

  INSERT INTO public.system_logs (actor_user_id, action, severity, metadata)
  VALUES (
    auth.uid(),
    'owner_upsert_subject',
    'info',
    jsonb_build_object('subject_id', v_subject_id)
  );

  RETURN v_subject_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_owner_create_session(
  p_subject_id UUID,
  p_doctor_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_room TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_geofence_radius_meters INTEGER DEFAULT 120,
  p_status public.session_status DEFAULT 'scheduled'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  PERFORM public.assert_owner();

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'Session end time must be greater than start time';
  END IF;

  IF p_status = 'active' AND p_ends_at <= now() THEN
    RAISE EXCEPTION 'Session cannot be created as active when end time is in the past';
  END IF;

  IF p_status = 'active' AND p_ends_at > now() THEN
    IF EXISTS (
      SELECT 1
      FROM public.sessions
      WHERE doctor_id = p_doctor_id
        AND status = 'active'
        AND ends_at > now()
    ) THEN
      RAISE EXCEPTION 'Doctor already has an active session that has not ended';
    END IF;
  END IF;

  INSERT INTO public.sessions (
    subject_id,
    doctor_id,
    starts_at,
    ends_at,
    room,
    latitude,
    longitude,
    geofence_radius_meters,
    status,
    created_by,
    updated_by
  )
  VALUES (
    p_subject_id,
    p_doctor_id,
    p_starts_at,
    p_ends_at,
    p_room,
    p_latitude,
    p_longitude,
    p_geofence_radius_meters,
    p_status,
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.system_logs (actor_user_id, action, severity, metadata)
  VALUES (
    auth.uid(),
    'owner_create_session',
    'info',
    jsonb_build_object('session_id', v_session_id, 'subject_id', p_subject_id, 'doctor_id', p_doctor_id)
  );

  RETURN v_session_id;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_submit_attendance(UUID, TEXT, BIGINT, NUMERIC, NUMERIC, TEXT, INET, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.rpc_submit_attendance(
  p_session_id UUID,
  p_rotating_hash TEXT,
  p_time_window BIGINT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_request_nonce TEXT,
  p_ip_address INET DEFAULT NULL,
  p_device_hash TEXT DEFAULT NULL,
  p_device_fingerprint_raw TEXT DEFAULT NULL,
  p_student_id UUID DEFAULT NULL
)
RETURNS TABLE (
  attendance_id UUID,
  recorded_at TIMESTAMPTZ,
  attendance_status public.attendance_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_student_id UUID := coalesce(p_student_id, auth.uid());
  v_student_role public.user_role;
  v_locked_until TIMESTAMPTZ;
  v_expected_hash TEXT;
  v_distance_meters DOUBLE PRECISION;
  v_recent_attempts INTEGER;
  v_device_fingerprint_hash TEXT;
  v_stored_device_fingerprint_hash TEXT;
  v_inserted public.attendance%ROWTYPE;
  v_session public.sessions%ROWTYPE;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role, account_locked_until
  INTO v_student_role, v_locked_until
  FROM public.users
  WHERE id = v_student_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student profile not found or inactive';
  END IF;

  IF v_student_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Only users with student role can submit attendance';
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > v_now THEN
    RAISE EXCEPTION 'Account is temporarily locked';
  END IF;

  SELECT count(*) INTO v_recent_attempts
  FROM public.system_logs
  WHERE action = 'attendance_submit_attempt'
    AND created_at > (v_now - interval '1 minute')
    AND (
      (p_ip_address IS NOT NULL AND ip_address = p_ip_address)
      OR (p_device_hash IS NOT NULL AND device_hash = p_device_hash)
    );

  IF v_recent_attempts >= 20 THEN
    INSERT INTO public.system_logs (actor_user_id, action, severity, metadata, ip_address, device_hash)
    VALUES (
      v_student_id,
      'attendance_rate_limit_hit',
      'critical',
      jsonb_build_object('recent_attempts', v_recent_attempts),
      p_ip_address,
      p_device_hash
    );
    RAISE EXCEPTION 'Too many attempts. Please wait and retry.';
  END IF;

  INSERT INTO public.system_logs (actor_user_id, action, severity, metadata, ip_address, device_hash)
  VALUES (
    v_student_id,
    'attendance_submit_attempt',
    'info',
    jsonb_build_object('session_id', p_session_id, 'time_window', p_time_window),
    p_ip_address,
    p_device_hash
  );

  SELECT * INTO v_session
  FROM public.sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_now < v_session.starts_at THEN
    RAISE EXCEPTION 'Session has not started yet';
  END IF;

  IF v_now > v_session.ends_at THEN
    RAISE EXCEPTION 'Session has ended';
  END IF;

  IF v_session.status IN ('ended', 'cancelled') THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  IF NOT (v_now BETWEEN v_session.starts_at AND v_session.ends_at)
     OR v_session.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Session is outside the hard-expiry active window';
  END IF;

  IF abs(p_time_window - floor(extract(epoch FROM v_now) / 30)::BIGINT) > 1 THEN
    RAISE EXCEPTION 'Invalid time window';
  END IF;

  v_expected_hash := public.private_expected_rotating_hash(p_session_id, p_time_window);
  IF p_rotating_hash IS DISTINCT FROM v_expected_hash THEN
    RAISE EXCEPTION 'Rotating hash mismatch';
  END IF;

  v_distance_meters := public.private_haversine_meters(
    p_latitude::DOUBLE PRECISION,
    p_longitude::DOUBLE PRECISION,
    v_session.latitude::DOUBLE PRECISION,
    v_session.longitude::DOUBLE PRECISION
  );

  IF v_distance_meters > v_session.geofence_radius_meters THEN
    RAISE EXCEPTION 'Geolocation validation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attendance
    WHERE request_nonce = p_request_nonce
  ) THEN
    RAISE EXCEPTION 'Replay detected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attendance
    WHERE session_id = p_session_id
      AND student_id = v_student_id
  ) THEN
    RAISE EXCEPTION 'Duplicate attendance submission';
  END IF;

  IF p_device_fingerprint_raw IS NULL OR length(btrim(p_device_fingerprint_raw)) = 0 THEN
    RAISE EXCEPTION 'Device fingerprint is required';
  END IF;

  v_device_fingerprint_hash := encode(digest(p_device_fingerprint_raw, 'sha256'), 'hex');

  SELECT device_fingerprint_hash
  INTO v_stored_device_fingerprint_hash
  FROM public.users
  WHERE id = v_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student profile not found or inactive';
  END IF;

  IF v_stored_device_fingerprint_hash IS NULL THEN
    UPDATE public.users
    SET
      device_fingerprint_hash = v_device_fingerprint_hash,
      updated_by = coalesce(auth.uid(), updated_by)
    WHERE id = v_student_id;
  ELSIF v_stored_device_fingerprint_hash IS DISTINCT FROM v_device_fingerprint_hash THEN
    INSERT INTO public.system_logs (actor_user_id, action, severity, metadata, ip_address, device_hash)
    VALUES (
      v_student_id,
      'device_binding_violation',
      'warning',
      jsonb_build_object('session_id', p_session_id),
      p_ip_address,
      p_device_hash
    );
    RAISE EXCEPTION 'هذا الحساب مرتبط بجهاز آخر';
  END IF;

  INSERT INTO public.attendance (
    session_id,
    student_id,
    status,
    submitted_window,
    rotating_hash,
    request_nonce,
    ip_address,
    device_hash,
    latitude,
    longitude
  )
  VALUES (
    p_session_id,
    v_student_id,
    'present',
    p_time_window,
    p_rotating_hash,
    p_request_nonce,
    p_ip_address,
    coalesce(p_device_hash, 'unknown-device'),
    p_latitude,
    p_longitude
  )
  RETURNING * INTO v_inserted;

  INSERT INTO public.system_logs (actor_user_id, action, severity, metadata, ip_address, device_hash)
  VALUES (
    v_student_id,
    'attendance_submit_success',
    'info',
    jsonb_build_object(
      'attendance_id', v_inserted.id,
      'session_id', p_session_id,
      'distance_meters', round(v_distance_meters::numeric, 2)
    ),
    p_ip_address,
    p_device_hash
  );

  RETURN QUERY
  SELECT v_inserted.id, v_inserted.submitted_at, v_inserted.status;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.system_logs (actor_user_id, action, severity, metadata, ip_address, device_hash)
    VALUES (
      v_student_id,
      'attendance_submit_failed',
      'warning',
      jsonb_build_object(
        'session_id', p_session_id,
        'error', SQLERRM
      ),
      p_ip_address,
      p_device_hash
    );
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.private_haversine_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.private_expected_rotating_hash(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_record_failed_login(CITEXT, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_clear_failed_login(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_owner_set_user_role(UUID, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_owner_reset_student_device(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_owner_upsert_subject(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_owner_create_session(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC, INTEGER, public.session_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_submit_attendance(UUID, TEXT, BIGINT, NUMERIC, NUMERIC, TEXT, INET, TEXT, TEXT, UUID) TO authenticated;

COMMIT;
