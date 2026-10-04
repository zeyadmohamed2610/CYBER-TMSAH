// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
beforeAll(async () => {
  await db.exec(readFileSync("tests/server/fixtures/facultyDepartments.sql", "utf8"));
  await db.exec(
    readFileSync(
      "supabase/migrations/20261004160610_faculty_departments_and_dashboard_scope.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261004162629_execute_membership_validation_with_private_guard_access.sql",
      "utf8",
    ),
  );
  await db.exec(
    `INSERT INTO public.users(id,auth_id,role,department,academic_year,section_number) VALUES('${id(1)}','${id(1)}','owner','cybersecurity',NULL,NULL),('${id(2)}','${id(2)}','coordinator','cybersecurity',NULL,NULL),('${id(3)}','${id(3)}','student','cybersecurity','2',1),('${id(4)}','${id(4)}','doctor','cybersecurity',NULL,NULL),('${id(5)}','${id(5)}','ta','ai',NULL,NULL); UPDATE public.users SET departments=ARRAY['cybersecurity','ai'] WHERE role IN ('doctor','ta');`,
  );
}, 30000);
afterAll(() => db.close());
async function caller(n: number) {
  await db.exec(`RESET ROLE;SELECT set_config('test.auth','${id(n)}',false);`);
}
it.each([4, 5])(
  "allows faculty %s to read schedules and results in both approved departments",
  async (n) => {
    await caller(n);
    for (const dept of ["cybersecurity", "ai"]) {
      expect(
        (
          await db.query<{ scope: { department: string } }>(
            `SELECT private.academic_scope('${dept}','4') as scope`,
          )
        ).rows[0]?.scope.department,
      ).toBe(dept);
      expect(
        (
          await db.query<{ department: string }>(
            `SELECT private.lifecycle_department('${dept}') as department`,
          )
        ).rows[0]?.department,
      ).toBe(dept);
    }
    await expect(db.query("SELECT private.academic_scope('data_science','1')")).rejects.toThrow(
      /another department/,
    );
    await expect(db.query("SELECT private.academic_scope('ai','1',true)")).rejects.toThrow(
      /management/,
    );
  },
);
it.each([2, 3])("denies multi-department membership to non-faculty %s", async (n) => {
  await caller(1);
  await expect(
    db.exec(`UPDATE public.users SET departments=ARRAY['cybersecurity','ai'] WHERE id='${id(n)}'`),
  ).rejects.toThrow(/only faculty/);
  await caller(n);
  await expect(db.query("SELECT private.academic_scope('ai','2')")).rejects.toThrow(
    /another department/,
  );
});
it("does not let faculty expand their own department access", async () => {
  await caller(4);
  await expect(
    db.exec(
      `UPDATE public.users SET departments=ARRAY['cybersecurity','ai','data_science'] WHERE id='${id(4)}'`,
    ),
  ).rejects.toThrow(/permission_denied/);
});
it("lets only faculty request more than one department", async () => {
  await db.exec("SELECT set_config('test.auth','',false)");
  await db.exec(
    `INSERT INTO public.join_requests(id,role,department,departments,status) VALUES('${id(20)}','doctor','cybersecurity',ARRAY['cybersecurity','ai'],'pending')`,
  );
  await expect(
    db.exec(
      `INSERT INTO public.join_requests(id,role,department,departments,status) VALUES('${id(21)}','student','cybersecurity',ARRAY['cybersecurity','ai'],'pending')`,
    ),
  ).rejects.toThrow(/only faculty/);
});
it("rejects invalid and duplicate departments", async () => {
  await caller(1);
  for (const departments of [
    "ARRAY['cybersecurity','unknown']",
    "ARRAY['cybersecurity','cybersecurity']",
  ]) {
    await expect(
      db.exec(`UPDATE public.users SET departments=${departments} WHERE id='${id(4)}'`),
    ).rejects.toThrow(/validation_error/);
  }
});
it("preserves single-department edits for students", async () => {
  await caller(1);
  await db.exec(`UPDATE public.users SET department='ai' WHERE id='${id(3)}'`);
  expect(
    (
      await db.query<{ departments: string[] }>(
        `SELECT departments FROM public.users WHERE id='${id(3)}'`,
      )
    ).rows[0]?.departments,
  ).toEqual(["ai"]);
});
it("enforces timetable department membership through table RLS", async () => {
  await caller(1);
  await db.exec(
    `INSERT INTO public.academic_schedule_entries(id,department,academic_year) VALUES('${id(30)}','cybersecurity','2'),('${id(31)}','ai','4'),('${id(32)}','data_science','2')`,
  );
  for (const [n, expected] of [
    [4, ["ai", "cybersecurity"]],
    [2, ["cybersecurity"]],
    [3, []],
  ] as const) {
    await caller(n);
    await db.exec("SET ROLE authenticated");
    expect(
      (
        await db.query<{ department: string }>(
          "SELECT department FROM public.academic_schedule_entries ORDER BY department",
        )
      ).rows.map((r) => r.department),
    ).toEqual([...expected]);
    await db.exec("RESET ROLE");
  }
});
it("lets a coordinator assign only its subjects without removing another department's assignments", async () => {
  await caller(1);
  await db.exec(
    `INSERT INTO public.subjects(id,name,department) VALUES('${id(40)}','Cyber subject','cybersecurity'),('${id(41)}','AI subject','ai'),('${id(42)}','Data subject','data_science');INSERT INTO public.user_subjects(user_id,subject_id) VALUES('${id(5)}','${id(41)}');`,
  );
  await caller(2);
  await db.query(
    `SELECT * FROM private.write_user_subjects('${id(5)}',ARRAY['${id(40)}']::uuid[])`,
  );
  await caller(1);
  expect(
    (
      await db.query<{ subject_id: string }>(
        `SELECT subject_id FROM public.user_subjects WHERE user_id='${id(5)}' ORDER BY subject_id`,
      )
    ).rows.map((r) => r.subject_id),
  ).toEqual([id(40), id(41)]);
  await caller(2);
  await expect(
    db.query(`SELECT * FROM private.write_user_subjects('${id(5)}',ARRAY['${id(41)}']::uuid[])`),
  ).rejects.toThrow(/outside department/);
  await caller(1);
  await expect(
    db.exec(`INSERT INTO public.user_subjects(user_id,subject_id) VALUES('${id(5)}','${id(42)}')`),
  ).rejects.toThrow(/faculty department/);
});
it("validates anonymous join submissions without giving anonymous users access to private helpers", async () => {
  await db.exec(
    "RESET ROLE;SELECT set_config('test.auth','',false);GRANT INSERT ON public.join_requests TO anon; SET ROLE anon;",
  );
  await db.exec(
    `INSERT INTO public.join_requests(id,role,department,departments,status) VALUES('${id(51)}','ta','cybersecurity',ARRAY['cybersecurity','ai'],'pending')`,
  );
  await expect(db.query("SELECT private.get_current_user_role()")).rejects.toThrow(
    /permission denied/,
  );
  await db.exec("RESET ROLE");
});
