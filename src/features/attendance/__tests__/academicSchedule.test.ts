import { describe, expect, it } from 'vitest';
import { academicWeek, parseWeekPattern, scheduleRoom, slotTime, validateAcademicEntries, weekCycle, type AcademicEntry, type AcademicSchedule } from '../utils/academicSchedule';
import { exportScheduleWorkbook, importScheduleWorkbook } from '../utils/scheduleWorkbook';
const entry: AcademicEntry = { section: 1, day_index: 5, period: 1, subject_id: 'subject', subject_name: 'مادة', instructor_id: null, instructor_name: '', kind: 'section', week_pattern: 0, room: '', uses_rotation: true, lab_room: 'معمل 1', hall_room: 'قاعة 2', lab_week: 1 };
const schedule: AcademicSchedule = { department: 'cybersecurity', academic_year: '1', can_edit: true, student_section: null, settings: { semester_start: null, week_start_day: 5, start_time: '09:00', days_off: [] }, entries: [entry], subjects: [{ id: 'subject', name: 'مادة' }], instructors: [] };
describe('academic week and section schedule', () => {
  it('changes weeks on Friday across month boundaries', () => {
    expect(academicWeek('2026-10-01', '2026-09-25', 5)).toBe(1);
    expect(academicWeek('2026-10-02', '2026-09-25', 5)).toBe(2);
    expect(academicWeek('2026-10-09', '2026-09-25', 5)).toBe(3);
  });
  it('does not invent a start date or a week before the semester', () => {
    expect(academicWeek('2026-10-02', null, 5)).toBeNull();
    expect(academicWeek('2026-09-24', '2026-09-25', 5)).toBeNull();
  });
  it('respects a configurable first weekday', () => {
    expect(academicWeek('2026-10-02', '2026-09-25', 6)).toBe(2);
    expect(academicWeek('2026-10-03', '2026-09-25', 6)).toBe(3);
  });
  it('alternates two lab and two hall visits in four weeks', () => {
    expect([1, 2, 3, 4].map(n => scheduleRoom(entry, weekCycle(n)))).toEqual(['معمل 1', 'قاعة 2', 'معمل 1', 'قاعة 2']);
  });
  it('can start a section in the hall instead of the lab', () => { expect(scheduleRoom({ ...entry, lab_week: 2 }, 1)).toBe('قاعة 2'); });
  it.each(['week1', 'Week 1', '1', 'أسبوع 1'])('accepts %s', value => { expect(parseWeekPattern(value)).toBe(1); });
  it('accepts week2 and rejects unknown week labels', () => { expect(parseWeekPattern('week2')).toBe(2); expect(() => parseWeekPattern('week3')).toThrow(); });
  it('keeps all periods exactly an hour including noon', () => { expect(slotTime('09:00', 4)).toBe('12:00'); expect(slotTime('09:00', 5)).toBe('13:00'); });
  it('rejects overlapping weekly rows but allows alternating rows', () => {
    expect(validateAcademicEntries([entry, { ...entry, week_pattern: 1 }])).not.toEqual([]);
    expect(validateAcademicEntries([{ ...entry, week_pattern: 1 }, { ...entry, week_pattern: 2 }])).toEqual([]);
  });
  it('requires both places for a rotating section', () => { expect(validateAcademicEntries([{ ...entry, hall_room: '' }])).not.toEqual([]); });
  it('round-trips a real XLSX workbook with Arabic and weekly rotation', async () => {
    const bytes = await exportScheduleWorkbook(schedule);
    const imported = await importScheduleWorkbook(bytes, schedule);
    expect(imported).toEqual([{ ...entry, subject_name: undefined }].map(({ subject_name: _unused, ...rest }) => rest));
  }, 15000);
  it('rejects a workbook that references an unapproved subject', async () => {
    const bytes = await exportScheduleWorkbook(schedule);
    await expect(importScheduleWorkbook(bytes, { ...schedule, subjects: [] })).rejects.toThrow('غير معتمد');
  });
  it('preserves a display-only instructor without creating or linking an account', async () => {
    const bytes = await exportScheduleWorkbook({ ...schedule, entries: [{ ...entry, instructor_name: 'اسم من الجدول الأصلي' }] });
    const [imported] = await importScheduleWorkbook(bytes, schedule);
    expect(imported?.instructor_name).toBe('اسم من الجدول الأصلي');
    expect(imported?.instructor_id).toBeNull();
  });
  it('rejects linked instructors unless they are assigned the subject and correct role', async () => {
    const bytes = await exportScheduleWorkbook({ ...schedule, entries: [{ ...entry, instructor_id: 'teacher', instructor_name: 'محاضر' }] });
    await expect(importScheduleWorkbook(bytes, { ...schedule, instructors: [{ id: 'teacher', name: 'محاضر', role: 'doctor', subjects: ['subject'] }] })).rejects.toThrow('غير مسند');
  });
  it('keeps the Friday afternoon slot at 14:00 and detects changed time settings', async () => {
    const bytes = await exportScheduleWorkbook({ ...schedule, entries: [{ ...entry, day_index: 5, period: 6 }] });
    expect((await importScheduleWorkbook(bytes, schedule))[0]?.period).toBe(6);
    await expect(importScheduleWorkbook(bytes, { ...schedule, settings: { ...schedule.settings, start_time: '08:00' } })).rejects.toThrow('الوقت لا يطابق');
  });
});
