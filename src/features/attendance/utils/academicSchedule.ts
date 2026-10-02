export const ACADEMIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export interface AcademicSettings {
  semester_start: string | null; week_start_day: number; start_time: string; days_off: number[];
}
export interface AcademicEntry {
  id?: string; section: number; day_index: number; period: number; subject_id: string; subject_name?: string;
  instructor_id: string | null; instructor_name: string; kind: 'lecture' | 'section'; week_pattern: number;
  room: string; uses_rotation: boolean; lab_room: string; hall_room: string; lab_week: number;
}
export interface AcademicSchedule {
  server_time?: string;
  cycles?: { anchor: { date: string; cycle: number } | null; days: Record<string, number> };
  revision?: string;
  department: string; academic_year: string; can_edit: boolean; student_section: string | null;
  settings: AcademicSettings; entries: AcademicEntry[];
  subjects: { id: string; name: string }[];
  instructors: { id: string; name: string; role: string; subjects: string[] }[];
}
export function cairoDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now);
}
export function weekStartDate(date: string, startDay: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() - startDay + 7) % 7);
  return day.toISOString().slice(0, 10);
}
export function scheduleCycle(date: string, schedule: AcademicSchedule): number {
  const exception = schedule.cycles?.days[date];
  if (exception === 1 || exception === 2) return exception;
  return weeklyScheduleCycle(date, schedule);
}
export function weeklyScheduleCycle(date: string, schedule: AcademicSchedule): number {
  const anchor = schedule.cycles?.anchor;
  if (anchor) {
    const weeks = (Date.parse(weekStartDate(date, schedule.settings.week_start_day)) - Date.parse(weekStartDate(anchor.date, schedule.settings.week_start_day))) / 604800000;
    return ((weeks + anchor.cycle - 1) % 2 + 2) % 2 + 1;
  }
  const week = academicWeek(date, schedule.settings.semester_start, schedule.settings.week_start_day);
  return week ? weekCycle(week) : 1;
}
export function academicWeek(date: string, start: string | null, weekStart: number): number | null {
  if (!start) return null;
  const target = Date.parse(`${date}T00:00:00Z`), semester = Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(semester) || target < semester) return null;
  const anchor = semester - ((new Date(semester).getUTCDay() - weekStart + 7) % 7) * 86400000;
  return Math.floor((target - anchor) / 604800000) + 1;
}
export function weekCycle(week: number): 1 | 2 { return week % 2 === 1 ? 1 : 2; }
export function parseWeekPattern(value: string): number {
  const normalized = value.toLowerCase().replace(/\s/g, '');
  if (['', 'all', 'كلأسبوع', '0'].includes(normalized)) return 0;
  if (/^(?:week|أسبوع|اسبوع)?1$/.test(normalized)) return 1;
  if (/^(?:week|أسبوع|اسبوع)?2$/.test(normalized)) return 2;
  throw new Error('الأسبوع يجب أن يكون كل أسبوع أو week1 أو week2 أو 1 أو 2');
}
export function scheduleRoom(entry: AcademicEntry, cycle: number): string {
  return entry.uses_rotation ? (cycle === entry.lab_week ? entry.lab_room : entry.hall_room) : entry.room;
}
export function slotTime(start: string, period: number): string {
  const [h = 9, m = 0] = start.split(':').map(Number);
  const minutes = h * 60 + m + (period - 1) * 60;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function validateAcademicEntries(entries: AcademicEntry[]): string[] {
  const errors: string[] = [];
  for (const [index, entry] of entries.entries()) {
    if (!Number.isInteger(entry.section) || entry.section < 1 || entry.section > 15 || !Number.isInteger(entry.period) || entry.period < 1 || entry.period > 11 || !Number.isInteger(entry.day_index) || entry.day_index < 0 || entry.day_index > 6)
      errors.push(`الصف ${index + 2}: رقم السكشن أو اليوم أو الحصة غير صالح`);
    if (!entry.subject_id) errors.push(`الصف ${index + 2}: المادة غير معروفة`);
    if (entry.uses_rotation && (entry.kind !== 'section' || !entry.lab_room.trim() || !entry.hall_room.trim())) errors.push(`الصف ${index + 2}: التناوب يحتاج سكشنًا ومعملًا وقاعة`);
    if (entries.slice(0, index).some(e => e.section === entry.section && e.day_index === entry.day_index && e.period === entry.period && (!e.week_pattern || !entry.week_pattern || e.week_pattern === entry.week_pattern)))
      errors.push(`الصف ${index + 2}: حصتان لنفس السكشن في الوقت نفسه`);
  }
  return errors;
}
