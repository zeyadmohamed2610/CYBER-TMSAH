// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db=new PGlite();
const subject='30000000-0000-0000-0000-000000000001';
const lecture='40000000-0000-0000-0000-000000000001';
const session='50000000-0000-0000-0000-000000000001';
beforeAll(async()=>{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA private;
 CREATE TABLE subjects(id uuid PRIMARY KEY,name text);
 CREATE TABLE lectures(id uuid PRIMARY KEY,subject_id uuid,title text,lecture_date date,created_by uuid,created_at timestamptz,kind text,section text,duration_minutes integer);
 CREATE TABLE sessions(id uuid PRIMARY KEY,lecture_id uuid,expires_at timestamptz);
 CREATE TABLE attendance(session_id uuid,student_id uuid);
 CREATE FUNCTION private.can_manage_unit(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
 CREATE FUNCTION private.get_current_user_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'owner'::text $$;
 GRANT USAGE ON SCHEMA private TO authenticated;
 GRANT SELECT ON subjects,lectures,sessions,attendance TO authenticated;
 ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
 CREATE POLICY scoped_lecture ON lectures TO authenticated USING(subject_id::text=current_setting('test.subject',true));`);
 await db.exec(readFileSync('supabase/migrations/20261002153738_fix_new_lecture_status.sql','utf8'));
},30000);
beforeEach(async()=>{
 await db.exec(`RESET ROLE; TRUNCATE attendance,sessions,lectures,subjects;
 INSERT INTO subjects VALUES('${subject}','مادة');
 INSERT INTO lectures VALUES('${lecture}','${subject}','حصة',current_date,NULL,now(),'section','15',60);
 SELECT set_config('test.subject','${subject}',false);`);
});
afterAll(()=>db.close());
async function state(){return (await db.query<{is_ended:boolean;session_count:number;attendee_count:number}>('SELECT is_ended,session_count,attendee_count FROM public.fetch_lectures()')).rows[0]!;}
describe('actual SQL lecture status',()=>{
 it('keeps a newly created section open before any session',async()=>{expect((await state()).is_ended).toBe(false);});
 it('ends only after existing sessions expire and counts students once',async()=>{
  await db.exec(`INSERT INTO sessions VALUES('${session}','${lecture}',now()+interval '1 hour');
  INSERT INTO attendance VALUES('${session}','60000000-0000-0000-0000-000000000001'),('${session}','60000000-0000-0000-0000-000000000001');`);
  let row=await state();expect(row.is_ended).toBe(false);expect(Number(row.session_count)).toBe(1);expect(Number(row.attendee_count)).toBe(1);
  await db.exec("UPDATE sessions SET expires_at=now()-interval '1 second'");row=await state();expect(row.is_ended).toBe(true);
 });
 it('keeps the invoker RLS boundary and denies anonymous execution',async()=>{
  await db.exec("SELECT set_config('test.subject','another-department',false); SET ROLE authenticated;");
  expect((await db.query('SELECT * FROM public.fetch_lectures()')).rows).toEqual([]);
  await db.exec('RESET ROLE');
  expect((await db.query<{allowed:boolean}>("SELECT has_function_privilege('anon','public.fetch_lectures(uuid)','EXECUTE') AS allowed")).rows[0]!.allowed).toBe(false);
 });
});
