-- Keep authoritative roles in the profile linked to auth.uid().
CREATE OR REPLACE FUNCTION private.get_current_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION private.get_caller_user()
RETURNS public.users LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.can_manage_subject(p_subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.users u JOIN public.subjects s ON s.id=p_subject_id
 WHERE u.auth_id=auth.uid() AND (u.role='owner' OR
 (u.role='coordinator' AND u.department IS NOT DISTINCT FROM s.department) OR
 (u.role IN ('doctor','ta') AND u.subject_id=s.id)));
$$;
GRANT EXECUTE ON FUNCTION private.can_manage_subject(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_user_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller public.users;
BEGIN
 IF auth.uid() IS NULL THEN
   IF current_setting('request.jwt.claims',true)::jsonb ->> 'role' = 'authenticated' THEN
     RAISE EXCEPTION 'permission_denied';
   END IF;
   RETURN NEW;
 END IF;
 caller := private.get_caller_user();
 IF (NEW.id,NEW.auth_id,NEW.role,NEW.subject_id,NEW.department,NEW.academic_year,NEW.section_number,NEW.email,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.auth_id,OLD.role,OLD.subject_id,OLD.department,OLD.academic_year,OLD.section_number,OLD.email,OLD.created_at)
 THEN
   IF caller.role IS NULL OR caller.role NOT IN ('owner','coordinator') THEN
     RAISE EXCEPTION 'permission_denied: academic assignment is managed by administration';
   END IF;
   IF caller.role='coordinator' AND
     (OLD.role IN ('owner','coordinator') OR NEW.role IN ('owner','coordinator') OR
      OLD.department IS DISTINCT FROM caller.department OR NEW.department IS DISTINCT FROM caller.department) THEN
     RAISE EXCEPTION 'permission_denied: outside department';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_user_assignment BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION private.guard_user_assignment();

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);
CREATE TABLE public.session_roster (
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 PRIMARY KEY(session_id,student_id)
);
CREATE INDEX session_roster_student_idx ON public.session_roster(student_id,session_id);
ALTER TABLE public.session_roster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_roster FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.session_roster TO service_role;

CREATE OR REPLACE FUNCTION private.snapshot_session_roster()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.session_roster(session_id,student_id)
 SELECT NEW.id,u.id FROM public.users u JOIN public.subjects s ON s.id=NEW.subject_id
 WHERE u.role='student' AND
 (s.department IS NULL OR s.department=u.department) AND
 (s.academic_year IS NULL OR s.academic_year=u.academic_year) AND
 (NEW.section IS NULL OR NEW.section IN ('عام','') OR
  regexp_replace(NEW.section,'[^0-9]','','g')=u.section_number::text);
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_session_students AFTER INSERT ON public.sessions
FOR EACH ROW EXECUTE FUNCTION private.snapshot_session_roster();
INSERT INTO public.session_roster(session_id,student_id)
SELECT se.id,u.id FROM public.sessions se JOIN public.subjects s ON s.id=se.subject_id
JOIN public.users u ON u.role='student' AND u.created_at<=se.created_at
WHERE (s.department IS NULL OR s.department=u.department)
 AND (s.academic_year IS NULL OR s.academic_year=u.academic_year)
 AND (se.section IS NULL OR se.section IN ('عام','') OR regexp_replace(se.section,'[^0-9]','','g')=u.section_number::text)
ON CONFLICT DO NOTHING;

-- Staff can only alter lectures/sessions/records for the subjects they manage.
DROP POLICY IF EXISTS sessions_staff_insert ON public.sessions;
DROP POLICY IF EXISTS sessions_staff_update ON public.sessions;
DROP POLICY IF EXISTS sessions_staff_delete ON public.sessions;
DROP POLICY IF EXISTS sessions_select_consolidated ON public.sessions;
CREATE POLICY sessions_staff_insert ON public.sessions FOR INSERT TO authenticated
 WITH CHECK (private.can_manage_subject(subject_id) AND (lecture_id IS NULL OR EXISTS
 (SELECT 1 FROM public.lectures l WHERE l.id=lecture_id AND l.subject_id=sessions.subject_id)));
CREATE POLICY sessions_staff_update ON public.sessions FOR UPDATE TO authenticated
 USING(private.can_manage_subject(subject_id)) WITH CHECK(private.can_manage_subject(subject_id));
