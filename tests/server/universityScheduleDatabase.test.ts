// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
const db = new PGlite();
const user = "10000000-0000-0000-0000-000000000001";
const auth = "20000000-0000-0000-0000-000000000001";
const subject = "30000000-0000-0000-0000-000000000001";
const base = readFileSync(
  "supabase/migrations/20261002061543_academic_schedule_and_session_kinds.sql",
  "utf8",
);
const latest = readFileSync(
  "supabase/migrations/20261002072500_legacy_subjects_and_editable_holidays.sql",
  "utf8",
);
const readMigration = readFileSync(
  "supabase/migrations/20261002072600_include_unscoped_legacy_subjects_in_schedule.sql",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20261002141913_university_schedule_sync.sql",
  "utf8",
);
const entry = {
  section: 1,
  day_index: 5,
  period: 1,
  subject_id: subject,
  instructor_id: null,
  instructor_name: "محاضر",
  kind: "lecture",
  week_pattern: 0,
  room: "G203",
  uses_rotation: false,
  lab_room: "",
  hall_room: "",
  lab_week: 1,
};
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE TABLE users(id uuid PRIMARY KEY,auth_id uuid,role text,department text,academic_year text,section_number integer,full_name text,subject_id uuid);
 CREATE TABLE subjects(id uuid PRIMARY KEY,name text,department text,academic_year text);
 CREATE TABLE user_subjects(user_id uuid,subject_id uuid);
 CREATE TABLE system_logs(actor_id uuid,action text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.auth',true),'')::uuid $$;
 CREATE FUNCTION private.get_caller_user() RETURNS public.users LANGUAGE sql STABLE AS $$ SELECT * FROM public.users WHERE auth_id=auth.uid() $$;`);
  await db.exec(
    base.slice(
      base.indexOf("CREATE TABLE public.academic_schedule_settings"),
      base.indexOf("CREATE OR REPLACE FUNCTION private.academic_scope"),
    ),
  );
  await db.exec(
    base.slice(
      base.indexOf("CREATE OR REPLACE FUNCTION private.academic_scope"),
      base.indexOf("CREATE POLICY academic_settings_read"),
    ),
  );
  await db.exec(
    latest.slice(latest.indexOf("CREATE OR REPLACE FUNCTION private.academic_save_entry")),
  );
  await db.exec(readMigration);
  await db.exec(migration);
  await db.exec(
    readFileSync("supabase/migrations/20261002161935_schedule_day_cycles_and_clock.sql", "utf8"),
  );
}, 30000);
beforeEach(async () => {
  await db.exec(`TRUNCATE private.academic_cycle_controls,private.academic_day_cycles,academic_schedule_entries,academic_schedule_settings,system_logs,user_subjects,users,subjects CASCADE;
 INSERT INTO users(id,auth_id,role,department,academic_year,full_name) VALUES('${user}','${auth}','owner','cybersecurity','2','مالك');
 INSERT INTO subjects VALUES('${subject}','مادة','cybersecurity',NULL);
 SELECT set_config('test.auth','${auth}',false);`);
});
afterAll(() => db.close());
const revision = async () =>
  String(
    (
      await db.query<{ revision: string }>(
        "SELECT public.get_academic_schedule('cybersecurity','2')->>'revision' AS revision",
      )
    ).rows[0]?.revision,
  );
const replace = (entries: object[], rev: string) =>
  db.query("SELECT public.replace_academic_schedule('cybersecurity','2',$1::jsonb,$2)", [
    JSON.stringify(entries),
    rev,
  ]);
describe("database university schedule replacement", () => {
  it("synchronizes source time atomically without clearing holidays", async () => {
    await db.exec(
      'SELECT private.academic_save_settings(\'cybersecurity\',\'2\',\'{"week_start_day":5,"start_time":"07:30","days_off":[4,6]}\')',
    );
    await replace([{ ...entry, source_start_time: "09:00" }], await revision());
    expect(
      (await db.query("SELECT start_time::text,days_off FROM academic_schedule_settings")).rows[0],
    ).toEqual({ start_time: "09:00:00", days_off: [4, 6] });
    const rev = await revision();
    await expect(
      replace(
        [
          { ...entry, source_start_time: "10:00" },
          { ...entry, source_start_time: "10:00" },
        ],
        rev,
      ),
    ).rejects.toThrow("conflict");
    expect(await revision()).toBe(rev);
  });
  it("keeps day exceptions separate from the weekly anchor and restricts changes to the owner", async () => {
    await db.exec(
      "SELECT public.save_academic_cycle('cybersecurity','2','2026-10-02',1,'week'); SELECT public.save_academic_cycle('cybersecurity','2','2026-10-05',2,'day');",
    );
    const controls = (
      await db.query<{ cycles: unknown }>(
        "SELECT public.get_academic_schedule('cybersecurity','2')->'cycles' cycles",
      )
    ).rows[0]?.cycles;
    expect(controls).toEqual({
      anchor: { date: "2026-10-02", cycle: 1 },
      days: { "2026-10-05": 2 },
    });
    await db.exec("UPDATE users SET role='coordinator'");
    await expect(
      db.exec("SELECT public.save_academic_cycle('cybersecurity','2','2026-10-05',1,'day')"),
    ).rejects.toThrow("owner only");
    await db.exec(
      "UPDATE users SET role='owner'; SELECT public.save_academic_cycle('cybersecurity','2','2026-10-05',NULL,'day')",
    );
    expect(
      (await db.query("SELECT count(*)::integer n FROM private.academic_day_cycles")).rows[0],
    ).toEqual({ n: 0 });
  });
  it("removes old and manual slots and preserves other academic years", async () => {
    await replace([entry, { ...entry, section: 2 }], await revision());
    await db.query("SELECT private.academic_save_entry('cybersecurity','1',$1::jsonb)", [
      JSON.stringify(entry),
    ]);
    await replace([{ ...entry, period: 6 }], await revision());
    const rows = (
      await db.query<{ academic_year: string; period: number }>(
        "SELECT academic_year,period FROM academic_schedule_entries ORDER BY academic_year",
      )
    ).rows;
    expect(rows).toEqual([
      { academic_year: "1", period: 1 },
      { academic_year: "2", period: 6 },
    ]);
  });
  it("rolls back deletion and every inserted row if one new slot conflicts", async () => {
    await replace([entry], await revision());
    const rev = await revision();
    await expect(
      replace(
        [
          { ...entry, period: 6 },
          { ...entry, period: 6 },
        ],
        rev,
      ),
    ).rejects.toThrow("conflict");
    expect(await revision()).toBe(rev);
    expect((await db.query("SELECT period FROM academic_schedule_entries")).rows).toEqual([
      { period: 1 },
    ]);
  });
  it("rejects stale previews after a manual edit or settings change", async () => {
    const before = await revision();
    await replace([entry], before);
    await expect(replace([entry], before)).rejects.toThrow("schedule_changed");
    const rev = await revision();
    await db.exec(
      "SELECT private.academic_save_settings('cybersecurity','2','{\"week_start_day\":5,\"start_time\":\"09:00\"}')",
    );
    await expect(replace([entry], rev)).rejects.toThrow("schedule_changed");
  });
  it.each(["student", "doctor", "ta"])("denies %s replacement", async (role) => {
    await db.query("UPDATE users SET role=$1", [role]);
    await expect(replace([entry], await revision())).rejects.toThrow("permission_denied");
  });
  it("allows a coordinator within their department and denies another department", async () => {
    await db.exec("UPDATE users SET role='coordinator'");
    await replace([entry], await revision());
    await expect(
      db.query("SELECT public.replace_academic_schedule('ai','2',$1::jsonb,'stale')", [
        JSON.stringify([entry]),
      ]),
    ).rejects.toThrow("permission_denied");
  });
  it("does not allow empty files or anonymous privileged workers", async () => {
    await expect(replace([], await revision())).rejects.toThrow("import size");
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "SELECT has_function_privilege('anon','private.academic_replace_schedule(text,text,jsonb,text)','EXECUTE') AS allowed",
        )
      ).rows[0]?.allowed,
    ).toBe(false);
  });
});
