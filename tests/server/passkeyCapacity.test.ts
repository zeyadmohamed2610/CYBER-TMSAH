// @vitest-environment node
import {afterAll,beforeAll,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const db=new PGlite();
beforeAll(async()=>{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA private; CREATE TABLE webauthn_credentials(auth_id uuid,credential_id text);');
  await db.exec(readFileSync('supabase/migrations/20261003021149_universal_passkey_capacity.sql','utf8'));
  await db.exec('CREATE TRIGGER enforce_passkey_limit BEFORE INSERT ON webauthn_credentials FOR EACH ROW EXECUTE FUNCTION private.limit_passkey_count();');
});
afterAll(()=>db.close());
it('allows ten keys per account, rejects an eleventh and frees capacity after revocation',async()=>{
  const id='00000000-0000-0000-0000-000000000001';
  for(let i=0;i<10;i++)await db.query('INSERT INTO webauthn_credentials VALUES($1,$2)',[id,'key'+i]);
  await expect(db.query('INSERT INTO webauthn_credentials VALUES($1,$2)',[id,'overflow'])).rejects.toThrow('ten passkeys maximum');
  await db.query('INSERT INTO webauthn_credentials VALUES($1,$2)',['00000000-0000-0000-0000-000000000002','other']);
  await db.query('DELETE FROM webauthn_credentials WHERE credential_id=$1',['key0']);
  await db.query('INSERT INTO webauthn_credentials VALUES($1,$2)',[id,'replacement']);
  expect((await db.query('SELECT count(*) AS n FROM webauthn_credentials WHERE auth_id=$1',[id])).rows).toEqual([{n:10}]);
});
