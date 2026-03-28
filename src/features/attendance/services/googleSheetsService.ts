const STORAGE_KEY = "cyber_google_sheet_url";

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

export interface SheetEntry {
  id: string;
  time_slot: string;
  period: number;
  period_label: string;
  subject: string;
  instructor: string;
  room: string;
  entry_type: "lecture" | "section";
}

export interface SheetDaySchedule {
  day: string;
  entries: SheetEntry[];
}

// 8 fixed periods — this is the source of truth
const PERIODS = [
  { num: 1, start: "09:00", end: "10:00", label: "الأولى",   start12: "9:00 AM",  end12: "10:00 AM" },
  { num: 2, start: "10:05", end: "11:05", label: "الثانية",  start12: "10:05 AM", end12: "11:05 AM" },
  { num: 3, start: "11:10", end: "12:10", label: "الثالثة",  start12: "11:10 AM", end12: "12:10 PM" },
  { num: 4, start: "12:15", end: "13:15", label: "الرابعة",  start12: "12:15 PM", end12: "1:15 PM"  },
  { num: 5, start: "13:20", end: "14:20", label: "الخامسة",  start12: "1:20 PM",  end12: "2:20 PM"  },
  { num: 6, start: "14:25", end: "15:25", label: "السادسة",  start12: "2:25 PM",  end12: "3:25 PM"  },
  { num: 7, start: "15:30", end: "16:30", label: "السابعة",  start12: "3:30 PM",  end12: "4:30 PM"  },
  { num: 8, start: "16:35", end: "17:35", label: "الثامنة",  start12: "4:35 PM",  end12: "5:35 PM"  },
];

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

function normalizeTime(raw: string): string {
  const t = raw.trim();
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return t;
  let h = parseInt(match[1]);
  const m = match[2];
  // Sheet uses 09:00, 10:05, 11:10, 12:15, 01:20, 02:25, 03:30, 04:35
  // Convert to 24h: 01:20 → 13:20, 02:25 → 14:25, etc.
  if (h >= 1 && h <= 5) h += 12;
  return `${String(h).padStart(2, "0")}:${m}`;
}

function findPeriodByTime(timeStr: string): typeof PERIODS[0] | null {
  const normalized = normalizeTime(timeStr);
  for (const p of PERIODS) {
    if (normalized === p.start || normalized === p.end) return p;
    // Also check partial match (e.g., "11:10 " matches "11:10")
    const h = parseInt(normalized.split(":")[0]);
    const m = parseInt(normalized.split(":")[1] || "0");
    const ph = parseInt(p.start.split(":")[0]);
    const pm = parseInt(p.start.split(":")[1] || "0");
    if (h === ph && m === pm) return p;
  }
  // Try matching by position in the hour
  const h = parseInt(normalized.split(":")[0]);
  for (const p of PERIODS) {
    const ph = parseInt(p.start.split(":")[0]);
    if (h === ph) return p;
  }
  return null;
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
        return { data: [], error: "الجدول غير متاح. Share → Anyone with the link" };
      }

      const rows = parseCSV(csv);
      if (rows.length < 6) return { data: [], error: "الجدول فارغ" };

      // Row 2 = start times, Row 3 = end times
      const startRow = rows[2] || [];
      const endRow = rows[3] || [];

      // Find section row (column B = section number, rows 4-18)
      let dataRow: string[] | null = null;
      for (let i = 4; i < Math.min(rows.length, 20); i++) {
        if ((rows[i][1] || "").trim() === String(section)) {
          dataRow = rows[i];
          break;
        }
      }
      if (!dataRow) {
        for (let i = 4; i < Math.min(rows.length, 20); i++) {
          if ((rows[i][1] || "").trim() === "1") { dataRow = rows[i]; break; }
        }
      }
      if (!dataRow) return { data: [], error: `السكشن ${section} غير موجود` };

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

          // Determine period from the START TIME in the sheet
          const sheetStartTime = (startRow[ci] || "").trim();
          const sheetEndTime = (endRow[ci] || "").trim();
          const period = findPeriodByTime(sheetStartTime);

          const periodNum = period?.num || (p + 1);
          const periodLabel = period?.label || `الثانية`;
          const timeSlot = period
            ? `${period.start12} - ${period.end12}`
            : `${sheetStartTime} - ${sheetEndTime}`;

          entries.push({
            id: `${dayName}-${periodNum}-${subject}`,
            time_slot: timeSlot,
            period: periodNum,
            period_label: periodLabel,
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
