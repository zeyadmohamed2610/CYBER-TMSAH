import { toast } from "sonner";

export interface SheetRow {
  day: string;
  time_slot: string;
  subject: string;
  instructor: string;
  room: string;
  entry_type: "lecture" | "section";
  section: number;
}

const STORAGE_KEY = "cyber_google_sheet_url";

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      current.push(cell.trim());
      cell = "";
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      current.push(cell.trim());
      if (current.some(c => c !== "")) rows.push(current);
      current = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || current.length) {
    current.push(cell.trim());
    rows.push(current);
  }
  return rows;
}

function normalizeArabicDay(raw: string): string {
  const day = raw.trim();
  const map: Record<string, string> = {
    "السبت": "السبت", "saturday": "السبت",
    "الاحد": "الأحد", "الأحد": "الأحد", "sunday": "الأحد",
    "الاثنين": "الاثنين", "monday": "الاثنين",
    "الثلاثاء": "الثلاثاء", "tuesday": "الثلاثاء",
    "الاربعاء": "الأربعاء", "الأربعاء": "الأربعاء", "wednesday": "الأربعاء",
    "الخميس": "الخميس", "thursday": "الخميس",
    "الجمعة": "الجمعة", "friday": "الجمعة",
  };
  return map[day.toLowerCase()] || day;
}

function normalizeType(raw: string): "lecture" | "section" {
  const t = raw.trim().toLowerCase();
  if (t === "سكشن" || t === "section" || t === "عملي" || t === "s") return "section";
  return "lecture";
}

export const googleSheetsService = {
  getSheetUrl(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },

  setSheetUrl(url: string): void {
    localStorage.setItem(STORAGE_KEY, url);
  },

  clearSheetUrl(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  extractSheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  },

  buildCsvUrl(sheetId: string, sheetName?: string): string {
    const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base;
  },

  async fetchAndParse(url: string): Promise<{ rows: SheetRow[]; error?: string }> {
    try {
      const sheetId = this.extractSheetId(url);
      if (!sheetId) return { rows: [], error: "رابط غير صحيح. تأكد أن الرابط يحتوي على Google Sheets ID" };

      const csvUrl = this.buildCsvUrl(sheetId);
      const res = await fetch(csvUrl);
      if (!res.ok) return { rows: [], error: "فشل الاتصال بالجدول. تأكد أن الجدول مشار (Anyone with the link can view)" };

      const csv = await res.text();
      if (csv.includes("<!DOCTYPE html>") || csv.includes("<html>")) {
        return { rows: [], error: "الجدول غير متاح للعامة. اذهب للجدول → Share → Anyone with the link → Viewer" };
      }

      const parsed = parseCSV(csv);
      if (parsed.length < 2) return { rows: [], error: "الجدول فارغ أو لا يحتوي على بيانات" };

      const headers = parsed[0].map(h => h.toLowerCase().trim());
      const dayIdx = headers.findIndex(h => h.includes("يوم") || h === "day");
      const timeIdx = headers.findIndex(h => h.includes("وقت") || h.includes("فترة") || h === "time" || h === "time_slot");
      const subjectIdx = headers.findIndex(h => h.includes("مادة") || h.includes("موضوع") || h === "subject");
      const instructorIdx = headers.findIndex(h => h.includes("محاضر") || h.includes("مدرس") || h === "instructor" || h === "doctor");
      const roomIdx = headers.findIndex(h => h.includes("قاعة") || h.includes("معمل") || h === "room" || h === "hall");
      const typeIdx = headers.findIndex(h => h.includes("نوع") || h === "type" || h === "entry_type");
      const sectionIdx = headers.findIndex(h => h.includes("سكشن") || h === "section");

      if (dayIdx === -1 || timeIdx === -1 || subjectIdx === -1) {
        return { rows: [], error: "الجدول يجب أن يحتوي على أعمدة: يوم، وقت، مادة (على الأقل)" };
      }

      const rows: SheetRow[] = [];
      for (let i = 1; i < parsed.length; i++) {
        const row = parsed[i];
        if (!row[dayIdx] || !row[timeIdx] || !row[subjectIdx]) continue;
        rows.push({
          day: normalizeArabicDay(row[dayIdx]),
          time_slot: row[timeIdx],
          subject: row[subjectIdx],
          instructor: instructorIdx !== -1 ? row[instructorIdx] : "",
          room: roomIdx !== -1 ? row[roomIdx] : "",
          entry_type: typeIdx !== -1 ? normalizeType(row[typeIdx]) : "lecture",
          section: sectionIdx !== -1 ? (parseInt(row[sectionIdx]) || 1) : 0,
        });
      }

      return { rows };
    } catch {
      return { rows: [], error: "فشل الاتصال بـ Google Sheets. تحقق من اتصالك بالإنترنت" };
    }
  },

  async fetchScheduleForSection(section: number): Promise<{ data: import("@/features/attendance/services/scheduleService").DaySchedule[]; error?: string }> {
    const url = this.getSheetUrl();
    if (!url) return { data: [], error: "لم يتم ربط Google Sheet بعد" };

    const { rows, error } = await this.fetchAndParse(url);
    if (error) return { data: [], error };

    const allDays = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
    const daySchedule: import("@/features/attendance/services/scheduleService").DaySchedule[] = allDays.map(day => ({ day, entries: [] }));

    const filtered = rows.filter(r => r.section === 0 || r.section === section);

    for (const row of filtered) {
      const dayEntry = daySchedule.find(d => d.day === row.day);
      if (dayEntry) {
        dayEntry.entries.push({
          id: `${row.day}-${row.time_slot}-${row.subject}`,
          time_slot: row.time_slot,
          subject: row.subject,
          instructor: row.instructor,
          room: row.room,
          entry_type: row.entry_type,
          section_number: row.section,
        });
      }
    }

    return { data: daySchedule };
  },

  async fetchAllSections(): Promise<string[]> {
    const url = this.getSheetUrl();
    if (!url) return ["سكشن 1"];

    const { rows } = await this.fetchAndParse(url);
    const sectionNums = [...new Set(rows.map(r => r.section).filter(s => s > 0))].sort((a, b) => a - b);
    if (sectionNums.length === 0) return Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);
    return sectionNums.map(n => `سكشن ${n}`);
  },
};
