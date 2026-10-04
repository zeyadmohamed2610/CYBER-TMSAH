import {
  scheduleCycle,
  scheduleRoom,
  weekStartDate,
  type AcademicEntry,
  type AcademicSchedule,
} from "./academicSchedule";
import { scheduleTiming } from "./scheduleTiming";

interface Options {
  data: AcademicSchedule;
  student: boolean;
  section: number;
  allSections: boolean;
  date: string;
  previewCycle: string;
  query?: string;
  now?: Date | undefined;
}
export interface TimetableLesson {
  entry: AcademicEntry;
  key: string;
  day: number;
  period: number;
  subject: string;
  instructor: string;
  kind: "lecture" | "section";
  room: string;
  remote: boolean;
  sections: number[];
  timing: ReturnType<typeof scheduleTiming>;
  next: boolean;
}
const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();

/** Resolve the requested week once, then index its lessons for both matrix axes. */
export function buildTimetable({
  data,
  student,
  section,
  allSections,
  date,
  previewCycle,
  query = "",
  now,
}: Options) {
  const days = Array.from({ length: 7 }, (_, i) => (data.settings.week_start_day + i) % 7);
  const start = Date.parse(`${weekStartDate(date, data.settings.week_start_day)}T00:00:00Z`);
  const dateForDay = (day: number) =>
    new Date(start + ((day - data.settings.week_start_day + 7) % 7) * 86400000)
      .toISOString()
      .slice(0, 10);
  const cycleForDay = (day: number) =>
    previewCycle === "auto" ? scheduleCycle(dateForDay(day), data) : Number(previewCycle);
  const subjects = new Map(data.subjects.map((subject) => [subject.id, subject.name]));
  const groups = new Map<string, TimetableLesson>();
  const search = normalize(query);
  const assigned = !student || /^[1-9]$|^1[0-5]$/.test(data.student_section ?? "");
  const ownSection = student ? Number(data.student_section) : section;
  for (const entry of data.entries) {
    if (
      data.settings.days_off.includes(entry.day_index) ||
      (!allSections && (!assigned || entry.section !== ownSection))
    )
      continue;
    const cycle = cycleForDay(entry.day_index);
    if (entry.week_pattern && entry.week_pattern !== cycle) continue;
    const room = scheduleRoom(entry, cycle).trim();
    const subject = entry.subject_name ?? subjects.get(entry.subject_id) ?? "مادة غير محددة";
    if (search && !normalize(`${subject} ${room} ${entry.instructor_name}`).includes(search))
      continue;
    const key = JSON.stringify([
      entry.day_index,
      entry.period,
      entry.subject_id,
      entry.kind,
      entry.instructor_id,
      entry.instructor_name,
      room,
    ]);
    const existing = groups.get(key);
    if (existing) {
      if (!existing.sections.includes(entry.section)) existing.sections.push(entry.section);
    } else {
      const remote = /^O\.[LN]$/i.test(room);
      groups.set(key, {
        key,
        entry,
        day: entry.day_index,
        period: entry.period,
        subject,
        instructor: entry.instructor_name,
        kind: entry.kind,
        room,
        remote,
        sections: [entry.section],
        timing:
          previewCycle === "auto" && !remote
            ? scheduleTiming(
                now,
                dateForDay(entry.day_index),
                data.settings.start_time,
                entry.period,
              )
            : "other-day",
        next: false,
      });
    }
  }
  const lessons = [...groups.values()].sort(
    (a, b) =>
      a.period - b.period || a.subject.localeCompare(b.subject) || a.room.localeCompare(b.room),
  );
  const nextPeriods = new Map<number, number>();
  for (const lesson of lessons) {
    lesson.sections.sort((a, b) => a - b);
    if (lesson.timing === "upcoming" && !nextPeriods.has(lesson.day))
      nextPeriods.set(lesson.day, lesson.period);
  }
  const cells = new Map<string, TimetableLesson[]>();
  for (const lesson of lessons) {
    lesson.next = nextPeriods.get(lesson.day) === lesson.period && lesson.timing === "upcoming";
    const key = `${lesson.day}:${lesson.period}`;
    cells.set(key, [...(cells.get(key) ?? []), lesson]);
  }
  return {
    data,
    date,
    days,
    lessons,
    search,
    assigned,
    allSections,
    section: ownSection,
    dateForDay,
    cycleForDay,
    getCell: (day: number, period: number, targetSection?: number) =>
      (cells.get(`${day}:${period}`) ?? []).filter(
        (lesson) => targetSection === undefined || lesson.sections.includes(targetSection),
      ),
  };
}
export type Timetable = ReturnType<typeof buildTimetable>;
