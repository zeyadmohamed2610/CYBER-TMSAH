// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const auth = "10000000-0000-0000-0000-000000000001";
const student = "20000000-0000-0000-0000-000000000001";
const session = "30000000-0000-0000-0000-000000000001";
const receipt = "40000000-0000-0000-0000-000000000001";
const db = new PGlite();
const migration = readFileSync(
  "supabase/migrations/20261002033935_verified_attendance_and_trusted_roles.sql",
  "utf8",
);
const submit = migration.slice(
  migration.indexOf("CREATE OR REPLACE FUNCTION public.submit_attendance"),
);

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA extensions;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.webauthn_challenges(id uuid);
    CREATE TABLE public.users(id uuid PRIMARY KEY, auth_id uuid, role text, subject_id uuid);
    CREATE TABLE public.user_subjects(user_id uuid, subject_id uuid, assigned_at timestamptz);
    CREATE TABLE public.lectures(id uuid, subject_id uuid, title text, created_by uuid);
    CREATE TABLE public.sessions(id uuid PRIMARY KEY, expires_at timestamptz, rotating_hash text, short_code text, latitude double precision, longitude double precision, radius_meters double precision);
    CREATE TABLE public.attendance(id uuid DEFAULT gen_random_uuid(), student_id uuid, session_id uuid, device_fingerprint text, student_latitude double precision, student_longitude double precision, biometric_credential_id text, metadata jsonb, created_at timestamptz DEFAULT now());
    CREATE TABLE public.system_logs(actor_id uuid, action text, created_at timestamptz DEFAULT now());
    CREATE TABLE public.device_locks(student_auth_id uuid UNIQUE, device_fingerprint text UNIQUE, device_label text, locked_at timestamptz);
    CREATE TABLE public.student_devices(student_id uuid UNIQUE, device_fingerprint text, ip_address text, bound_at timestamptz, last_seen_at timestamptz);
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.auth_id',true),'')::uuid $$;
    CREATE FUNCTION private.get_caller_user() RETURNS public.users LANGUAGE sql AS $$ SELECT * FROM public.users WHERE auth_id=auth.uid() $$;
    CREATE FUNCTION private.current_request_user_agent() RETURNS text LANGUAGE sql AS $$ SELECT 'test'::text $$;
    CREATE FUNCTION private.current_request_ip() RETURNS text LANGUAGE sql AS $$ SELECT '127.0.0.1'::text $$;
    CREATE FUNCTION public.generate_totp(text,bigint) RETURNS text LANGUAGE sql AS $$ SELECT '123456'::text $$;
    CREATE FUNCTION public.gps_distance_meters(double precision,double precision,double precision,double precision) RETURNS double precision LANGUAGE sql AS $$ SELECT 0::double precision $$;
  `);
  // Execute the exact new receipt schema and submission procedure from the migration.
  await db.exec(
    migration.slice(
      0,
      migration.indexOf("CREATE OR REPLACE FUNCTION public.add_manual_attendance"),
    ),
  );
  await db.exec(
    migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.add_manual_attendance"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.submit_attendance"),
    ),
  );
  await db.exec(submit);
}, 30000);

beforeEach(async () => {
  await db.exec(`TRUNCATE attendance,system_logs,device_locks,student_devices,attendance_biometric_proofs,users,sessions,auth.users CASCADE;
    INSERT INTO auth.users VALUES('${auth}');
    INSERT INTO users VALUES('${student}','${auth}','student');
    INSERT INTO sessions(id,expires_at,rotating_hash,short_code) VALUES('${session}', now()+interval '5 minutes','seed','123456');
    SELECT set_config('test.auth_id','${auth}',false); SELECT set_config('test.jwt','{}',false);
    INSERT INTO attendance_biometric_proofs(id,auth_id,attendance_hash,device_fingerprint,credential_id) VALUES('${receipt}','${auth}','123456','device','verified-credential');
  `);
});
afterAll(() => db.close());
const call = (proof: string | null = receipt, hash = "123456", fingerprint = "device") =>
  db.query("SELECT public.submit_attendance($1,$2,NULL,NULL,$3)", [hash, fingerprint, proof]);

describe("database-enforced attendance receipts", () => {
  it("does not authorize manual attendance from editable owner metadata", async () => {
    await db.exec(
      'DELETE FROM users; SELECT set_config(\'test.jwt\', \'{"user_metadata":{"role":"owner"}}\', false)',
    );
    await expect(
      db.query("SELECT public.add_manual_attendance($1,$2)", [student, session]),
    ).rejects.toThrow("permission_denied");
  });
  it("records attendance with the verified credential and atomically consumes the receipt", async () => {
    await call();
    expect(
      (
        await db.query<{ biometric_credential_id: string }>(
          "SELECT biometric_credential_id FROM attendance",
        )
      ).rows[0]?.biometric_credential_id,
    ).toBe("verified-credential");
    expect((await db.query("SELECT id FROM attendance_biometric_proofs")).rows).toHaveLength(0);
  });
  it("rejects a client-supplied credential identifier", async () => {
    await expect(call("verified-credential")).rejects.toThrow("biometric_required");
    expect((await db.query("SELECT id FROM attendance")).rows).toHaveLength(0);
  });
  it("rejects a missing receipt", async () => {
    await expect(call(null)).rejects.toThrow("biometric_required");
  });
  it("rejects an expired receipt", async () => {
    await db.exec("UPDATE attendance_biometric_proofs SET expires_at=now()-interval '1 second'");
    await expect(call()).rejects.toThrow("biometric_required");
  });
  it("rejects a receipt issued for a different code", async () => {
    await db.exec("UPDATE attendance_biometric_proofs SET attendance_hash='654321'");
    await expect(call()).rejects.toThrow("biometric_required");
  });
  it("rejects a different device and rolls back device binding", async () => {
    await expect(call(receipt, "123456", "another-device")).rejects.toThrow("biometric_required");
    expect((await db.query("SELECT * FROM device_locks")).rows).toHaveLength(0);
  });
  it("rejects a receipt issued to another account", async () => {
    await db.exec(
      "INSERT INTO auth.users VALUES('10000000-0000-0000-0000-000000000002'); UPDATE attendance_biometric_proofs SET auth_id='10000000-0000-0000-0000-000000000002'",
    );
    await expect(call()).rejects.toThrow("biometric_required");
  });
  it("rejects replay even if the original attendance row is removed", async () => {
    await call();
    await db.exec("DELETE FROM attendance");
    await expect(call()).rejects.toThrow("biometric_required");
  });
  it("does not let authenticated clients manufacture receipts", async () => {
    await db.exec("SET ROLE authenticated");
    try {
      await expect(
        db.exec(
          "INSERT INTO attendance_biometric_proofs(auth_id,attendance_hash,device_fingerprint,credential_id) VALUES('" +
            auth +
            "','123456','device','forged')",
        ),
      ).rejects.toThrow("permission denied");
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it("rejects an unauthenticated caller", async () => {
    await db.exec("SELECT set_config('test.auth_id','',false)");
    await expect(call()).rejects.toThrow("permission_denied");
  });
});
