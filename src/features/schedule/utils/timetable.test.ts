import { describe, expect, it } from "vitest";
import { buildTimetable } from "./timetable";
import type { AcademicEntry, AcademicSchedule } from "./academicSchedule";

const entry = (changes: Partial<AcademicEntry> = {}): AcademicEntry => ({
  section: 1,
  day_index: 0,
  period: 1,
  subject_id: "s",
  instructor_id: "teacher",
  instructor_name: "Teacher",
  kind: "section",
  week_pattern: 0,
  room: "A",
  uses_rotation: false,
  lab_room: "Lab",
  hall_room: "Hall",
  lab_week: 2,
  ...changes,
});
const data = (entries: AcademicEntry[]): AcademicSchedule => ({
  department: "cybersecurity",
  academic_year: "2",
  can_edit: false,
  student_section: "2",
  subjects: [{ id: "s", name: "Networks" }],
  instructors: [],
  entries,
  settings: {
    semester_start: "2026-09-25",
    week_start_day: 5,
    start_time: "09:00",
    days_off: [4, 6],
  },
  cycles: { anchor: { date: "2026-10-02", cycle: 1 }, days: { "2026-10-04": 2 } },
});
const options = {
  student: false,
  section: 1,
  allSections: true,
  date: "2026-10-04",
  previewCycle: "auto",
};

describe("resolved matrix timetable", () => {
  it("resolves day overrides and alternating venues before filtering a searched week", () => {
    const model = buildTimetable({
      ...options,
      data: data([
        entry({ week_pattern: 2, uses_rotation: true }),
        entry({ week_pattern: 1, room: "Wrong week" }),
        entry({ day_index: 6, room: "Holiday" }),
      ]),
      query: "lab",
    });
    expect(model.dateForDay(0)).toBe("2026-10-04");
    expect(model.cycleForDay(0)).toBe(2);
    expect(model.cycleForDay(1)).toBe(1);
    expect(model.lessons.map((lesson) => lesson.room)).toEqual(["Lab"]);
  });
  it("uses a student's assigned section instead of a stale UI selection and never invents one", () => {
    const source = data([entry({ section: 1 }), entry({ section: 2, room: "B" })]);
    expect(
      buildTimetable({ ...options, data: source, student: true, allSections: false }).lessons.map(
        (lesson) => lesson.room,
      ),
    ).toEqual(["B"]);
    expect(
      buildTimetable({
        ...options,
        data: { ...source, student_section: null },
        student: true,
        allSections: false,
      }).lessons,
    ).toEqual([]);
    expect(
      buildTimetable({ ...options, data: { ...source, student_section: null }, student: true })
        .lessons,
    ).toHaveLength(2);
  });
  it("deduplicates shared lessons but preserves simultaneous teachers and rooms in every cell", () => {
    const model = buildTimetable({
      ...options,
      data: data([
        entry({ section: 2 }),
        entry(),
        entry(),
        entry({ room: "B" }),
        entry({ instructor_id: "other" }),
      ]),
    });
    expect(model.getCell(0, 1)).toHaveLength(3);
    expect(model.getCell(0, 1, 2)).toHaveLength(1);
    expect(model.getCell(0, 1, 2)[0]?.sections).toEqual([1, 2]);
  });
  it("marks only the nearest upcoming period and excludes recorded lessons from live timing", () => {
    const model = buildTimetable({
      ...options,
      now: new Date("2026-10-04T06:30:00Z"),
      data: data([
        entry(),
        entry({ period: 2, room: " O.L " }),
        entry({ period: 3 }),
        entry({ period: 4 }),
      ]),
    });
    expect(model.lessons.find((l) => l.period === 1)?.timing).toBe("current");
    expect(model.lessons.find((l) => l.period === 2)?.timing).toBe("other-day");
    expect(model.lessons.filter((l) => l.next).map((l) => l.period)).toEqual([3]);
    expect(
      buildTimetable({
        ...options,
        previewCycle: "2",
        now: new Date("2026-10-04T06:30:00Z"),
        data: data([entry()]),
      }).lessons[0]?.timing,
    ).toBe("other-day");
  });
});
