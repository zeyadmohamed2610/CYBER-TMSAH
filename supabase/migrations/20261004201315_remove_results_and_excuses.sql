BEGIN;

-- Remove the retired follow-up feature; keep core attendance and schedule history.

CREATE OR REPLACE FUNCTION private.lifecycle_register(p_term uuid DEFAULT NULL::uuid)
 RETURNS TABLE(unit_id uuid, lecture_id uuid, subject_id uuid, subject_name text, title text, lecture_date date, student_id uuid, student_name text, status text, submitted_at timestamp with time zone, kind text, term_id uuid, student_snapshot jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT COALESCE(se.lecture_id,se.id),se.lecture_id,se.subject_id,s.name,COALESCE(l.title,s.name),COALESCE(l.lecture_date,(se.created_at AT TIME ZONE 'Africa/Cairo')::date),u.id,
 COALESCE((jsonb_agg(r.student_snapshot ORDER BY se.created_at,se.id)->0)->>'name',u.full_name),
 CASE WHEN COUNT(a.id)>0 THEN 'present' WHEN BOOL_OR(se.expires_at>now()) THEN 'pending' ELSE 'absent' END,
 MIN(a.created_at),COALESCE(l.kind,CASE WHEN se.section IS NULL OR se.section IN ('','عام','all') THEN 'lecture' ELSE 'section' END),se.term_id,jsonb_agg(r.student_snapshot ORDER BY se.created_at,se.id)->0
 FROM public.session_roster r JOIN public.sessions se ON se.id=r.session_id JOIN private.academic_terms t ON t.id=se.term_id
 JOIN public.subjects s ON s.id=se.subject_id JOIN public.users u ON u.id=r.student_id LEFT JOIN public.lectures l ON l.id=se.lecture_id
 LEFT JOIN public.attendance a ON a.session_id=se.id AND a.student_id=u.id
 WHERE auth.uid() IS NOT NULL AND (u.auth_id=auth.uid() OR private.can_manage_unit(se.subject_id,COALESCE(l.kind,CASE WHEN se.section IS NULL OR se.section IN ('','عام','all') THEN 'lecture' ELSE 'section' END)))
 AND ((p_term IS NULL AND t.status='active') OR se.term_id=p_term)
 GROUP BY COALESCE(se.lecture_id,se.id),se.lecture_id,se.subject_id,s.name,COALESCE(l.title,s.name),COALESCE(l.lecture_date,(se.created_at AT TIME ZONE 'Africa/Cairo')::date),u.id,u.full_name,
 COALESCE(l.kind,CASE WHEN se.section IS NULL OR se.section IN ('','عام','all') THEN 'lecture' ELSE 'section' END),se.term_id;
$function$;


CREATE OR REPLACE FUNCTION private.remove_academic_subject(p_subject_id uuid, p_department text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE caller public.users; subject public.subjects;
BEGIN
 caller := private.get_caller_user();
 IF caller.id IS NULL OR caller.role NOT IN ('owner','coordinator')
    OR (caller.role='coordinator' AND caller.department IS DISTINCT FROM p_department) THEN
   RAISE EXCEPTION 'permission_denied' USING ERRCODE='42501';
 END IF;
 -- Referencing FK inserts acquire a key-share lock, so they cannot race this deletion.
 SELECT * INTO subject FROM public.subjects WHERE id=p_subject_id AND department=p_department FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('deleted',false,'reason','not_found'); END IF;
 IF EXISTS(SELECT 1 FROM public.lectures WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM public.sessions WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM public.academic_schedule_entries WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM public.user_subjects WHERE subject_id=p_subject_id)
 OR EXISTS(SELECT 1 FROM public.users WHERE subject_id=p_subject_id) THEN
   RETURN jsonb_build_object('deleted',false,'reason','in_use');
 END IF;
 DELETE FROM public.subjects WHERE id=p_subject_id;
 RETURN jsonb_build_object('deleted',true);
END;
$function$;


CREATE OR REPLACE FUNCTION private.lifecycle_schedule_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d text; y text; BEGIN
 IF auth.uid() IS NULL OR current_setting('app.schedule_bulk',true)='on' THEN
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN d:=OLD.department;y:=OLD.academic_year; ELSE d:=NEW.department;y:=NEW.academic_year; END IF;
 IF private.active_academic_term(d) IS NULL AND current_setting('app.term_transition',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'term_closed: schedule'; END IF;
 IF private.active_academic_term(d) IS NOT NULL THEN
 PERFORM private.schedule_checkpoint(d,y,CASE WHEN TG_WHEN='BEFORE' THEN 'قبل التعديل' ELSE 'تعديل الجدول' END);
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END $function$;


DROP TRIGGER IF EXISTS zz_academic_session_notice ON public.sessions;

DROP TRIGGER IF EXISTS academic_exam_notice ON public.exam_schedules;

DROP POLICY IF EXISTS attendance_evidence_insert ON storage.objects;

DROP POLICY IF EXISTS attendance_evidence_read ON storage.objects;

DROP FUNCTION IF EXISTS public.academic_overview(text,uuid);

DROP FUNCTION IF EXISTS public.academic_case(text,jsonb);

DROP FUNCTION IF EXISTS public.academic_case_attachment(uuid,text);

DROP FUNCTION IF EXISTS public.academic_rule(text,jsonb);

DROP FUNCTION IF EXISTS public.academic_inbox(text,jsonb);

DROP FUNCTION IF EXISTS public.academic_data_policy(text,jsonb);

DROP FUNCTION IF EXISTS public.academic_term(text,text,jsonb);

DROP FUNCTION IF EXISTS private.lifecycle_overview(p_department text, p_term uuid);

DROP FUNCTION IF EXISTS private.lifecycle_alerts(p_department text);

DROP FUNCTION IF EXISTS private.lifecycle_term(p_department text, p_action text, p_payload jsonb);

DROP FUNCTION IF EXISTS private.lifecycle_results(p_term uuid);

DROP FUNCTION IF EXISTS private.lifecycle_case_attachment(p_case uuid, p_path text);

DROP FUNCTION IF EXISTS private.lifecycle_case(p_action text, p_payload jsonb);

DROP FUNCTION IF EXISTS private.lifecycle_rule(p_department text, p_payload jsonb);

DROP FUNCTION IF EXISTS private.lifecycle_inbox(p_action text, p_payload jsonb);

DROP FUNCTION IF EXISTS private.lifecycle_policy(p_department text, p_payload jsonb);

DROP FUNCTION IF EXISTS private.lifecycle_session_notice();

DROP FUNCTION IF EXISTS private.lifecycle_exam_notice();

DROP FUNCTION IF EXISTS private.case_file_access(p_name text, p_write boolean);

DROP FUNCTION IF EXISTS private.notify_academic_department(p_department text, p_year text, p_category text, p_title text, p_body text, p_event text);

DROP FUNCTION IF EXISTS private.lifecycle_notify(p_recipient uuid, p_category text, p_title text, p_body text, p_target text, p_event text);

DROP TABLE private.attendance_cases;

DROP TABLE private.attendance_rules;

DROP TABLE private.term_results;

DROP TABLE private.notification_preferences;

DROP TABLE private.academic_notifications;

DROP TABLE private.department_data_policies;

DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='attendance-evidence') THEN RAISE EXCEPTION 'Remove evidence objects through Storage API before retiring bucket'; END IF; END $$;

-- Retire the empty evidence bucket through the Storage API, not direct SQL.

COMMIT;
