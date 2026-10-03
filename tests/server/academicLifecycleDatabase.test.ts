// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const owner = "10000000-0000-0000-0000-000000000001";
const student = "10000000-0000-0000-0000-000000000002";
const subject = "20000000-0000-0000-0000-000000000001";
const lecture = "30000000-0000-0000-0000-000000000001";
const session = "40000000-0000-0000-0000-000000000001";

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE TABLE storage.objects(bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('test.auth',true),'')::uuid $$;
    CREATE TABLE users(id uuid PRIMARY KEY,auth_id uuid,role text,department text,academic_year text,section_number integer,full_name text,subject_id uuid);
    CREATE TABLE subjects(id uuid PRIMARY KEY,name text,department text,academic_year text);
    CREATE TABLE user_subjects(user_id uuid,subject_id uuid);
    CREATE TABLE lectures(id uuid PRIMARY KEY,subject_id uuid,title text,lecture_date date,created_by uuid,created_at timestamptz DEFAULT now(),kind text,section text,duration_minutes integer);
    CREATE TABLE sessions(id uuid PRIMARY KEY,lecture_id uuid,subject_id uuid,created_by uuid,created_at timestamptz DEFAULT now(),expires_at timestamptz,section text);
    CREATE TABLE session_roster(session_id uuid,student_id uuid);
    CREATE TABLE attendance(id uuid DEFAULT gen_random_uuid(),student_id uuid,session_id uuid,created_at timestamptz DEFAULT now(),metadata jsonb);
    CREATE TABLE system_logs(actor_id uuid,action text,metadata jsonb);
    CREATE TABLE academic_schedule_entries(id uuid,department text,academic_year text,section integer,day_index integer,period integer,subject_id uuid);
    CREATE TABLE academic_schedule_settings(department text,academic_year text,semester_start date,updated_at timestamptz);
    CREATE TABLE exam_schedules(id uuid,department text,academic_year text);
    CREATE TABLE private.academic_cycle_controls(department text);
    CREATE TABLE private.academic_day_cycles(department text);
    CREATE FUNCTION private.get_caller_user() RETURNS public.users LANGUAGE sql STABLE AS $$ SELECT * FROM public.users WHERE auth_id=auth.uid() $$;
    CREATE FUNCTION private.get_current_user_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT (private.get_caller_user()).role $$;
    CREATE FUNCTION private.can_manage_subject(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.subjects s ON s.id=$1 WHERE u.auth_id=auth.uid() AND (u.role='owner' OR u.role='coordinator' AND u.department=s.department OR u.role IN ('doctor','ta') AND u.subject_id=s.id)) $$;
    CREATE FUNCTION private.can_manage_unit(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.can_manage_subject($1) AND ((private.get_caller_user()).role IN ('owner','coordinator') OR (private.get_caller_user()).role='doctor' AND $2='lecture' OR (private.get_caller_user()).role='ta' AND $2='section') $$;
    CREATE FUNCTION private.academic_scope(text,text,boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN IF $3 AND (private.get_caller_user()).role NOT IN ('owner','coordinator') THEN RAISE EXCEPTION 'permission_denied'; END IF; RETURN jsonb_build_object('department',$1,'academic_year',$2); END $$;
    CREATE FUNCTION private.academic_get_schedule(text,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('entries','[]'::jsonb,'settings','{}'::jsonb) $$;
    CREATE FUNCTION private.academic_schedule_revision(text,text) RETURNS text LANGUAGE sql AS $$ SELECT 'test-revision'::text $$;
    CREATE FUNCTION private.academic_cycle_read(text,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
    CREATE FUNCTION private.academic_save_settings(text,text,jsonb) RETURNS void LANGUAGE sql AS $$ SELECT $$;
    CREATE FUNCTION private.academic_replace_schedule(text,text,jsonb,text) RETURNS integer LANGUAGE sql AS $$ SELECT jsonb_array_length($3) $$;
    CREATE FUNCTION private.record_manual_attendance(uuid,uuid,text) RETURNS public.attendance LANGUAGE sql AS $$ INSERT INTO public.attendance(student_id,session_id) VALUES($1,$2) RETURNING * $$;
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261003224507_academic_lifecycle_and_student_followup.sql",
      "utf8",
    ),
  );
}, 30000);
beforeEach(async () => {
  await db.exec(`TRUNCATE private.attendance_cases,private.academic_notifications,private.notification_preferences,private.attendance_rules,private.term_results,private.term_schedule_archives,public.attendance,public.session_roster,public.sessions,public.lectures,public.users,public.subjects CASCADE;
    UPDATE private.academic_terms SET status='active',closed_at=NULL WHERE department='cybersecurity';
    INSERT INTO users VALUES('${owner}','${owner}','owner','cybersecurity','2',NULL,'مدير',NULL),('${student}','${student}','student','cybersecurity','2',1,'طالب',NULL);
    INSERT INTO subjects VALUES('${subject}','مادة','cybersecurity','2');
    SELECT set_config('test.auth','${owner}',false);
    INSERT INTO lectures(id,subject_id,title,lecture_date,created_by,kind,duration_minutes) VALUES('${lecture}','${subject}','حصة','2026-10-01','${owner}','lecture',60);
    INSERT INTO sessions(id,subject_id,lecture_id,created_by,expires_at) VALUES('${session}','${subject}','${lecture}','${owner}',now()-interval '1 hour');
    INSERT INTO session_roster(session_id,student_id) VALUES('${session}','${student}');`);
});
afterAll(() => db.close());
async function overview() {
  return (
    await db.query<{
      data: {
        selected_term: string;
        rules: unknown[];
        results: {
          absent: number;
          excused: number;
          present: number;
          student_snapshot: { section: number };
        }[];
      };
    }>("SELECT public.academic_overview('cybersecurity',NULL) AS data")
  ).rows[0].data;
}

