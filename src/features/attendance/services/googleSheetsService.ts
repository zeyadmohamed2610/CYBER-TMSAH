const STORAGE_KEY = "cyber_google_sheet_url";

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

export interface SheetEntry {
  id: string;
  time_slot: string;
  subject: string;
  instructor: string;
  room: string;
  entry_type: "lecture" | "section";
}

export interface SheetDaySchedule {
  day: string;
  entries: SheetEntry[];
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

function parseCell(raw: string): { subject: string; instructor: string; room: string } {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  return {
    subject: lines[0] || "",
    instructor: lines[1] || "",
    room: lines[2] || "",
  };
}

function to12h(raw: string): string {
  const t = raw.trim();
  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return t;
  let h = parseInt(match[1]);
  const m = match[2];

  // Sheet uses 09:00, 10:05, 11:10, 12:15, 01:20, 02:25, 03:30, 04:35
  // All times before 6 are PM (after noon), 9-12 are AM
  if (h >= 1 && h <= 5) h += 12; // 01:20 → 13:20 → 1:20 PM

  const period = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  return `${h}:${m} ${period}`;
}

function isSectionEntry(raw: string): boolean {
  const lower = raw.toLowerCase();
  if (/ai lab|simulation lab|معمل/.test(lower) && !/مدرج|f-sem/.test(lower)) return true;
  return false;
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

  async fetchScheduleForSection(section: number): Promise<{ data: SheetDaySchedule[]; error?: string }> {
    const url = this.getSheetUrl();
    if (!url) return { data: [], error: "لم يتم ربط Google Sheet" };

    const sheetId = this.extractSheetId(url);
    if (!sheetId) return { data: [], error: "رابط غير صحيح" };

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) return { data: [], error: "فشل الاتصال بالجدول. تأكد أنه مشار للعامة" };

      const csv = await res.text();
      if (csv.includes("<!DOCTYPE") || csv.includes("<html>")) {
        return { data: [], error: "الجدول غير متاح. Share → Anyone with the link → Viewer" };
      }

      const rows = parseCSV(csv);
      if (rows.length < 6) return { data: [], error: "الجدول فارغ" };

      // Row indices:
      // 0 = title + day headers
      // 1 = period numbers (1-8 per day)
      // 2 = start times
      // 3 = end times
      // 4+ = section data

      const startRow = rows[2] || [];
      const endRow = rows[3] || [];

      // Find section row in rows 4-18
      let dataRow: string[] | null = null;
      for (let i = 4; i < Math.min(rows.length, 20); i++) {
        const colB = (rows[i][1] || "").trim();
        if (colB === String(section)) {
          dataRow = rows[i];
          break;
        }
      }
      if (!dataRow) {
        // fallback to section 1
        for (let i = 4; i < Math.min(rows.length, 20); i++) {
          if ((rows[i][1] || "").trim() === "1") { dataRow = rows[i]; break; }
        }
      }
      if (!dataRow) return { data: [], error: `السكشن ${section} غير موجود` };

      // Data columns: col C (index 2) onward, 8 columns per day
      const result: SheetDaySchedule[] = [];

      for (let d = 0; d < 6; d++) {
        const dayName = DAYS[d];
        const baseCol = 2 + d * 8;
        const entries: SheetEntry[] = [];

        for (let p = 0; p < 8; p++) {
          const ci = baseCol + p;
          const raw = (dataRow[ci] || "").trim();
          if (!raw) continue;

          const { subject, instructor, room } = parseCell(raw);
          if (!subject) continue;

          const sTime = to12h(startRow[ci] || "");
          const eTime = to12h(endRow[ci] || "");
          const timeSlot = sTime && eTime ? `${sTime} - ${eTime}` : `الفترة ${p + 1}`;

          entries.push({
            id: `${dayName}-${p}-${subject}`,
            time_slot: timeSlot,
            subject,
            instructor,
            room,
            entry_type: isSectionEntry(raw) ? "section" : "lecture",
          });
        }

        result.push({ day: dayName, entries });
      }

      result.push({ day: "الجمعة", entries: [] });
      return { data: result };

    } catch {
      return { data: [], error: "فشل الاتصال. تحقق من الإنترنت" };
    }
  },

  async fetchAllSections(): Promise<string[]> {
    const url = this.getSheetUrl();
    if (!url) return Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);

    const sheetId = this.extractSheetId(url);
    if (!sheetId) return Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);

    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`);
      if (!res.ok) return Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);
      const rows = parseCSV(await res.text());

      const nums: number[] = [];
      for (let i = 4; i < Math.min(rows.length, 20); i++) {
        const n = parseInt((rows[i][1] || "").trim());
        if (!isNaN(n) && n > 0 && !nums.includes(n)) nums.push(n);
      }
      nums.sort((a, b) => a - b);
      return nums.length > 0 ? nums.map(n => `سكشن ${n}`) : Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);
    } catch {
      return Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);
    }
  },
};