CREATE POLICY sessions_staff_delete ON public.sessions FOR DELETE TO authenticated USING(private.can_manage_subject(subject_id));
CREATE POLICY sessions_select_consolidated ON public.sessions FOR SELECT TO authenticated USING
 (private.can_manage_subject(subject_id) OR EXISTS (SELECT 1 FROM public.subjects s JOIN public.users u ON u.auth_id=auth.uid()
  WHERE s.id=subject_id AND u.role='student' AND (s.department IS NULL OR s.department=u.department)
  AND (s.academic_year IS NULL OR s.academic_year=u.academic_year)));

DROP POLICY IF EXISTS lectures_insert_consolidated ON public.lectures;
DROP POLICY IF EXISTS lectures_update_consolidated ON public.lectures;
DROP POLICY IF EXISTS lectures_delete_consolidated ON public.lectures;
DROP POLICY IF EXISTS lectures_select_consolidated ON public.lectures;
CREATE POLICY lectures_insert_consolidated ON public.lectures FOR INSERT TO authenticated WITH CHECK(private.can_manage_subject(subject_id));
CREATE POLICY lectures_update_consolidated ON public.lectures FOR UPDATE TO authenticated USING(private.can_manage_subject(subject_id)) WITH CHECK(private.can_manage_subject(subject_id));
CREATE POLICY lectures_delete_consolidated ON public.lectures FOR DELETE TO authenticated USING(private.can_manage_subject(subject_id));
CREATE POLICY lectures_select_consolidated ON public.lectures FOR SELECT TO authenticated USING
 (private.can_manage_subject(subject_id) OR EXISTS(SELECT 1 FROM public.subjects s JOIN public.users u ON u.auth_id=auth.uid()
 WHERE s.id=subject_id AND u.role='student' AND (s.department IS NULL OR s.department=u.department)
 AND (s.academic_year IS NULL OR s.academic_year=u.academic_year)));

DROP POLICY IF EXISTS attendance_insert_consolidated ON public.attendance;
DROP POLICY IF EXISTS attendance_select_consolidated ON public.attendance;
CREATE POLICY attendance_insert_consolidated ON public.attendance FOR INSERT TO authenticated WITH CHECK
 (EXISTS(SELECT 1 FROM public.sessions se WHERE se.id=session_id AND private.can_manage_subject(se.subject_id)));
CREATE POLICY attendance_select_consolidated ON public.attendance FOR SELECT TO authenticated USING
 (student_id=(SELECT u.id FROM public.users u WHERE u.auth_id=auth.uid()) OR
 EXISTS(SELECT 1 FROM public.sessions se WHERE se.id=session_id AND private.can_manage_subject(se.subject_id)));