describe("academic lifecycle authorization and historical integrity", () => {
  it("leaves rules and retention periods unset", async () => {
    expect((await overview()).rules).toEqual([]);
    expect(
      (
        await db.query(
          "SELECT location_retention_days,national_id_retention_days FROM private.department_data_policies WHERE department='cybersecurity'",
        )
      ).rows[0],
    ).toEqual({ location_retention_days: null, national_id_retention_days: null });
  });
  it("does not alter an old section when the student is reassigned", async () => {
    await db.exec(`UPDATE public.users SET section_number=9 WHERE id='${student}'`);
    expect((await overview()).results[0].student_snapshot.section).toBe(1);
  });
  it("rejects student policy changes and access to another department", async () => {
    await db.exec(`SELECT set_config('test.auth','${student}',false)`);
    await expect(db.query("SELECT public.academic_rule('cybersecurity','{}')")).rejects.toThrow(
      "permission_denied",
    );
    await expect(db.query("SELECT public.academic_overview('ai',NULL)")).rejects.toThrow(
      "permission_denied",
    );
  });
  it("an excuse stays distinct from attendance, and a decision cannot be replayed", async () => {
    await db.exec(`SELECT set_config('test.auth','${student}',false)`);
    const request = (
      await db.query<{ data: { id: string } }>("SELECT public.academic_case('create',$1) AS data", [
        JSON.stringify({
          unit_id: lecture,
          request_type: "excuse",
          reason: "عذر يحتاج إلى مراجعة",
        }),
      ])
    ).rows[0].data;
    await db.exec(`SELECT set_config('test.auth','${owner}',false)`);
    const decision = JSON.stringify({
      id: request.id,
      version: 1,
      status: "approved",
      reason: "تمت مراجعة العذر",
    });
    await db.query("SELECT public.academic_case('decide',$1)", [decision]);
    expect((await overview()).results[0]).toMatchObject({ excused: 1, present: 0, absent: 0 });
    await expect(db.query("SELECT public.academic_case('decide',$1)", [decision])).rejects.toThrow(
      "case_changed",
    );
  });
  it("a device problem requires review before recording manual attendance", async () => {
    await db.exec(`SELECT set_config('test.auth','${student}',false)`);
    const request = (
      await db.query<{ data: { id: string } }>("SELECT public.academic_case('create',$1) AS data", [
        JSON.stringify({
          unit_id: lecture,
          request_type: "device",
          reason: "تعذر استخدام جهاز الدخول",
        }),
      ])
    ).rows[0].data;
    expect((await overview()).results[0].present).toBe(0);
    await db.exec(`SELECT set_config('test.auth','${owner}',false)`);
    await db.query("SELECT public.academic_case('decide',$1)", [
      JSON.stringify({
        id: request.id,
        version: 1,
        status: "approved",
        reason: "راجع المسؤول حضور الطالب",
      }),
    ]);
    expect((await overview()).results[0].present).toBe(1);
  });
  it("closes a term with immutable results and rejects late attendance", async () => {
    const term = (await overview()).selected_term;
    await db.query("SELECT public.academic_term('cybersecurity','close',$1)", [
      JSON.stringify({ id: term }),
    ]);
    await expect(
      db.exec(`INSERT INTO attendance(student_id,session_id) VALUES('${student}','${session}')`),
    ).rejects.toThrow("term_closed");
    await db.exec(`UPDATE users SET section_number=8 WHERE id='${student}'`);
    const archive = (
      await db.query<{ data: { results: { student_snapshot: { section: number } }[] } }>(
        "SELECT public.academic_overview('cybersecurity',$1) data",
        [term],
      )
    ).rows[0].data;
    expect(archive.results[0].student_snapshot.section).toBe(1);
  });
  it("does not let the student approve their own excuse", async () => {
    await db.exec(`SELECT set_config('test.auth','${student}',false)`);
    const request = (
      await db.query<{ data: { id: string } }>("SELECT public.academic_case('create',$1) data", [
        JSON.stringify({ unit_id: lecture, request_type: "excuse", reason: "عذر للمراجعة" }),
      ])
    ).rows[0].data;
    await expect(
      db.query("SELECT public.academic_case('decide',$1)", [
        JSON.stringify({
          id: request.id,
          version: 1,
          status: "approved",
          reason: "محاولة الطالب الموافقة",
        }),
      ]),
    ).rejects.toThrow("permission_denied");
  });
  it("limits a teaching assistant's manual correction to sections", async () => {
    const ta = "10000000-0000-0000-0000-000000000003";
    await db.exec(
      `INSERT INTO users VALUES('${ta}','${ta}','ta','cybersecurity','2',NULL,'معيد','${subject}'); SELECT set_config('test.auth','${ta}',false)`,
    );
    await expect(
      db.query("SELECT private.record_manual_attendance($1,$2,'تصحيح من المعيد')", [
        student,
        session,
      ]),
    ).rejects.toThrow("permission_denied");
  });
  it("does not read or mark another user's notifications", async () => {
    await db.query(
      "SELECT private.lifecycle_notify($1,'attendance','خاص بالمدير','رسالة خاصة','/profile','owner-only')",
      [owner],
    );
    await db.query(
      "SELECT private.lifecycle_notify($1,'attendance','خاص بالطالب','رسالة خاصة','/profile','student-only')",
      [student],
    );
    const privateId = (
      await db.query<{ id: string }>(
        "SELECT id FROM private.academic_notifications WHERE recipient_id=$1",
        [owner],
      )
    ).rows[0].id;
    await db.exec(`SELECT set_config('test.auth','${student}',false)`);
    const inbox = (
      await db.query<{ data: { items: { title: string }[] } }>(
        "SELECT public.academic_inbox('read',$1) data",
        [JSON.stringify({ id: privateId })],
      )
    ).rows[0].data;
    expect(inbox.items.map((item) => item.title)).toEqual(["خاص بالطالب"]);
    expect(
      (
        await db.query<{ read_at: string | null }>(
          "SELECT read_at FROM private.academic_notifications WHERE id=$1",
          [privateId],
        )
      ).rows[0].read_at,
    ).toBeNull();
  });
  it("binds evidence to its request owner and hides unattached files", async () => {
    await db.exec(`SELECT set_config('test.auth','${student}',false)`);
    const request = (
      await db.query<{ data: { id: string } }>("SELECT public.academic_case('create',$1) data", [
        JSON.stringify({ unit_id: lecture, request_type: "excuse", reason: "مستند خاص للمراجعة" }),
      ])
    ).rows[0].data;
    const file = `${student}/${request.id}/evidence.pdf`;
    await db.query("INSERT INTO storage.objects VALUES('attendance-evidence',$1)", [file]);
    expect(
      (
        await db.query<{ allowed: boolean }>("SELECT private.case_file_access($1,false) allowed", [
          file,
        ])
      ).rows[0].allowed,
    ).toBe(false);
    await db.query("SELECT public.academic_case_attachment($1,$2)", [request.id, file]);
    expect(
      (
        await db.query<{ allowed: boolean }>("SELECT private.case_file_access($1,false) allowed", [
          file,
        ])
      ).rows[0].allowed,
    ).toBe(true);
    await expect(
      db.query("SELECT public.academic_case_attachment($1,$2)", [
        request.id,
        `${owner}/${request.id}/evidence.pdf`,
      ]),
    ).rejects.toThrow("permission_denied");
  });
  it("denies anonymous RPC execution", async () => {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "SELECT has_function_privilege('anon','public.academic_overview(text,uuid)','EXECUTE') allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
});
