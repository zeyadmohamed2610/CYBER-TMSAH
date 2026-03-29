import { useState } from "react";
import { Link2, Loader2, Pencil, Save, Globe, CheckCircle2, AlertCircle, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Entry {
  subject: string;
  instructor: string;
  room: string;
  entry_type: "lecture" | "section";
}

interface DayData {
  day: string;
  entries: (Entry | null)[];
}

type AllSections = Record<number, DayData[]>;

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

const PERIODS = [
  { time: "9:00 AM - 10:00 AM", label: "الأولى" },
  { time: "10:05 AM - 11:05 AM", label: "الثانية" },
  { time: "11:10 AM - 12:10 PM", label: "الثالثة" },
  { time: "12:15 PM - 1:15 PM",  label: "الرابعة" },
  { time: "1:20 PM - 2:20 PM",   label: "الخامسة" },
  { time: "2:25 PM - 3:25 PM",   label: "السادسة" },
  { time: "3:30 PM - 4:30 PM",   label: "السابعة" },
  { time: "4:35 PM - 5:35 PM",   label: "الثامنة" },
];

const SUBJECT_MAP: Record<string, string> = {
  "os": "نظم تشغيل", "cybersecurity": "مبادئ الأمن السيبراني",
  "negotiation": "مهارات التفاوض", "net": "شبكات وتراسل البيانات",
  "networking": "شبكات وتراسل البيانات", "engineering drawing": "رسم هندسي واسقاط",
  "technology": "مبادئ تكنولوجيا", "english": "لغة انجليزية",
  "رسم هندسي": "رسم هندسي واسقاط", "网络安全": "网络安全",
};

function mapSubject(raw: string): string {
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(SUBJECT_MAP)) {
    if (lower.includes(k)) return v;
  }
  return raw;
}

function cleanText(raw: string): string {
  return raw.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#10;/g, "\n").replace(/\s+/g, " ").trim();
}

function parseCell(raw: string): Entry {
  const text = cleanText(raw);
  if (!text || text === " ") return { subject: "", instructor: "", room: "", entry_type: "lecture" };

  const lines = text.split(/\s*<br\s*\/?\s*>\s*/i).map(l => cleanText(l)).filter(Boolean);

  if (lines.length === 0) return { subject: "", instructor: "", room: "", entry_type: "lecture" };

  if (lines.length === 1 && lines[0].includes(" - ")) {
    const parts = lines[0].split(" - ").map(p => p.trim());
    return {
      subject: mapSubject(parts[0] || ""),
      instructor: parts[1] || "",
      room: parts[2] || "",
      entry_type: /lab|معمل/i.test(raw) ? "section" : "lecture",
    };
  }

  return {
    subject: mapSubject(lines[0] || ""),
    instructor: lines[1] || "",
    room: lines[2] || "",
    entry_type: /ai lab|simulation lab|معمل/i.test(raw) && !/مدرج|f-sem/i.test(lines[0]) ? "section" : "lecture",
  };
}

const PUBLISH_KEY = "cyber_published_schedule";
const SHEET_KEY = "cyber_google_sheet_url";

function loadPublished(): AllSections {
  try { const r = localStorage.getItem(PUBLISH_KEY); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}

function savePublished(data: AllSections): void {
  localStorage.setItem(PUBLISH_KEY, JSON.stringify(data));
}

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Parse HTML table from Google Sheets
function parseHTMLTable(html: string): string[][] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];

  const rows: string[][] = [];
  const trs = table.querySelectorAll("tr");

  trs.forEach(tr => {
    const cells: string[] = [];
    tr.querySelectorAll("td, th").forEach(cell => {
      cells.push(cell.textContent?.trim() || "");
    });
    if (cells.some(c => c !== "")) rows.push(cells);
  });

  return rows;
}

// Also try CSV parsing as fallback
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (inQ && csv[i + 1] === '"') { cell += '"'; i++; }
      else { inQ = !inQ; }
    } else if (c === ',' && !inQ) {
      current.push(cell.replace(/\s+/g, " ").trim());
      cell = "";
    } else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && csv[i + 1] === '\n') i++;
      current.push(cell.replace(/\s+/g, " ").trim());
      if (current.some(x => x !== "")) rows.push(current);
      current = []; cell = "";
    } else {
      cell += c;
    }
  }
  if (cell || current.length) {
    current.push(cell.replace(/\s+/g, " ").trim());
    rows.push(current);
  }
  return rows;
}

