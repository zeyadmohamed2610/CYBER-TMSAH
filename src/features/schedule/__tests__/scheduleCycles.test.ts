import { describe, expect, it } from "vitest";
import {
  cairoDate,
  scheduleCycle,
  weekStartDate,
  type AcademicSchedule,
} from "../utils/academicSchedule";
const data: AcademicSchedule = {
  department: "cybersecurity",
  academic_year: "2",
  can_edit: false,
  student_section: "1",
  settings: { semester_start: null, week_start_day: 5, start_time: "09:00", days_off: [] },
  entries: [],
  subjects: [],
  instructors: [],
  cycles: { anchor: { date: "2026-10-02", cycle: 1 }, days: { "2026-10-05": 2 } },
};
describe("automatic daily and weekly schedule selection", () => {
  it("alternates at the configured week boundary and works before the anchor", () => {
    expect(scheduleCycle("2026-10-02", data)).toBe(1);
    expect(scheduleCycle("2026-10-08", data)).toBe(1);
    expect(scheduleCycle("2026-10-09", data)).toBe(2);
    expect(scheduleCycle("2026-10-16", data)).toBe(1);
    expect(scheduleCycle("2026-09-25", data)).toBe(2);
  });
  it("overrides one calendar date without changing neighboring days or future Mondays", () => {
    expect(scheduleCycle("2026-10-05", data)).toBe(2);
    expect(scheduleCycle("2026-10-04", data)).toBe(1);
    expect(scheduleCycle("2026-10-06", data)).toBe(1);
    expect(scheduleCycle("2026-10-19", data)).toBe(1);
  });
  it("uses Cairo midnight and crosses months and years correctly", () => {
    expect(cairoDate(new Date("2026-10-01T21:30:00Z"))).toBe("2026-10-02");
    expect(weekStartDate("2027-01-01", 5)).toBe("2027-01-01");
    expect(weekStartDate("2027-01-03", 5)).toBe("2027-01-01");
  });
});
