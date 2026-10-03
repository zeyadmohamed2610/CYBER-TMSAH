import {
  ACADEMIC_DAYS,
  parseWeekPattern,
  slotTime,
  validateAcademicEntries,
  type AcademicEntry,
  type AcademicSchedule,
} from "./academicSchedule";
import {
  parseUniversitySchedule,
  universitySheetYear,
  type UniversityImport,
} from "./universitySchedule";
const headers = [
  "السكشن",
  "اليوم",
  "الحصة",
  "المادة",
  "النوع",
  "الأسبوع",
  "المحاضر",
  "المكان",
  "تناوب المعمل والقاعة",
  "المعمل",
  "القاعة",
  "أسبوع المعمل",
];
const optionalHeaders = ["بداية الحصة", "نهاية الحصة", "ربط حساب المحاضر"];
export async function exportScheduleWorkbook(
  schedule: AcademicSchedule,
  template = false,
): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("الجدول", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });
  sheet.addRow([...headers, ...optionalHeaders]);
  if (!template)
    for (const e of schedule.entries)
      sheet.addRow([
        e.section,
        ACADEMIC_DAYS[e.day_index],
        e.period,
        e.subject_name ?? schedule.subjects.find((s) => s.id === e.subject_id)?.name ?? "",
        e.kind === "lecture" ? "محاضرة" : "سكشن",
        e.week_pattern ? `week${e.week_pattern}` : "كل أسبوع",
        e.instructor_name,
        e.room,
        e.uses_rotation ? "نعم" : "لا",
        e.lab_room,
        e.hall_room,
        `week${e.lab_week}`,
        slotTime(schedule.settings.start_time, e.period),
        slotTime(schedule.settings.start_time, e.period + 1),
        e.instructor_id ? "نعم" : "لا",
      ]);
  sheet.columns.forEach((column, i) => {
    column.width = [12, 16, 12, 34, 14, 16, 28, 22, 26, 22, 22, 18][i] ?? 20;
  });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
  sheet.autoFilter = { from: "A1", to: "O1" };
  const help = book.addWorksheet("تعليمات", { views: [{ rightToLeft: true }] });
  [
    "كل صف يمثل حصة واحدة مدتها ساعة.",
    "السكاشن من 1 إلى 15 والحصص من 1 إلى 11.",
    "الأسبوع: كل أسبوع أو week1 أو week2 أو 1 أو 2.",
    "للتناوب: اختر نعم وحدد المكانين وأسبوع المكان الأول.",
    "يجب أن تطابق أسماء المواد القائمة المعتمدة.",
    "ربط حساب المحاضر: نعم لحساب مسند للمادة، أو لا لحفظ الاسم للعرض فقط دون إسناد صلاحيات.",
    "بداية الحصة ونهايتها اختياريتان؛ إن أدخلتهما يجب مطابقتهما لإعداد بداية أول حصة.",
    "الإجازات وبداية الدراسة تضبط من إعدادات الجدول.",
    "يعرض الاستيراد معاينة قبل الحفظ ولا يحذف الجدول الحالي.",
  ].forEach((text) => help.addRow([text]));
  help.getColumn(1).width = 90;
  return (await book.xlsx.writeBuffer()) as ArrayBuffer;
}
async function readWorkbook(
  file: ArrayBuffer,
  schedule: AcademicSchedule,
): Promise<UniversityImport> {
  if (file.byteLength > 5 * 1024 * 1024) throw new Error("الحد الأقصى للملف 5 ميجابايت");
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(file);
  const template = book.getWorksheet("الجدول");
  const universitySheets = book.worksheets.filter(
    (s) => universitySheetYear(s.name) === schedule.academic_year,
  );
  const hasTemplate =
    template &&
    headers.every(
      (header, i) =>
        template
          .getRow(1)
          .getCell(i + 1)
          .text.trim() === header,
    );
  if (!hasTemplate && universitySheets.length === 1)
    return parseUniversitySchedule(universitySheets[0]!, schedule);
  if (!hasTemplate && universitySheets.length > 1)
    throw new Error("يوجد أكثر من شيت لنفس الفرقة. احتفظ بشيت واحد معتمد لها");
  const sheet = template ?? book.worksheets[0];
  if (!sheet || sheet.rowCount > 1201) throw new Error("الملف فارغ أو يتجاوز 1200 صف");
  const first = sheet.getRow(1);
  if (headers.some((header, i) => first.getCell(i + 1).text.trim() !== header))
    throw new Error(
      "لم أجد قالب الموقع أو شيت الجامعة للفرقة المحددة. اختر الفرقة الصحيحة وراجع أسماء الشيتات",
    );
  const entries: AcademicEntry[] = [];
  const optionalColumn = (name: string) => {
    let found = 0;
    first.eachCell((cell, column) => {
      if (cell.text.trim() === name) found = column;
    });
    return found;
  };
  const startColumn = optionalColumn("بداية الحصة");
  const endColumn = optionalColumn("نهاية الحصة");
  const linkColumn = optionalColumn("ربط حساب المحاضر");
  sheet.eachRow((row, index) => {
    if (index === 1 || !row.getCell(1).text.trim()) return;
    for (const i of [
      ...Array.from({ length: 12 }, (_, n) => n + 1),
      startColumn,
      endColumn,
      linkColumn,
    ].filter(Boolean))
      if (row.getCell(i).formula)
        throw new Error(`الصف ${index}: الصيغ غير مسموحة في بيانات الجدول`);
    const text = (i: number) => row.getCell(i).text.trim();
    const subject = schedule.subjects.find((s) => s.name.toLowerCase() === text(4).toLowerCase());
    const kind =
      text(5) === "محاضرة" || text(5) === "lecture"
        ? "lecture"
        : text(5) === "سكشن" || text(5) === "section"
          ? "section"
          : null;
    if (!subject || !kind) throw new Error(`الصف ${index}: مادة أو نوع حصة غير معتمد`);
    const linkValue = linkColumn ? text(linkColumn).toLowerCase() || "نعم" : "نعم";
    if (!["نعم", "لا", "true", "false", "1", "0"].includes(linkValue))
      throw new Error(`الصف ${index}: ربط حساب المحاضر يجب أن يكون نعم أو لا`);
    const linkInstructor = ["نعم", "true", "1"].includes(linkValue);
    const instructor = linkInstructor
      ? schedule.instructors.find(
          (u) =>
            u.name === text(7) &&
            u.role === (kind === "lecture" ? "doctor" : "ta") &&
            u.subjects.includes(subject.id),
        )
      : undefined;
    if (linkInstructor && text(7) && !instructor)
      throw new Error(
        `الصف ${index}: المحاضر غير مسند للمادة أو نوع الحصة. اختر لا في عمود ربط حساب المحاضر للاحتفاظ باسمه للعرض فقط`,
      );
    const period = Number(text(3));
    if (
      (startColumn &&
        text(startColumn) &&
        text(startColumn) !== slotTime(schedule.settings.start_time, period)) ||
      (endColumn &&
        text(endColumn) &&
        text(endColumn) !== slotTime(schedule.settings.start_time, period + 1))
    )
      throw new Error(
        `الصف ${index}: الوقت لا يطابق إعداد بداية أول حصة. راجع إعداد بداية أول حصة وأوقات الملف`,
      );
    const labWeek = parseWeekPattern(text(12) || "1");
    if (labWeek === 0) throw new Error(`الصف ${index}: حدد أسبوع المعمل 1 أو 2`);
    entries.push({
      section: Number(text(1)),
      day_index: ACADEMIC_DAYS.findIndex(
        (d) => d.replace(/[أإ]/g, "ا") === text(2).replace(/[أإ]/g, "ا"),
      ),
      period,
      subject_id: subject.id,
      instructor_id: instructor?.id ?? null,
      instructor_name: instructor?.name ?? text(7),
      kind,
      week_pattern: parseWeekPattern(text(6)),
      room: text(8),
      uses_rotation: ["نعم", "true", "1"].includes(text(9).toLowerCase()),
      lab_room: text(10),
      hall_room: text(11),
      lab_week: labWeek,
    });
  });
  if (!entries.length) throw new Error("لا توجد حصص للاستيراد");
  const errors = validateAcademicEntries(entries);
  if (errors.length) throw new Error(errors.slice(0, 8).join("\n"));
  return {
    entries,
    format: "template",
    sheet_name: sheet.name,
    warnings: [],
    source_cells: entries.length,
    places: [],
  };
}
export async function importScheduleWorkbook(
  file: ArrayBuffer,
  schedule: AcademicSchedule,
): Promise<AcademicEntry[]> {
  return (await readScheduleWorkbook(file, schedule)).entries;
}

export class ScheduleImportError extends Error {}
export async function readScheduleWorkbook(
  file: ArrayBuffer,
  schedule: AcademicSchedule,
): Promise<UniversityImport> {
  try {
    return await readWorkbook(file, schedule);
  } catch (error) {
    const message =
      error instanceof Error && /[\u0600-\u06ff]/.test(error.message)
        ? error.message
        : "تعذر قراءة الملف. ارفع ملف جدول الجامعة بصيغة Excel دون تغيير امتداده.";
    throw new ScheduleImportError(message);
  }
}