function buildScheduleFromRows(rows: string[][]): AllSections {
  const imported: AllSections = {};

  for (let i = 4; i < Math.min(rows.length, 20); i++) {
    const secNum = parseInt((rows[i][1] || "").replace(/\s+/g, "").trim());
    if (isNaN(secNum) || secNum < 1) continue;

    const dataRow = rows[i];
    const sectionSchedule: DayData[] = DAYS.map(day => ({ day, entries: new Array(8).fill(null) }));
    sectionSchedule.push({ day: "الجمعة", entries: [] });

    for (let d = 0; d < 6; d++) {
      const baseCol = 1 + d * 8;
      for (let p = 0; p < 8; p++) {
        const ci = baseCol + p;
        const raw = (dataRow[ci] || "").replace(/\s+/g, " ").trim();
        if (!raw || raw === " ") continue;
        const entry = parseCell(raw);
        if (entry.subject) sectionSchedule[d].entries[p] = entry;
      }
    }

    imported[secNum] = sectionSchedule;
  }

  return imported;
}

export function SmartScheduleEditor() {
  const [sheetUrl, setSheetUrl] = useState(localStorage.getItem(SHEET_KEY) || "");
  const [importing, setImporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [allSections, setAllSections] = useState<AllSections>(loadPublished);
  const [selectedSection, setSelectedSection] = useState(1);
  const [editing, setEditing] = useState<{ day: number; period: number } | null>(null);
  const [editForm, setEditForm] = useState<Entry>({ subject: "", instructor: "", room: "", entry_type: "lecture" });
  const [hasChanges, setHasChanges] = useState(false);
  const [status, setStatus] = useState<"idle" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const currentSchedule = allSections[selectedSection] || [...DAYS.map(d => ({ day: d, entries: new Array(8).fill(null) })), { day: "الجمعة", entries: [] }];
  const sectionNumbers = Object.keys(allSections).map(Number).sort((a, b) => a - b);

  const handleImport = async () => {
    if (!sheetUrl) return;
    setImporting(true);
    setStatus("idle");
    setErrorMsg("");

    const id = extractSheetId(sheetUrl);
    if (!id) { setStatus("error"); setErrorMsg("رابط غير صحيح"); setImporting(false); return; }

    let imported: AllSections = {};
    let success = false;

    // Try 1: HTML format (best for multiline cells)
    try {
      const htmlUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:html`;
      const res = await fetch(htmlUrl);
      if (res.ok) {
        const html = await res.text();
        if (!html.includes("<!DOCTYPE") && html.includes("<table")) {
          const rows = parseHTMLTable(html);
          if (rows.length >= 6) {
            imported = buildScheduleFromRows(rows);
            if (Object.keys(imported).length > 0) success = true;
          }
        }
      }
    } catch { /* try next method */ }

    // Try 2: CSV format (fallback)
    if (!success) {
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
        const res = await fetch(csvUrl);
        if (res.ok) {
          const csv = await res.text();
          if (!csv.includes("<!DOCTYPE")) {
            const rows = parseCSV(csv);
            if (rows.length >= 6) {
              imported = buildScheduleFromRows(rows);
              if (Object.keys(imported).length > 0) success = true;
            }
          }
        }
      } catch { /* failed */ }
    }

    if (!success) {
      setStatus("error");
      setErrorMsg("فشل الاستيراد. تأكد أن الجدول مشار للعامة (Share → Anyone with the link → Viewer)");
      setImporting(false);
      return;
    }

    localStorage.setItem(SHEET_KEY, sheetUrl);
    setAllSections(imported);
    const secs = Object.keys(imported).map(Number).sort((a, b) => a - b);
    setSelectedSection(secs[0] || 1);
    setHasChanges(true);
    toast.success(`تم استيراد ${secs.length} سكشن`);
    setImporting(false);
  };

  const updateCurrentSchedule = (newDays: DayData[]) => {
    setAllSections(prev => ({ ...prev, [selectedSection]: newDays }));
    setHasChanges(true);
  };

  const startEdit = (dayIdx: number, periodIdx: number) => {
    const entry = currentSchedule[dayIdx]?.entries[periodIdx];
    setEditing({ day: dayIdx, period: periodIdx });
    setEditForm(entry || { subject: "", instructor: "", room: "", entry_type: "lecture" });
  };

  const saveEdit = () => {
    if (!editing) return;
    const newDays = [...currentSchedule.map(d => ({ ...d, entries: [...d.entries] }))];
    newDays[editing.day].entries[editing.period] = { ...editForm };
    updateCurrentSchedule(newDays);
    setEditing(null);
  };

  const clearEntry = (dayIdx: number, periodIdx: number) => {
    const newDays = [...currentSchedule.map(d => ({ ...d, entries: [...d.entries] }))];
    newDays[dayIdx].entries[periodIdx] = null;
    updateCurrentSchedule(newDays);
  };

  const handlePublish = () => {
    setPublishing(true);
    savePublished(allSections);
    setHasChanges(false);
    setTimeout(() => { setPublishing(false); toast.success("تم نشر كل السكاشن!"); }, 500);
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-primary" />
          إدارة الجدول الدراسي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Import */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={sheetUrl} onChange={(e) => { setSheetUrl(e.target.value); setStatus("idle"); }}
              placeholder="الصق رابط Google Sheet هنا..." dir="ltr" className="flex-1" />
            <Button onClick={handleImport} disabled={!sheetUrl || importing} className="gap-2 shrink-0">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {importing ? "جاري الاستيراد..." : "استيراد"}
            </Button>
          </div>
          {status === "error" && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span className="text-sm text-destructive">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        {sectionNumbers.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">السكشن:</span>
              <div className="relative">
                <select value={selectedSection} onChange={e => { setSelectedSection(Number(e.target.value)); setEditing(null); }}
                  className="appearance-none rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer pr-8">
                  {sectionNumbers.map(n => <option key={n} value={n}>سكشن {n}</option>)}
                </select>
                <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <span className="text-xs text-muted-foreground">({sectionNumbers.length} سكشن)</span>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && <span className="text-xs text-amber-500 font-medium">تغييرات غير منشورة</span>}
              {!hasChanges && sectionNumbers.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle2 className="h-3.5 w-3.5" />منشور</span>
              )}
              <Button onClick={handlePublish} disabled={publishing} className="gap-2">
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                {publishing ? "جاري النشر..." : "نشر الكل"}
              </Button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-bold text-primary">
              سكشن {selectedSection} — {DAYS[editing.day]} — الفترة {PERIODS[editing.period]?.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">المادة</Label>
                <Input value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} className="h-9 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">المحاضر</Label>
                <Input value={editForm.instructor} onChange={(e) => setEditForm({ ...editForm, instructor: e.target.value })} className="h-9 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">القاعة</Label>
                <Input value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} className="h-9 text-sm" /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveEdit} size="sm" className="gap-1"><Save className="h-3.5 w-3.5" />حفظ</Button>
              <Button onClick={() => setEditing(null)} size="sm" variant="outline">إلغاء</Button>
            </div>
          </div>
        )}

        {/* Grid */}
        {sectionNumbers.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-2 text-right font-bold text-xs text-muted-foreground border-b border-border min-w-[90px]">الفترة</th>
                  {DAYS.map(d => (
                    <th key={d} className="p-2 text-center font-bold text-xs text-foreground border-b border-border min-w-[140px]">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period, pi) => (
                  <tr key={pi} className="border-b border-border/50">
                    <td className="p-2 text-center">
                      <div className="text-[10px] font-bold text-primary">{period.label}</div>
                      <div className="text-[9px] text-muted-foreground" dir="ltr">{period.time}</div>
                    </td>
                    {DAYS.map((_, di) => {
                      const entry = currentSchedule[di]?.entries[pi];
                      const isEditing = editing?.day === di && editing?.period === pi;
                      return (
                        <td key={di} className={`p-1.5 ${isEditing ? "bg-primary/10" : ""}`}>
                          {entry ? (
                            <div className="group relative rounded-lg border border-border/50 p-2 cursor-pointer hover:border-primary/50 transition-colors bg-card"
                              onClick={() => startEdit(di, pi)}>
                              <div className="font-bold text-xs text-foreground leading-tight">{entry.subject}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{entry.instructor}</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[10px] text-primary">{entry.room}</span>
                                {entry.entry_type === "section" && <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1 rounded">سكشن</span>}
                              </div>
                              <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                                <button onClick={(e) => { e.stopPropagation(); startEdit(di, pi); }} className="p-0.5 rounded bg-primary/10 hover:bg-primary/20">
                                  <Pencil className="h-2.5 w-2.5 text-primary" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); clearEntry(di, pi); }} className="p-0.5 rounded bg-destructive/10 hover:bg-destructive/20">
                                  <Trash2 className="h-2.5 w-2.5 text-destructive" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-border/30 p-3 text-center cursor-pointer hover:border-primary/30 transition-colors"
                              onClick={() => startEdit(di, pi)}>
                              <span className="text-[10px] text-muted-foreground">+ إضافة</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
