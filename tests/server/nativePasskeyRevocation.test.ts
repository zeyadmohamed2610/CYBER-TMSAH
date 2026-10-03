// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite(),
  user = "00000000-0000-0000-0000-000000000001",
  key = "00000000-0000-0000-0000-000000000002";
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA private;CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE auth.webauthn_credentials(id uuid PRIMARY KEY,user_id uuid,credential_id bytea);
 CREATE TABLE attendance_biometric_proofs(id uuid,auth_id uuid,credential_id text);
 CREATE TABLE webauthn_credentials(id uuid);
 CREATE TABLE webauthn_challenges(id uuid);
 INSERT INTO auth.users VALUES('${user}');
 INSERT INTO auth.webauthn_credentials VALUES('${key}','${user}',decode('6b6579','hex'));
 CREATE FUNCTION private.guard_passkey_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW;END;$$;
 CREATE TRIGGER require_current_passkey_receipt BEFORE INSERT ON attendance_biometric_proofs FOR EACH ROW EXECUTE FUNCTION private.guard_passkey_receipt();`);
  await db.exec(
    readFileSync("supabase/migrations/20261003023715_native_passkey_attendance_bridge.sql", "utf8"),
  );
});
afterAll(() => db.close());
it("binds native receipts to current native credentials and cascades revocation without touching attendance history", async () => {
  await db.exec(
    "CREATE TABLE attendance_history(id integer);INSERT INTO attendance_history VALUES(1);",
  );
  await db.query("INSERT INTO attendance_biometric_proofs(auth_id,credential_id) VALUES($1,$2)", [
    user,
    "a2V5",
  ]);
  expect(
    (await db.query("SELECT native_credential_uuid FROM attendance_biometric_proofs")).rows,
  ).toEqual([{ native_credential_uuid: key }]);
  await expect(
    db.query("INSERT INTO attendance_biometric_proofs(auth_id,credential_id) VALUES($1,$2)", [
      "00000000-0000-0000-0000-000000000003",
      "a2V5",
    ]),
  ).rejects.toThrow("credential_revoked");
  await db.query("DELETE FROM auth.webauthn_credentials WHERE id=$1", [key]);
  expect((await db.query("SELECT * FROM attendance_biometric_proofs")).rows).toEqual([]);
  expect((await db.query("SELECT * FROM attendance_history")).rows).toEqual([{ id: 1 }]);
  await expect(
    db.query("INSERT INTO attendance_biometric_proofs(auth_id,credential_id) VALUES($1,$2)", [
      user,
      "a2V5",
    ]),
  ).rejects.toThrow("credential_revoked");
});
