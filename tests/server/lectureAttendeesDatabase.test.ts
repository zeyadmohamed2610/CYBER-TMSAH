// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const unit = "10000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE users(id uuid PRIMARY KEY, full_name text, national_id text);
    CREATE TABLE sessions(id uuid PRIMARY KEY, lecture_id uuid, short_code text);
    CREATE TABLE attendance(id uuid PRIMARY KEY, student_id uuid, session_id uuid,
      created_at timestamptz, ip_address text, student_latitude float8, student_longitude float8);
    ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
    CREATE POLICY attendance_scope ON attendance FOR SELECT TO authenticated
      USING (student_id::text = current_setting('test.student',true));
    GRANT USAGE ON SCHEMA public TO authenticated, anon;
    GRANT SELECT ON attendance, sessions, users TO authenticated;
    INSERT INTO users VALUES ('20000000-0000-0000-0000-000000000001','Student one','111'),
      ('20000000-0000-0000-0000-000000000002','Student two','222');
    INSERT INTO sessions VALUES ('30000000-0000-0000-0000-000000000001','${unit}','123456');
    INSERT INTO attendance SELECT id,id,'30000000-0000-0000-0000-000000000001',now(),
      CASE WHEN national_id='111' THEN '192.0.2.1' ELSE '192.0.2.2' END,30,31 FROM users;
  `);
  await db.exec(
    readFileSync("supabase/migrations/20261005043353_repair_lecture_attendees_source.sql", "utf8"),
  );
});
afterAll(() => db.close());

it("loads historical attendance without the removed device table", async () => {
  const { rows } = await db.query<{ ip_address: string }>(
    "SELECT * FROM public.get_lecture_attendees($1)",
    [unit],
  );
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.ip_address).sort()).toEqual(["192.0.2.1", "192.0.2.2"]);
});

it("preserves the caller's row security", async () => {
  await db.exec(
    "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('test.student','20000000-0000-0000-0000-000000000001',true);",
  );
  try {
    const { rows } = await db.query<{ student_name: string }>(
      "SELECT * FROM public.get_lecture_attendees($1)",
      [unit],
    );
    expect(rows.map((row) => row.student_name)).toEqual(["Student one"]);
  } finally {
    await db.exec("ROLLBACK;");
  }
});

it("denies anonymous execution", async () => {
  await db.exec("BEGIN; SET LOCAL ROLE anon;");
  try {
    await expect(
      db.query("SELECT * FROM public.get_lecture_attendees($1)", [unit]),
    ).rejects.toThrow(/permission denied/);
  } finally {
    await db.exec("ROLLBACK;");
  }
});
