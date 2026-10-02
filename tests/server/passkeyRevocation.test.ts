// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA private;
    CREATE TABLE webauthn_credentials(id integer,auth_id text,credential_id text,public_key text);
    CREATE TABLE attendance_biometric_proofs(auth_id text,credential_id text);
    INSERT INTO webauthn_credentials VALUES(1,'a','key-a','verified'),(2,'b','key-b','verified');`);
  await db.exec(readFileSync('supabase/migrations/20261002163526_revoke_pending_passkey_receipts.sql','utf8'));
});
afterAll(() => db.close());
describe('passkey revocation and unused attendance confirmations', () => {
  it('invalidates only the deleted key receipts and rejects any new receipt for that key', async () => {
    await db.exec("INSERT INTO attendance_biometric_proofs VALUES('a','key-a'),('b','key-b'); DELETE FROM webauthn_credentials WHERE id=1;");
    expect((await db.query('SELECT * FROM attendance_biometric_proofs')).rows).toEqual([{auth_id:'b',credential_id:'key-b'}]);
    await expect(db.exec("INSERT INTO attendance_biometric_proofs VALUES('a','key-a')")).rejects.toThrow('credential_revoked');
    await expect(db.exec("INSERT INTO attendance_biometric_proofs VALUES('a','key-b')")).rejects.toThrow('credential_revoked');
  });
});
