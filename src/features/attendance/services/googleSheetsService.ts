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

export interface SheetDaySchedule {
  day: string;
  entries: {
    id: string;
    time_slot: string;
    subject: string;
    instructor: string;
    room: string;
    entry_type: "lecture" | "section";
  }[];
}

const STORAGE_KEY = "cyber_google_sheet_url";

const DAY_NAMES = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

function normalizeDay(raw: string): string {
  const d = raw.trim().replace("الاحد", "الأحد").replace("الاربعاء", "الأربعاء");
  return DAY_NAMES.find(day => d.includes(day.replace("الأ", "الا"))) || d;
}

function parseCell(raw: string): { subject: string; instructor: string; room: string; entry_type: "lecture" | "section" } {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { subject: "", instructor: "", room: "", entry_type: "lecture" };

  const subject = lines[0] || "";
  const instructor = lines[1] || "";
  const room = lines[2] || "";

  const isSection = /سكشن|section|عملي|AI LAB|معمل/i.test(raw) && !/مدرج|F-Sem|G201|G203|G205|G208/i.test(subject);
  return { subject, instructor, room, entry_type: isSection ? "section" : "lecture" };
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') { cell += '"'; i++; }
      else { inQuotes = !inQuotes; }
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

  buildCsvUrl(sheetId: string): string {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  },

  async fetchAndParse(url: string): Promise<{ rows: string[][]; error?: string }> {
    try {
      const sheetId = this.extractSheetId(url);
      if (!sheetId) return { rows: [], error: "رابط غير صحيح" };

      const csvUrl = this.buildCsvUrl(sheetId);
      const res = await fetch(csvUrl);
      if (!res.ok) return { rows: [], error: "فشل الاتصال بالجدول. تأكد أن الجدول مشار للعامة" };

      const csv = await res.text();
      if (csv.includes("<!DOCTYPE") || csv.includes("<html>")) {
        return { rows: [], error: "الجدول غير متاح. اذهب للجدول → Share → Anyone with the link → Viewer" };
      }

      const parsed = parseCSV(csv);
      if (parsed.length < 6) return { rows: [], error: "الجدول لا يحتوي على بيانات كافية" };

      return { rows: parsed };
    } catch {
      return { rows: [], error: "فشل الاتصال. تحقق من الإنترنت" };
    }
  },

  async fetchScheduleForSection(section: number): Promise<{ data: SheetDaySchedule[]; error?: string }> {
    const url = this.getSheetUrl();
    if (!url) return { data: [], error: "لم يتم ربط Google Sheet بعد" };

    const { rows, error } = await this.fetchAndParse(url);
    if (error) return { data: [], error };

    // Row 0: title (skip)
    // Row 1: day headers
    // Row 2: period numbers
    // Row 3: start times
    // Row 4: end times
    // Row 5+: section data

    const startTimes = rows[3] || [];
    const endTimes = rows[4] || [];

    // Find the section row
    let sectionRowIndex = -1;
    for (let i = 5; i < rows.length; i++) {
      const colB = (rows[i][1] || "").trim();
      if (colB === String(section)) {
        sectionRowIndex = i;
        break;
      }
    }
    if (sectionRowIndex === -1) {
      // Try matching section 1 if exact not found
      for (let i = 5; i < rows.length; i++) {
        const colB = (rows[i][1] || "").trim();
        if (colB === "1") { sectionRowIndex = i; break; }
      }
    }
    if (sectionRowIndex === -1) return { data: [], error: `السكشن ${section} غير موجود في الجدول` };

    const dataRow = rows[sectionRowIndex];

    // Each day has 8 periods, starting from column C (index 2)
    const result: SheetDaySchedule[] = [];

    for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
      const dayName = DAY_NAMES[dayIdx];
      const startCol = 2 + dayIdx * 8;
      const entries: SheetDaySchedule["entries"] = [];

      for (let period = 0; period < 8; period++) {
        const colIdx = startCol + period;
        const cellRaw = dataRow[colIdx] || "";
        if (!cellRaw.trim()) continue;

        const startT = (startTimes[colIdx] || "").trim();
        const endT = (endTimes[colIdx] || "").trim();
        const timeSlot = startT && endT ? `${startT} - ${endT}` : `الفترة ${period + 1}`;

        const parsed = parseCell(cellRaw);
        if (!parsed.subject) continue;

        entries.push({
          id: `${dayName}-${period}-${parsed.subject}`,
          time_slot: timeSlot,
          subject: parsed.subject,
          instructor: parsed.instructor,
          room: parsed.room,
          entry_type: parsed.entry_type,
        });
      }

      result.push({ day: dayName, entries });
    }

    // Friday is always holiday
    result.push({ day: "الجمعة", entries: [] });

    return { data: result };
  },

  async fetchAllSections(): Promise<string[]> {
    const url = this.getSheetUrl();
    if (!url) return Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);

    const { rows } = await this.fetchAndParse(url);
    const sectionNums: number[] = [];

    for (let i = 5; i < rows.length; i++) {
      const colB = (rows[i][1] || "").trim();
      const num = parseInt(colB);
      if (!isNaN(num) && num > 0 && !sectionNums.includes(num)) {
        sectionNums.push(num);
      }
    }

    sectionNums.sort((a, b) => a - b);
    if (sectionNums.length === 0) return Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);
    return sectionNums.map(n => `سكشن ${n}`);
  },
};
