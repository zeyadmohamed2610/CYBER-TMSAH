BEGIN;

-- Read the address captured with the attendance event. The legacy device table
-- no longer exists, and a device's current address is not historical evidence.
CREATE OR REPLACE FUNCTION public.get_lecture_attendees(p_lecture_id uuid)
RETURNS TABLE (
  attendance_id uuid, student_name text, national_id text, session_id uuid,
  short_code text, submitted_at timestamptz, ip_address text,
  student_latitude double precision, student_longitude double precision
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT a.id, u.full_name, u.national_id, a.session_id, se.short_code,
    a.created_at, a.ip_address, a.student_latitude, a.student_longitude
  FROM public.attendance a
  JOIN public.sessions se ON se.id = a.session_id
  JOIN public.users u ON u.id = a.student_id
  WHERE se.lecture_id = p_lecture_id
  ORDER BY a.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_lecture_attendees(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lecture_attendees(uuid) TO authenticated;

COMMIT;
