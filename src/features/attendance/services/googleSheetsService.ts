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

// Subject mapping: sheet English names → Arabic names from materials page
const SUBJECT_MAP: Record<string, string> = {
  "os": "نظم تشغيل",
  "cybersecurity": "مبادئ الأمن السيبراني",
  "negotiation": "مهارات التفاوض",
  "networking": "شبكات وتراسل البيانات",
  "engineering drawing": "رسم هندسي واسقاط",
  "engineering-drawing": "رسم هندسي واسقاط",
  "technology": "مبادئ تكنولوجيا",
  "english": "لغة انجليزية",
  "net": "شبكات وتراسل البيانات",
  "رسم هندسي": "رسم هندسي واسقاط",
  "مبادئ الأمن": "مبادئ الأمن السيبراني",
  "مهارات التفاوض": "مهارات التفاوض",
  "شبكات": "شبكات وتراسل البيانات",
  "لغة انجليزية": "لغة انجليزية",
  "نظم تشغيل": "نظم تشغيل",
  "مبادئ تكنولوجيا": "مبادئ تكنولوجيا",
};

// Map sheet subject to Arabic name
function mapSubject(sheetSubject: string): string {
  const lower = sheetSubject.toLowerCase().trim();
  for (const [key, value] of Object.entries(SUBJECT_MAP)) {
    if (lower.includes(key.toLowerCase())) return value;
  }
  return sheetSubject;
}

// 8 fixed periods — 60 min lecture + 5 min break
const PERIODS = [
  { num: 1, start12: "9:00 AM",  end12: "10:00 AM", label: "الأولى" },
  { num: 2, start12: "10:05 AM", end12: "11:05 AM", label: "الثانية" },
  { num: 3, start12: "11:10 AM", end12: "12:10 PM", label: "الثالثة" },
  { num: 4, start12: "12:15 PM", end12: "1:15 PM",  label: "الرابعة" },
  { num: 5, start12: "1:20 PM",  end12: "2:20 PM",  label: "الخامسة" },
  { num: 6, start12: "2:25 PM",  end12: "3:25 PM",  label: "السادسة" },
  { num: 7, start12: "3:30 PM",  end12: "4:30 PM",  label: "السابعة" },
  { num: 8, start12: "4:35 PM",  end12: "5:35 PM",  label: "الثامنة" },
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

// Google Sheets cell: first line is subject (may be English or Arabic)
// e.g. "OS - ENG hamdy - AI LAB" or "网络安全"
function parseCell(raw: string): { subject: string; instructor: string; room: string } {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const sheetSubject = lines[0] || "";
  // Extract instructor: "OS - ENG hamdy - AI LAB" → "ENG hamdy"
  // Or direct: "د. سامح" 
  let instructor = lines[1] || "";
  // Extract room: "AI LAB", "G201", "D102", etc.
  const room = lines[2] || "";

  // If first line has " - " separators, extract parts
  // e.g. "OS - ENG hamdy - AI LAB" → subject="OS", instructor="ENG hamdy", room="AI LAB"
  if (lines.length === 1 && sheetSubject.includes(" - ")) {
    const parts = sheetSubject.split(" - ").map(p => p.trim());
    return {
      subject: mapSubject(parts[0]),
      instructor: parts[1] || "",
      room: parts[2] || "",
    };
  }

  return {
    subject: mapSubject(sheetSubject),
    instructor,
    room,
  };
}

// Convert sheet time like "09:00" or "01:20" to period index
// Sheet uses: 09:00, 10:05, 11:10, 12:15, 01:20, 02:25, 03:30, 04:35
function timeToPeriodNum(raw: string): number {
  const t = raw.trim();
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const h = parseInt(match[1]);
  const m = parseInt(match[2]);

  // Exact matches
  if (h === 9 && m === 0) return 1;   // 09:00 → P1
  if (h === 10 && m === 5) return 2;  // 10:05 → P2
  if (h === 11 && m === 10) return 3; // 11:10 → P3
  if (h === 12 && m === 15) return 4; // 12:15 → P4
  if (h === 1 && m === 20) return 5;  // 01:20 → P5 (PM)
  if (h === 2 && m === 25) return 6;  // 02:25 → P6 (PM)
  if (h === 3 && m === 30) return 7;  // 03:30 → P7 (PM)
  if (h === 4 && m === 35) return 8;  // 04:35 → P8 (PM)
  if (h === 13 && m === 20) return 5; // 13:20 → P5
  if (h === 14 && m === 25) return 6; // 14:25 → P6
  if (h === 15 && m === 30) return 7; // 15:30 → P7
  if (h === 16 && m === 35) return 8; // 16:35 → P8

  return 0;
}

function getPeriodInfo(num: number) {
  return PERIODS.find(p => p.num === num) || PERIODS[0];
}

function isSectionEntry(raw: string): boolean {
  return /ai lab|simulation lab|معمل/i.test(raw) && !/مدرج|f-sem/i.test(raw);
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

  async fetchAndParse(url: string): Promise<{ count: number; error?: string }> {
    const sheetId = this.extractSheetId(url);
    if (!sheetId) return { count: 0, error: "رابط غير صحيح" };

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) return { count: 0, error: "فشل الاتصال. تأكد أن الجدول مشار للعامة (Anyone with the link → Viewer)" };

      const csv = await res.text();
      if (csv.includes("<!DOCTYPE") || csv.includes("<html>")) {
        return { count: 0, error: "الجدول غير متاح. شارك الجدول: Share → Anyone with the link" };
      }

      const rows = parseCSV(csv);
      if (rows.length < 6) return { count: 0, error: "الجدول لا يحتوي بيانات كافية" };

      // Count how many section rows exist
      let sectionCount = 0;
      for (let i = 4; i < Math.min(rows.length, 20); i++) {
        const colB = (rows[i][1] || "").trim();
        if (colB && !isNaN(parseInt(colB))) sectionCount++;
      }

      return { count: sectionCount };
    } catch {
      return { count: 0, error: "فشل الاتصال. تحقق من الإنترنت" };
    }
  },

  async fetchScheduleForSection(section: number): Promise<{ data: SheetDaySchedule[]; error?: string }> {
    const url = this.getSheetUrl();
    if (!url) return { data: [], error: "لم يتم ربط Google Sheet" };

    const sheetId = this.extractSheetId(url);
    if (!sheetId) return { data: [], error: "رابط غير صحيح" };

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) return { data: [], error: "فشل الاتصال بالجدول" };

      const csv = await res.text();
      if (csv.includes("<!DOCTYPE") || csv.includes("<html>")) {
        return { data: [], error: "الجدول غير متاح. Share → Anyone with the link" };
      }

      const rows = parseCSV(csv);
      if (rows.length < 6) return { data: [], error: "الجدول فارغ" };

      // Row 2 = start times, Row 3 = end times
      const startRow = rows[2] || [];

      // Find section row
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
        const baseCol = 1 + d * 8;
        const entries: SheetEntry[] = [];

        for (let p = 0; p < 8; p++) {
          const ci = baseCol + p;
          const raw = (dataRow[ci] || "").trim();
          if (!raw) continue;

          const { subject, instructor, room } = parseCell(raw);
          if (!subject) continue;

          // Get period number from sheet start time
          const sheetTime = (startRow[ci] || "").trim();
          const periodNum = timeToPeriodNum(sheetTime) || (p + 1);
          const pInfo = getPeriodInfo(periodNum);

          entries.push({
            id: `${dayName}-${periodNum}-${subject}`,
            time_slot: `${pInfo.start12} - ${pInfo.end12}`,
            period: periodNum,
            period_label: pInfo.label,
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
