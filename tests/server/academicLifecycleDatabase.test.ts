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
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE users(id uuid PRIMARY KEY,auth_id uuid,role text,department text,academic_year text,section_number integer,full_name text,subject_id uuid);
    CREATE TABLE subjects(id uuid PRIMARY KEY,name text,department text,academic_year text);
    CREATE TABLE user_subjects(user_id uuid,subject_id uuid);
    CREATE TABLE lectures(id uuid PRIMARY KEY,subject_id uuid,title text,lecture_date date,created_by uuid,created_at timestamptz DEFAULT now(),kind text,section text,duration_minutes integer);
    CREATE TABLE sessions(id uuid PRIMARY KEY,lecture_id uuid,subject_id uuid,created_by uuid,created_at timestamptz DEFAULT now(),expires_at timestamptz,section text);
    CREATE TABLE session_roster(session_id uuid,student_id uuid);
    CREATE TABLE attendance(id uuid DEFAULT gen_random_uuid(),student_id uuid,session_id uuid,created_at timestamptz DEFAULT now(),metadata jsonb);
    CREATE TABLE system_logs(actor_id uuid,action text,metadata jsonb);
    CREATE TABLE join_requests(id uuid,status text);
    CREATE TABLE error_reports(id uuid,status text);
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
  await db.exec(
    readFileSync("supabase/migrations/20261004004615_safe_subject_removal.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261004055002_consistent_dashboard_and_schedule_scope.sql",
      "utf8",
    ),
  );
  await db.exec(`ALTER TABLE lectures ADD CONSTRAINT lectures_created_by_fkey FOREIGN KEY(created_by) REFERENCES users(id);
    ALTER TABLE sessions ADD CONSTRAINT sessions_created_by_fkey FOREIGN KEY(created_by) REFERENCES users(id);`);
  await db.exec(
    readFileSync("supabase/migrations/20261004062508_allow_faculty_account_removal.sql", "utf8"),
  );
  await db.exec(`CREATE TRIGGER enforce_academic_unit_kind BEFORE INSERT OR UPDATE OR DELETE ON public.lectures FOR EACH ROW EXECUTE FUNCTION private.guard_academic_unit();
    CREATE TRIGGER enforce_academic_session_kind BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION private.guard_academic_session();
    ALTER TABLE user_subjects ADD FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;`);
  await db.exec(
    readFileSync("supabase/migrations/20261004201315_remove_results_and_excuses.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261004202704_remove_retired_department_helper.sql", "utf8"),
  );
}, 30000);
beforeEach(async () => {
  await db.exec("TRUNCATE auth.users");
  await db.exec(`TRUNCATE private.term_schedule_archives,public.attendance,public.session_roster,public.sessions,public.lectures,public.users,public.subjects CASCADE;
    UPDATE private.academic_terms SET status='active',closed_at=NULL WHERE department='cybersecurity';
    INSERT INTO users VALUES('${owner}','${owner}','owner','cybersecurity','2',NULL,'مدير',NULL),('${student}','${student}','student','cybersecurity','2',1,'طالب',NULL);
    INSERT INTO subjects VALUES('${subject}','مادة','cybersecurity','2');
    SELECT set_config('test.auth','${owner}',false);
    INSERT INTO lectures(id,subject_id,title,lecture_date,created_by,kind,duration_minutes) VALUES('${lecture}','${subject}','حصة','2026-10-01','${owner}','lecture',60);
    INSERT INTO sessions(id,subject_id,lecture_id,created_by,expires_at) VALUES('${session}','${subject}','${lecture}','${owner}',now()-interval '1 hour');
    INSERT INTO session_roster(session_id,student_id) VALUES('${session}','${student}');`);
});
afterAll(() => db.close());
describe("academic lifecycle authorization and historical integrity", () => {
  it.each([
    ["doctor", "active"],
    ["doctor", "closed"],
    ["ta", "active"],
    ["ta", "closed"],
  ])(
    "lets an owner remove a %s account in an %s term without erasing classes",
    async (role, termStatus) => {
      const faculty = "10000000-0000-0000-0000-000000000003";
      await db.exec(`INSERT INTO auth.users VALUES('${faculty}'); INSERT INTO users VALUES('${faculty}','${faculty}','${role}','cybersecurity',NULL,NULL,'محاضر محذوف','${subject}');
      INSERT INTO user_subjects VALUES('${faculty}','${subject}');
      UPDATE lectures SET created_by='${faculty}'; UPDATE sessions SET created_by='${faculty}';
      UPDATE private.academic_terms SET status='${termStatus}' WHERE department='cybersecurity';
      SELECT public.delete_user_by_id('${faculty}');`);
      expect((await db.query("SELECT created_by FROM lectures")).rows).toEqual([
        { created_by: null },
      ]);
      expect((await db.query("SELECT created_by FROM sessions")).rows).toEqual([
        { created_by: null },
      ]);
      expect((await db.query("SELECT * FROM session_roster")).rows).toHaveLength(1);
      expect((await db.query(`SELECT * FROM users WHERE id='${faculty}'`)).rows).toHaveLength(0);
      expect((await db.query(`SELECT * FROM auth.users WHERE id='${faculty}'`)).rows).toHaveLength(
        0,
      );
      expect(
        (await db.query(`SELECT * FROM user_subjects WHERE user_id='${faculty}'`)).rows,
      ).toHaveLength(0);
      const audit = (
        await db.query<{
          metadata: {
            deleted_profile: { full_name: string };
            lecture_ids: string[];
            session_ids: string[];
          };
        }>(
          "SELECT metadata FROM system_logs WHERE action='delete_user_by_id' ORDER BY ctid DESC LIMIT 1",
        )
      ).rows[0].metadata;
      expect(audit.deleted_profile.full_name).toBe("محاضر محذوف");
      expect(audit.lecture_ids).toEqual([lecture]);
      expect(audit.session_ids).toEqual([session]);
      if (termStatus === "closed") {
        await expect(db.exec("UPDATE lectures SET title='forged history'")).rejects.toThrow(
          "term_closed",
        );
        await expect(db.exec(`UPDATE sessions SET created_by='${owner}'`)).rejects.toThrow(
          "term_closed",
        );
      }
    },
  );
  it("keeps account deletion scoped to the owner's or coordinator's authority", async () => {
    await expect(db.query(`SELECT public.delete_user_by_id('${owner}')`)).rejects.toThrow(
      "validation_error",
    );
    await db.exec(`SELECT set_config('test.auth','${student}',false)`);
    await expect(db.query(`SELECT public.delete_user_by_id('${owner}')`)).rejects.toThrow(
      "permission_denied",
    );
    await db.exec(`UPDATE users SET role='coordinator' WHERE id='${student}'`);
    await expect(db.query(`SELECT public.delete_user_by_id('${owner}')`)).rejects.toThrow(
      "permission_denied",
    );
    await db.exec(`UPDATE users SET role='doctor',department='ai' WHERE id='${owner}'`);
    await expect(db.query(`SELECT public.delete_user_by_id('${owner}')`)).rejects.toThrow(
      "permission_denied",
    );
  });
  it("counts student accounts independently of attendance and excludes open opportunities from the rate", async () => {
    const summary = async () =>
      (
        await db.query<{
          data: {
            dashboard: {
              totalStudents: number;
              totalSessions: number;
              completedOpportunities: number;
            };
          };
        }>("SELECT public.get_attendance_summary(NULL) AS data")
      ).rows[0].data.dashboard;
    expect(await summary()).toMatchObject({
      totalStudents: 1,
      totalSessions: 1,
      completedOpportunities: 1,
    });
    await db.exec(`UPDATE sessions SET expires_at=now()+interval '1 hour'`);
    expect(await summary()).toMatchObject({
      totalStudents: 1,
      totalSessions: 1,
      completedOpportunities: 0,
    });
    await db.exec(`DELETE FROM session_roster`);
    expect(await summary()).toMatchObject({
      totalStudents: 1,
      totalSessions: 1,
      completedOpportunities: 0,
    });
  });
  it("defaults administrators to the published year while retaining explicit year and student scope", async () => {
    await db.exec(
      `UPDATE users SET academic_year=NULL WHERE id='${owner}'; INSERT INTO academic_schedule_entries(id,department,academic_year) VALUES(gen_random_uuid(),'cybersecurity','2')`,
    );
    const scope = async (year: string | null) =>
      (
        await db.query<{ data: { academic_year: string } }>(
          "SELECT private.academic_scope('cybersecurity',$1,false) AS data",
          [year],
        )
      ).rows[0].data;
    expect((await scope(null)).academic_year).toBe("2");
    expect((await scope("1")).academic_year).toBe("1");
    await db.exec(`SELECT set_config('test.auth','${student}',false)`);
    expect((await scope(null)).academic_year).toBe("2");
    await expect(scope("1")).rejects.toThrow("permission_denied");
    await db.exec(
      `SELECT set_config('test.auth','${owner}',false); DELETE FROM academic_schedule_entries`,
    );
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
  it("removes the retired APIs and keeps attendance records scoped", async () => {
    for (const name of [
      "attendance_cases",
      "attendance_rules",
      "term_results",
      "academic_notifications",
      "department_data_policies",
    ]) {
      expect(
        (
          await db.query<{ relation: string | null }>("SELECT to_regclass($1) relation", [
            "private." + name,
          ])
        ).rows[0].relation,
      ).toBeNull();
    }
    expect(
      (
        await db.query(
          "SELECT proname FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace WHERE n.nspname='public' AND proname IN ('academic_overview','academic_case','academic_inbox','academic_rule','academic_term')",
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec(`SELECT set_config('test.auth','${student}',false)`);
    expect(
      (await db.query<{ status: string }>("SELECT status FROM private.attendance_register()")).rows,
    ).toEqual([{ status: "absent" }]);
    await db.exec(`SELECT set_config('test.auth','',false)`);
    expect((await db.query("SELECT * FROM private.attendance_register()")).rows).toHaveLength(0);
  });
});

describe("safe subject removal", () => {
  const empty = "20000000-0000-0000-0000-000000000009";
  const remove = (id: string, department = "cybersecurity") =>
    db.query<{ result: { deleted: boolean; reason?: string } }>(
      "SELECT public.remove_academic_subject($1,$2) result",
      [id, department],
    );
  it("preserves subjects with attendance history without an HTTP error", async () => {
    expect((await remove(subject)).rows[0].result).toEqual({ deleted: false, reason: "in_use" });
    expect((await db.query("SELECT id FROM lectures WHERE id=$1", [lecture])).rows).toHaveLength(1);
  });
  it("removes an unused subject and handles a repeated request", async () => {
    await db.query("INSERT INTO subjects VALUES($1,'Unused','cybersecurity','2')", [empty]);
    expect((await remove(empty)).rows[0].result).toEqual({ deleted: true });
    expect((await remove(empty)).rows[0].result).toEqual({ deleted: false, reason: "not_found" });
  });
  it("preserves assigned subjects even without sessions", async () => {
    await db.query("INSERT INTO subjects VALUES($1,'Assigned','cybersecurity','2')", [empty]);
    await db.query("INSERT INTO user_subjects VALUES($1,$2)", [owner, empty]);
    expect((await remove(empty)).rows[0].result.reason).toBe("in_use");
  });
  it("denies students, another coordinator department, and direct deletion", async () => {
    await db.query("SELECT set_config('test.auth',$1,false)", [student]);
    await expect(remove(subject)).rejects.toThrow("permission_denied");
    await db.query("UPDATE users SET role='coordinator' WHERE id=$1", [student]);
    await expect(remove(subject, "other-department")).rejects.toThrow("permission_denied");
    const grants = await db.query<{ allowed: boolean }>(
      "SELECT has_table_privilege('authenticated','public.subjects','DELETE') allowed UNION ALL SELECT has_function_privilege('anon','public.remove_academic_subject(uuid,text)','EXECUTE')",
    );
    expect(grants.rows.every((row) => !row.allowed)).toBe(true);
  });
});