-- This internal register needs to read immutable roster snapshots and historical
-- sessions. Authorization is applied before any row is returned.
CREATE OR REPLACE FUNCTION private.attendance_register()
RETURNS TABLE(unit_id uuid,lecture_id uuid,subject_id uuid,subject_name text,title text,lecture_date date,
 student_id uuid,student_name text,status text,submitted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE(se.lecture_id,se.id),se.lecture_id,se.subject_id,s.name,
 COALESCE(l.title,s.name),COALESCE(l.lecture_date,se.created_at::date),u.id,u.full_name,
 CASE WHEN COUNT(a.id)>0 THEN 'present' WHEN BOOL_OR(se.expires_at>now()) THEN 'pending' ELSE 'absent' END,
 MIN(a.created_at)
 FROM public.session_roster r JOIN public.sessions se ON se.id=r.session_id
 JOIN public.subjects s ON s.id=se.subject_id JOIN public.users u ON u.id=r.student_id
 LEFT JOIN public.lectures l ON l.id=se.lecture_id
 LEFT JOIN public.attendance a ON a.session_id=se.id AND a.student_id=u.id
 WHERE auth.uid() IS NOT NULL AND (u.auth_id=auth.uid() OR private.can_manage_subject(se.subject_id))
 GROUP BY COALESCE(se.lecture_id,se.id),se.lecture_id,se.subject_id,s.name,COALESCE(l.title,s.name),
 COALESCE(l.lecture_date,se.created_at::date),u.id,u.full_name;
$$;
REVOKE ALL ON FUNCTION private.attendance_register() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.attendance_register() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_attendance_register(p_lecture_id uuid DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(unit_id uuid,lecture_id uuid,subject_id uuid,subject_name text,title text,lecture_date date,
 student_id uuid,student_name text,status text,submitted_at timestamptz)
LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT * FROM private.attendance_register() r WHERE p_lecture_id IS NULL OR r.lecture_id=p_lecture_id
 ORDER BY lecture_date DESC,unit_id,student_name,student_id LIMIT LEAST(GREATEST(p_limit,1),1000) OFFSET GREATEST(p_offset,0);
$$;
REVOKE ALL ON FUNCTION public.get_attendance_register(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_register(uuid,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_attendance_summary(p_sections text[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
 WITH register AS (SELECT r.* FROM private.attendance_register() r WHERE p_sections IS NULL OR EXISTS
  (SELECT 1 FROM public.sessions se WHERE COALESCE(se.lecture_id,se.id)=r.unit_id AND se.section=ANY(p_sections))),
 summary AS (SELECT COUNT(DISTINCT unit_id) total,COUNT(DISTINCT student_id) students,
 COUNT(*) FILTER(WHERE status='present') present,COUNT(*) FILTER(WHERE status='absent') absent,
 COUNT(*) FILTER(WHERE status='pending') pending FROM register),
 subjects AS (SELECT subject_id,subject_name,COUNT(DISTINCT unit_id) total,
 COUNT(*) FILTER(WHERE status='present') present,COUNT(*) FILTER(WHERE status='absent') absent
 FROM register GROUP BY subject_id,subject_name)
 SELECT jsonb_build_object('dashboard',jsonb_build_object('totalSessions',total,'totalStudents',students,
 'activeSessions',(SELECT COUNT(*) FROM public.sessions WHERE expires_at>now()),
 'attendanceRate',CASE WHEN present+absent=0 THEN 0 ELSE 100.0*present/(present+absent) END,
 'pendingSubmissions',pending),'subjects',COALESCE((SELECT jsonb_agg(jsonb_build_object('subjectName',subject_name,
 'totalSessions',total,'attendanceRate',CASE WHEN present+absent=0 THEN 0 ELSE 100.0*present/(present+absent) END)
 ORDER BY subject_name) FROM subjects),'[]'::jsonb)) FROM summary;
$$;
REVOKE ALL ON FUNCTION public.get_attendance_summary(text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary(text[]) TO authenticated;

-- Do not expose internal trigger helpers as callable API operations.
REVOKE ALL ON FUNCTION private.guard_user_assignment(),private.snapshot_session_roster() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.validate_attendance_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE lecture uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.session_roster WHERE session_id=NEW.session_id AND student_id=NEW.student_id) THEN
   RAISE EXCEPTION 'permission_denied: student is not enrolled in this session';
 END IF;
 SELECT lecture_id INTO lecture FROM public.sessions WHERE id=NEW.session_id;
 -- Serialize submissions across different sessions belonging to one lecture.
 PERFORM pg_advisory_xact_lock(hashtext(NEW.student_id::text||COALESCE(lecture,NEW.session_id)::text));
 IF EXISTS(SELECT 1 FROM public.attendance a JOIN public.sessions se ON se.id=a.session_id
 WHERE a.student_id=NEW.student_id AND (se.id=NEW.session_id OR (lecture IS NOT NULL AND se.lecture_id=lecture))) THEN
   RAISE EXCEPTION 'already_recorded: attendance exists for this lecture';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_attendance_student BEFORE INSERT ON public.attendance
 FOR EACH ROW EXECUTE FUNCTION private.validate_attendance_enrollment();
REVOKE ALL ON FUNCTION private.validate_attendance_enrollment() FROM PUBLIC,anon,authenticated;

CREATE POLICY users_department_insert_boundary ON public.users AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(private.get_current_user_role()='owner' OR
 (private.get_current_user_role()='coordinator' AND role IN ('doctor','ta','student') AND
 department=(SELECT u.department FROM public.users u WHERE u.auth_id=auth.uid())));
CREATE POLICY users_department_delete_boundary ON public.users AS RESTRICTIVE FOR DELETE TO authenticated
 USING(private.get_current_user_role()='owner' OR
 (private.get_current_user_role()='coordinator' AND role IN ('doctor','ta','student') AND
 department=(SELECT u.department FROM public.users u WHERE u.auth_id=auth.uid())));
