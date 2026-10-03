import { describe, expect, it } from "vitest";
import { attendanceStatus } from "./attendanceStatus";
import type { Result } from "./types";
const row: Result = {
  student_id: "student",
  subject_id: "subject",
  subject_name: "مادة",
  kind: "lecture",
  student_snapshot: { name: "طالب", section: 1, academic_year: "2" },
  present: 0,
  absent: 10,
  excused: 0,
  total: 10,
  rule_snapshot: null,
};
describe("opt-in attendance policy", () => {
  it("never warns without an administrator's limits, even at 100% absence", () =>
    expect(attendanceStatus(row)).toBe("unset"));
  it("does not divide by zero when all classes are excused", () =>
    expect(
      attendanceStatus({
        ...row,
        absent: 0,
        excused: 10,
        rule_snapshot: {
          term_id: "term",
          subject_id: "subject",
          kind: "lecture",
          max_absences: null,
          warning_absences: null,
          max_percent: 25,
          warning_percent: null,
          excuse_mode: "exclude",
        },
      }),
    ).toBe("normal"));
});
