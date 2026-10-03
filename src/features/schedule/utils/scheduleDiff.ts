import type { AcademicEntry } from "./academicSchedule";

const slot = (entry: AcademicEntry) =>
  [entry.section, entry.day_index, entry.period, entry.week_pattern, entry.kind].join(":");
const content = (entry: AcademicEntry) =>
  JSON.stringify([
    entry.subject_id,
    entry.instructor_id,
    entry.instructor_name,
    entry.room,
    entry.uses_rotation,
    entry.lab_room,
    entry.hall_room,
    entry.lab_week,
  ]);
export function scheduleDiff(current: AcademicEntry[], incoming: AcademicEntry[]) {
  const before = new Map(current.map((entry) => [slot(entry), entry]));
  const after = new Map(incoming.map((entry) => [slot(entry), entry]));
  return {
    added: incoming.filter((entry) => !before.has(slot(entry))).length,
    removed: current.filter((entry) => !after.has(slot(entry))).length,
    changed: incoming.filter(
      (entry) => before.has(slot(entry)) && content(before.get(slot(entry))!) !== content(entry),
    ).length,
    unchanged: incoming.filter(
      (entry) => before.has(slot(entry)) && content(before.get(slot(entry))!) === content(entry),
    ).length,
  };
}
