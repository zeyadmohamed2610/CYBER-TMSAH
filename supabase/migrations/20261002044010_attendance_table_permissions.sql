-- Narrow RPC workers preserve table read-only grants for authenticated users.
-- Each worker validates auth.uid() and its subject scope before writing.
CREATE OR REPLACE FUNCTION private.attendance_add_manual_attendance(p_student_id uuid, p_session_id uuid)
 RETURNS attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_student     public.users;
  v_session     public.sessions;
  v_record      public.attendance;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject((SELECT subject_id FROM public.sessions WHERE id=p_session_id)),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
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
$function$;
CREATE OR REPLACE FUNCTION public.add_manual_attendance(p_student_id uuid, p_session_id uuid)
 RETURNS attendance
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
RETURN private.attendance_add_manual_attendance(p_student_id,p_session_id);
END;
$function$;
REVOKE ALL ON FUNCTION private.attendance_add_manual_attendance(p_student_id uuid, p_session_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_add_manual_attendance(p_student_id uuid, p_session_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.add_manual_attendance(p_student_id uuid, p_session_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_manual_attendance(p_student_id uuid, p_session_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_create_lecture(p_subject_id uuid, p_title text DEFAULT 'محاضرة'::text)
 RETURNS lectures
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_lecture     public.lectures;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject(p_subject_id),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
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
$function$;
CREATE OR REPLACE FUNCTION public.create_lecture(p_subject_id uuid, p_title text DEFAULT 'محاضرة'::text)
 RETURNS lectures
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
RETURN private.attendance_create_lecture(p_subject_id,p_title);
END;
$function$;
REVOKE ALL ON FUNCTION private.attendance_create_lecture(p_subject_id uuid, p_title text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_create_lecture(p_subject_id uuid, p_title text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_lecture(p_subject_id uuid, p_title text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_lecture(p_subject_id uuid, p_title text) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_delete_lecture(p_lecture_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject((SELECT subject_id FROM public.lectures WHERE id=p_lecture_id)),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
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
$function$;
CREATE OR REPLACE FUNCTION public.delete_lecture(p_lecture_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
PERFORM private.attendance_delete_lecture(p_lecture_id); RETURN;
END;
$function$;
REVOKE ALL ON FUNCTION private.attendance_delete_lecture(p_lecture_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_delete_lecture(p_lecture_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_lecture(p_lecture_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_lecture(p_lecture_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_end_lecture(p_lecture_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject((SELECT subject_id FROM public.lectures WHERE id=p_lecture_id)),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
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
$function$;
CREATE OR REPLACE FUNCTION public.end_lecture(p_lecture_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
PERFORM private.attendance_end_lecture(p_lecture_id); RETURN;
END;
$function$;
REVOKE ALL ON FUNCTION private.attendance_end_lecture(p_lecture_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_end_lecture(p_lecture_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.end_lecture(p_lecture_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.end_lecture(p_lecture_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_generate_rotating_hash(p_subject_id uuid, p_duration_minutes integer DEFAULT 10, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_meters integer DEFAULT 50, p_lecture_id uuid DEFAULT NULL::uuid, p_section text DEFAULT NULL::text)
 RETURNS sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_hash        TEXT;
  v_short_code  TEXT;
  v_session     public.sessions;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject(p_subject_id),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
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

  IF p_lecture_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.lectures WHERE id=p_lecture_id AND subject_id=p_subject_id) THEN RAISE EXCEPTION 'validation_error: lecture subject mismatch'; END IF;
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
$function$;
CREATE OR REPLACE FUNCTION public.generate_rotating_hash(p_subject_id uuid, p_duration_minutes integer DEFAULT 10, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_meters integer DEFAULT 50, p_lecture_id uuid DEFAULT NULL::uuid, p_section text DEFAULT NULL::text)
 RETURNS sessions
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
BEGIN
RETURN private.attendance_generate_rotating_hash(p_subject_id,p_duration_minutes,p_latitude,p_longitude,p_radius_meters,p_lecture_id,p_section);
END;
$function$;
REVOKE ALL ON FUNCTION private.attendance_generate_rotating_hash(p_subject_id uuid, p_duration_minutes integer, p_latitude double precision, p_longitude double precision, p_radius_meters integer, p_lecture_id uuid, p_section text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_generate_rotating_hash(p_subject_id uuid, p_duration_minutes integer, p_latitude double precision, p_longitude double precision, p_radius_meters integer, p_lecture_id uuid, p_section text) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_rotating_hash(p_subject_id uuid, p_duration_minutes integer, p_latitude double precision, p_longitude double precision, p_radius_meters integer, p_lecture_id uuid, p_section text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_rotating_hash(p_subject_id uuid, p_duration_minutes integer, p_latitude double precision, p_longitude double precision, p_radius_meters integer, p_lecture_id uuid, p_section text) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_refresh_session_hash(p_session_id uuid)
 RETURNS sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_caller     public.users;
  v_session    public.sessions;
  v_hash       TEXT;
  v_short_code TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject((SELECT subject_id FROM public.sessions WHERE id=p_session_id)),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may refresh sessions';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role IN ('doctor', 'ta') AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors and TAs may only refresh their assigned subject sessions';
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

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id, format('refresh_session_hash: refreshed session %s (code: %s)', p_session_id, v_short_code));

  RETURN v_session;
END;
$function$;
CREATE OR REPLACE FUNCTION public.refresh_session_hash(p_session_id uuid)
 RETURNS sessions
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
RETURN private.attendance_refresh_session_hash(p_session_id);
END;
$function$;
REVOKE ALL ON FUNCTION private.attendance_refresh_session_hash(p_session_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_refresh_session_hash(p_session_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.refresh_session_hash(p_session_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_session_hash(p_session_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_set_session_duration(p_session_id uuid, p_duration_minutes integer)
 RETURNS sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject((SELECT subject_id FROM public.sessions WHERE id=p_session_id)),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

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

  IF v_caller.role IN ('doctor', 'ta') AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: doctors and TAs may only update their assigned subject sessions';
  END IF;

  UPDATE public.sessions
  SET expires_at = now() + make_interval(mins => p_duration_minutes)
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format('set_session_duration: session %s -> %s minutes', p_session_id, p_duration_minutes)
  );

  RETURN v_session;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_session_duration(p_session_id uuid, p_duration_minutes integer)
 RETURNS sessions
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
RETURN private.attendance_set_session_duration(p_session_id,p_duration_minutes);
END;
$function$;
REVOKE ALL ON FUNCTION private.attendance_set_session_duration(p_session_id uuid, p_duration_minutes integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_set_session_duration(p_session_id uuid, p_duration_minutes integer) TO authenticated;
REVOKE ALL ON FUNCTION public.set_session_duration(p_session_id uuid, p_duration_minutes integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_session_duration(p_session_id uuid, p_duration_minutes integer) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_stop_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_session     public.sessions;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject((SELECT subject_id FROM public.sessions WHERE id=p_session_id)),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role'
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
$function$;
CREATE OR REPLACE FUNCTION public.stop_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
PERFORM private.attendance_stop_session(p_session_id); RETURN;
END;
$function$;
REVOKE ALL ON FUNCTION private.attendance_stop_session(p_session_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_stop_session(p_session_id uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.stop_session(p_session_id uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.stop_session(p_session_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.attendance_update_session_expiry(p_session_id uuid, p_expires_at timestamp with time zone)
 RETURNS sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_caller  public.users;
  v_session public.sessions;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(private.can_manage_subject((SELECT subject_id FROM public.sessions WHERE id=p_session_id)),false) THEN
    RAISE EXCEPTION 'permission_denied: subject is outside your assignment';
  END IF;

  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor', 'ta') THEN
    RAISE EXCEPTION 'permission_denied: only owners, doctors and TAs may update sessions';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: session % does not exist', p_session_id;
  END IF;

  IF v_caller.role IN ('doctor', 'ta') AND v_session.subject_id IS DISTINCT FROM v_caller.subject_id THEN
    RAISE EXCEPTION 'permission_denied: you may only update sessions for your assigned subject';
  END IF;

  UPDATE public.sessions SET expires_at = p_expires_at WHERE id = p_session_id RETURNING * INTO v_session;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format('update_session_expiry: session %s -> %s', p_session_id, p_expires_at)
  );

  RETURN v_session;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_session_expiry(p_session_id uuid, p_expires_at timestamp with time zone)
 RETURNS sessions
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
RETURN private.attendance_update_session_expiry(p_session_id,p_expires_at);
END;
$function$;
REVOKE ALL ON FUNCTION private.attendance_update_session_expiry(p_session_id uuid, p_expires_at timestamp with time zone) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_update_session_expiry(p_session_id uuid, p_expires_at timestamp with time zone) TO authenticated;
REVOKE ALL ON FUNCTION public.update_session_expiry(p_session_id uuid, p_expires_at timestamp with time zone) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_session_expiry(p_session_id uuid, p_expires_at timestamp with time zone) TO authenticated;
