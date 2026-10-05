// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const db = new PGlite();
const id = "10000000-0000-0000-0000-000000000001";
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE TABLE users(id uuid,auth_id uuid,role text,subject_id uuid);
    CREATE TABLE sessions(id uuid,subject_id uuid,latitude float8,longitude float8,radius_meters integer,expires_at timestamptz);
    CREATE TABLE system_logs(actor_id uuid,action text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id}'::uuid $$;
    CREATE FUNCTION private.get_caller_user() RETURNS users LANGUAGE sql AS $$ SELECT * FROM users LIMIT 1 $$;
    CREATE FUNCTION private.can_manage_subject(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${id}'::uuid $$;
  `);
  const migration = readFileSync(
    "supabase/migrations/20261005080545_enforce_session_gps_and_duration_scope.sql",
    "utf8",
  );
  await db.exec(
    migration.slice(
      0,
      migration.indexOf("CREATE OR REPLACE FUNCTION private.account_submit_attendance"),
    ) + "COMMIT;",
  );
});
beforeEach(async () => {
  await db.exec(`TRUNCATE users,sessions,system_logs;
    INSERT INTO users VALUES('${id}','${id}','owner',NULL);
    INSERT INTO sessions VALUES('${id}','${id}',30,31,75,now()+interval '5 minutes');`);
});
afterAll(() => db.close());
it.each(["owner", "coordinator", "doctor", "ta"])(
  "allows %s to change an assigned session's duration",
  async (role) => {
    await db.query("UPDATE users SET role=$1", [role]);
    const { rows } = await db.query<{ seconds: number }>(
      "SELECT extract(epoch from (private.attendance_set_session_duration($1,25)).expires_at-now()) AS seconds",
      [id],
    );
    expect(Number(rows[0].seconds)).toBeCloseTo(1500, 0);
  },
);
it("retains assignment restrictions", async () => {
  await db.exec("UPDATE sessions SET subject_id='20000000-0000-0000-0000-000000000001'");
  await expect(
    db.query("SELECT private.attendance_set_session_duration($1,25)", [id]),
  ).rejects.toThrow("permission_denied");
});
it.each([
  [null, 31, 50],
  [30, null, 50],
  [91, 31, 50],
  [30, 181, 50],
  [NaN, 31, 50],
  [30, 31, 9],
  [30, 31, 501],
])("rejects invalid session GPS or radius %s,%s,%s", async (lat, lon, radius) => {
  await expect(
    db.query("UPDATE sessions SET latitude=$1,longitude=$2,radius_meters=$3", [lat, lon, radius]),
  ).rejects.toThrow("location_denied");
});
