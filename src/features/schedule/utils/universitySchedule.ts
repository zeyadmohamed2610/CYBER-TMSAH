import type { Worksheet } from "exceljs";
import {
  slotTime,
  validateAcademicEntries,
  type AcademicEntry,
  type AcademicSchedule,
} from "./academicSchedule";

export interface UniversityImport {
  entries: AcademicEntry[];
  format: "university" | "template";
  sheet_name: string;
  warnings: string[];
  start_time?: string;
  source_cells: number;
  places: { cell: string; section: number; start: string; end: string }[];
}
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/[^a-z0-9\u0600-\u06ff+]/g, "");
const dayNames: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  الاحد: 0,
  الاثنين: 1,
  الثلاثاء: 2,
  الاربعاء: 3,
  الخميس: 4,
  الجمعة: 5,
  السبت: 6,
};
const aliases: Record<string, string> = {
  ai: "Artificial Intelligence",
  "c++": "Programming For Cyber-Security",
  internetapplicationsdevelopment: "Internet Application Development",
  internetapp: "Internet Application Development",
  securednetwork: "Secure Network",
  securnetwork: "Secure Network",
};
export function universitySheetYear(name: string): string | null {
  const n = normalize(name);
  const names = [
    ["1styear", "firstyear", "الفرقةالاولي", "الفرقةالاولى"],
    ["2ndyear", "secondyear", "الفرقةالثانية"],
    ["3rdyear", "thirdyear", "الفرقةالثالثة"],
    ["4thyear", "fourthyear", "الفرقةالرابعة"],
  ];
  const index = names.findIndex((group) => group.includes(n));
  return index < 0 ? null : String(index + 1);
}
export function parseUniversitySchedule(
  sheet: Worksheet,
  schedule: AcademicSchedule,
): UniversityImport {
  if (sheet.rowCount > 500 || sheet.columnCount > 100)
    throw new Error("شيت الجامعة يتجاوز حجم الجدول المدعوم");
  if (universitySheetYear(sheet.name) !== schedule.academic_year)
    throw new Error("شيت الجامعة لا يطابق الفرقة المحددة");
  let headerRow = 0;
  let columns: { column: number; section: number }[] = [];
  for (let r = 1; r <= Math.min(20, sheet.rowCount); r++) {
    const found: typeof columns = [];
    sheet.getRow(r).eachCell((cell) => {
      if (!cell.isMerged || cell.master.address === cell.address) {
        const value = Number(cell.text.trim().replace(/^(?:section|sec|سكشن)\s*/i, ""));
        if (Number.isInteger(value) && value >= 1 && value <= 15)
          found.push({ column: Number(cell.col), section: value });
      }
    });
    if (found.length === 15 && new Set(found.map((c) => c.section)).size === 15) {
      headerRow = r;
      columns = found;
      break;
    }
  }
  if (!headerRow) throw new Error("لم أجد صف السكاشن 1–15 في شيت الجامعة. راجع عناوين الأعمدة");
  const firstColumn = Math.min(...columns.map((c) => c.column));
  const entries: AcademicEntry[] = [],
    places: UniversityImport["places"] = [],
    seen = new Set<string>();
  const warnings = new Set<string>();
  // The university workbook owns its times, independently of previously saved settings.
  const firstTimes = new Map<number, number>();
  let scanDay: number | undefined;
  for (let row = headerRow + 1; row <= sheet.rowCount; row++) {
    for (let col = 1; col < firstColumn; col++) {
      const text = sheet.getCell(row, col).text.trim();
      const namedDay = dayNames[normalize(text)];
      if (namedDay !== undefined) scanDay = namedDay;
      const time = text.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*\d{1,2}:\d{2}$/);
      if (scanDay !== undefined && time && !firstTimes.has(scanDay))
        firstTimes.set(scanDay, Number(time[1]) * 60 + Number(time[2]));
    }
  }
  const baseMinutes = firstTimes.size ? Math.min(...firstTimes.values()) : 540;
  const startTime = `${String(Math.floor(baseMinutes / 60)).padStart(2, "0")}:${String(baseMinutes % 60).padStart(2, "0")}`;
  let day: number | undefined,
    previousEnd = 0,
    sourceCells = 0;
  const fail = (cell: string, message: string): never => {
    throw new Error(`${sheet.name} · ${cell}: ${message}`);
  };
  for (let row = headerRow + 1; row <= sheet.rowCount; row++) {
    let rawTime = "",
      timeCell = "";
    for (let col = 1; col < firstColumn; col++) {
      const cell = sheet.getCell(row, col),
        text = cell.text.trim();
      const nextDay = dayNames[normalize(text)];
      if (nextDay !== undefined && nextDay !== day) {
        day = nextDay;
        previousEnd = 0;
      }
      if (/^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}$/.test(text)) {
        if (cell.formula) fail(cell.address, "الصيغ غير مسموحة في مواعيد الجدول");
        rawTime = text;
        timeCell = cell.address;
      }
    }
    if (!rawTime) {
      const orphan = columns
        .map((c) => sheet.getCell(row, c.column))
        .find((c) => Number(c.master.row) === row && /^(?:Dr\.|Eng[.\s-])/im.test(c.text));
      if (orphan) fail(orphan.address, "توجد حصة دون موعد واضح في صفها؛ صحح الوقت قبل الاستيراد");
      continue;
    }
    if (day === undefined) fail(timeCell, "اليوم غير معروف");
    const match = rawTime.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/)!;
    let start = Number(match[1]) * 60 + Number(match[2]),
      end = Number(match[3]) * 60 + Number(match[4]);
    if (
      Number(match[1]) > 23 ||
      Number(match[3]) > 23 ||
      Number(match[2]) > 59 ||
      Number(match[4]) > 59
    )
      fail(timeCell, "وقت غير صالح");
    while (start < previousEnd) start += 720;
    while (end <= start) end += 720;
    if (end - start !== 60 || end > 1440)
      fail(timeCell, "مدة الحصة يجب أن تكون ساعة وبترتيب زمني صحيح");
    previousEnd = end;
    const period = (start - baseMinutes) / 60 + 1;
    if (!Number.isInteger(period) || period < 1 || period > 11)
      fail(timeCell, "الموعد خارج الحصص الـ11. اضبط بداية أول حصة لتطابق الملف");
    for (const column of columns) {
      const cell = sheet.getCell(row, column.column),
        master = cell.master;
      if (!cell.text.trim() || seen.has(master.address)) continue;
      seen.add(master.address);
      if (master.formula) fail(master.address, "الصيغ غير مسموحة في حصص الجدول");
      const text = master.text.trim();
      if (/^(?:break|rest|day\s*off|استراحة|اجازة|إجازة)$/i.test(text)) continue;
      if (Number(master.row) !== row)
        fail(master.address, "حصة ممتدة رأسيًا على أكثر من موعد تحتاج مراجعة");
      const sections = columns
        .filter((c) => sheet.getCell(row, c.column).master.address === master.address)
        .map((c) => c.section);
      const groups: string[][] = [];
      let group: string[] = [];
      for (const line of text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (/^(?:\([12]\)|week\s*[12]\b|[12](?:\s|$))/i.test(line) && group.length) {
          groups.push(group);
          group = [];
        }
        group.push(line);
      }
      if (group.length) groups.push(group);
      sourceCells++;
      for (const lines of groups) {
        if (/^(?:\([12]\)|week\s*[12]|[12])$/i.test(lines[0]!) && lines.length > 1)
          lines.splice(0, 2, `${lines[0]} ${lines[1]}`);
        const label = lines[0]!;
        const prefix = label.match(/^(?:\(([12])\)|week\s*([12])\b|([12])(?=\s))\s*/i);
        const suffix = label.match(/(?:\s*\(([12])\)|\s*week\s*([12])\b|\s+([12]))\s*$/i);
        const week = Number(
          prefix?.[1] ??
            prefix?.[2] ??
            prefix?.[3] ??
            suffix?.[1] ??
            suffix?.[2] ??
            suffix?.[3] ??
            0,
        );
        const rawSubject = label
          .replace(/^(?:\([12]\)|week\s*[12]\b|[12](?=\s))\s*/i, "")
          .replace(/(?:\s*\([12]\)|\s*week\s*[12]\b|\s+[12])\s*$/i, "")
          .trim();
        const target = aliases[normalize(rawSubject)] ?? rawSubject;
        const subject = schedule.subjects.find((s) => normalize(s.name) === normalize(target));
        if (!subject)
          fail(master.address, `المادة «${rawSubject}» غير موجودة في قائمة مواد الفرقة`);
        const teacherIndex = lines.findIndex((s) => /^(?:Dr\.|Eng[.\s-])/i.test(s));
        if (teacherIndex !== 1) fail(master.address, "اسم المادة أو الدكتور/المعيد غير واضح");
        const teacher = lines[teacherIndex]!;
        const kind = /^Dr\./i.test(teacher) ? "lecture" : "section";
        const details = teacher.replace(/^(?:Dr\.|Eng[.\s-]+)\s*/i, "");
        let name: string, room: string;
        if (details.includes("/")) {
          const [n, ...parts] = details.split("/");
          name = n!.trim();
          room = parts.join("/").trim();
        } else {
          const parts = details.match(
            /^(.*?)\s*-\s*((?:[A-Z]\d{2,3}|A-New|F-SEMINAR|O\.[LN]).*)$/i,
          );
          if (!parts)
            fail(master.address, "المكان غير واضح؛ استخدم فاصلًا بين اسم المحاضر والمكان");
          name = parts![1]!.trim();
          room = parts![2]!.trim();
        }
        if (lines.length > teacherIndex + 1)
          room += " / " + lines.slice(teacherIndex + 1).join(" / ");
        const rooms = room
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean);
        if (
          !name ||
          !rooms.length ||
          rooms.length > 2 ||
          (rooms.length > 1 && (kind !== "section" || week === 2))
        )
          fail(master.address, "توزيع الأماكن والأسابيع غير واضح");
        const placements =
          rooms.length === 2
            ? rooms.map((place, i) => ({ room: place, week: i + 1 }))
            : [{ room: rooms[0]!, week }];
        for (const placement of placements)
          for (const section of sections) {
            entries.push({
              section,
              day_index: day!,
              period,
              subject_id: subject!.id,
              instructor_id: null,
              instructor_name: name,
              kind,
              week_pattern: placement.week,
              room: placement.room,
              uses_rotation: false,
              lab_room: "",
              hall_room: "",
              lab_week: 1,
            });
            places.push({
              cell: master.address,
              section,
              start: slotTime(startTime, period),
              end: slotTime(startTime, period + 1),
            });
          }
      }
    }
  }
  if (!entries.length || entries.length > 1200)
    throw new Error("لم أجد حصصًا صالحة أو تجاوز الملف 1200 حصة");
  const errors = validateAcademicEntries(entries);
  if (errors.length) throw new Error(errors.slice(0, 8).join("\n"));
  for (const [i, e] of entries.entries())
    if (
      entries
        .slice(0, i)
        .some(
          (p) =>
            normalize(p.instructor_name) === normalize(e.instructor_name) &&
            p.day_index === e.day_index &&
            p.period === e.period &&
            (!p.week_pattern || !e.week_pattern || p.week_pattern === e.week_pattern) &&
            (p.kind !== e.kind || p.subject_id !== e.subject_id || p.room !== e.room),
        )
    )
      throw new Error(`تعارض مواعيد المحاضر ${e.instructor_name}`);
  warnings.add("أسماء المحاضرين محفوظة للعرض فقط. اربط حساباتهم بعد إسناد المواد لهم.");
  for (const subject of schedule.subjects.filter((s) =>
    entries.some((e) => e.subject_id === s.id && e.kind === "section"),
  ))
    for (const week of [1, 2]) {
      const missing = columns
        .map((c) => c.section)
        .filter(
          (section) =>
            !entries.some(
              (e) =>
                e.subject_id === subject.id &&
                e.kind === "section" &&
                e.section === section &&
                (!e.week_pattern || e.week_pattern === week),
            ),
        );
      if (missing.length)
        warnings.add(
          `${subject.name} · week${week}: لا توجد حصص للسكاشن ${missing.join("، ")}. لن نضيف مواعيد افتراضية.`,
        );
    }
  return {
    entries,
    start_time: startTime,
    format: "university",
    sheet_name: sheet.name,
    warnings: [...warnings],
    source_cells: sourceCells,
    places,
  };
}
