import { describe, expect, it } from "vitest";
import { scheduleDiff } from "./scheduleDiff";
import type { AcademicEntry } from "./academicSchedule";
const entry: AcademicEntry = {
  section: 1,
  day_index: 5,
  period: 1,
  subject_id: "subject",
  instructor_id: null,
  instructor_name: "محاضر",
  kind: "section",
  week_pattern: 1,
  room: "A02",
  uses_rotation: false,
  lab_room: "",
  hall_room: "",
  lab_week: 1,
};
describe("university timetable replacement diff", () => {
  it("ignores regenerated identifiers", () =>
    expect(scheduleDiff([{ ...entry, id: "old" }], [{ ...entry, id: "new" }])).toEqual({
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 1,
    }));
  it("identifies changed rooms without silently swapping weeks", () =>
    expect(scheduleDiff([entry], [{ ...entry, room: "G203" }])).toEqual({
      added: 0,
      removed: 0,
      changed: 1,
      unchanged: 0,
    }));
  it("counts a moved weekly class as removed and added", () =>
    expect(scheduleDiff([entry], [{ ...entry, week_pattern: 2 }])).toEqual({
      added: 1,
      removed: 1,
      changed: 0,
      unchanged: 0,
    }));
});
