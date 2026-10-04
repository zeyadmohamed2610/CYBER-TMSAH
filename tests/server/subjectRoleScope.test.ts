// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
beforeAll(async () => {
  await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.auth',true),'')::uuid $$;
    CREATE TABLE public.users(id uuid PRIMARY KEY,auth_id uuid,role text,department text,academic_year text,subject_id uuid);
    CREATE TABLE public.subjects(id uuid PRIMARY KEY,department text,academic_year text);
    CREATE TABLE public.user_subjects(user_id uuid,subject_id uuid);
    CREATE FUNCTION private.get_caller_user() RETURNS public.users LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT * FROM public.users WHERE auth_id=auth.uid() $$;
    CREATE FUNCTION private.get_current_user_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT (private.get_caller_user()).role $$;
    CREATE FUNCTION private.can_manage_subject(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.users u WHERE u.auth_id=auth.uid() AND (u.subject_id=$1 OR EXISTS(SELECT 1 FROM public.user_subjects us WHERE us.user_id=u.id AND us.subject_id=$1))) $$;
    GRANT USAGE ON SCHEMA private,auth TO authenticated; GRANT SELECT ON public.subjects TO authenticated;
    ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY legacy_read ON public.subjects FOR SELECT TO authenticated USING(true);
    INSERT INTO public.subjects VALUES('${id(10)}','cybersecurity','2'),('${id(11)}','cybersecurity','1'),('${id(12)}','ai','2'),('${id(13)}','cybersecurity',NULL);
    INSERT INTO public.users VALUES('${id(1)}','${id(1)}','owner','cybersecurity',NULL,NULL),('${id(2)}','${id(2)}','coordinator','cybersecurity',NULL,NULL),('${id(3)}','${id(3)}','student','cybersecurity','2',NULL),('${id(4)}','${id(4)}','doctor','cybersecurity',NULL,'${id(10)}'),('${id(5)}','${id(5)}','ta','cybersecurity',NULL,NULL),('${id(6)}','${id(6)}','student',NULL,'2',NULL);
    INSERT INTO public.user_subjects VALUES('${id(4)}','${id(13)}'),('${id(5)}','${id(11)}');
  `);
  await db.exec(
    readFileSync("supabase/migrations/20261004064614_restrict_subject_catalog_by_role.sql", "utf8"),
  );
}, 30000);
afterAll(() => db.close());
async function visible(user: number | null) {
  await db.exec(
    `RESET ROLE; SELECT set_config('test.auth','${user ? id(user) : ""}',false); SET ROLE authenticated;`,
  );
  const rows = (await db.query<{ id: string }>("SELECT id FROM public.subjects ORDER BY id")).rows;
  await db.exec("RESET ROLE");
  return rows.map((row) => row.id);
}
describe("subject catalog scope is enforced behind dashboard tabs", () => {
  it("allows owners every department and year", async () =>
    expect(await visible(1)).toEqual([10, 11, 12, 13].map(id)));
  it("allows coordinators all years of their department", async () =>
    expect(await visible(2)).toEqual([10, 11, 13].map(id)));
  it("allows students only their year and common courses in their department", async () =>
    expect(await visible(3)).toEqual([10, 13].map(id)));
  it("includes both primary and additional assigned doctor subjects", async () =>
    expect(await visible(4)).toEqual([10, 13].map(id)));
  it("supports a TA with additional assignments and no primary subject", async () =>
    expect(await visible(5)).toEqual([11].map(id)));
  it("denies accounts with missing scope and unresolved identities", async () => {
    expect(await visible(6)).toEqual([]);
    expect(await visible(null)).toEqual([]);
  });
});
