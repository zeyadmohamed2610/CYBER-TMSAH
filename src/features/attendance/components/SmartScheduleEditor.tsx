import { useState } from "react";
import { Link2, Loader2, Pencil, Save, Globe, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
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

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

const PERIODS = [
  { num: 1, time: "9:00 AM - 10:00 AM", label: "الأولى" },
  { num: 2, time: "10:05 AM - 11:05 AM", label: "الثانية" },
  { num: 3, time: "11:10 AM - 12:10 PM", label: "الثالثة" },
  { num: 4, time: "12:15 PM - 1:15 PM",  label: "الرابعة" },
  { num: 5, time: "1:20 PM - 2:20 PM",   label: "الخامسة" },
  { num: 6, time: "2:25 PM - 3:25 PM",   label: "السادسة" },
  { num: 7, time: "3:30 PM - 4:30 PM",   label: "السابعة" },
  { num: 8, time: "4:35 PM - 5:35 PM",   label: "الثامنة" },
];

// Subject mapping
const SUBJECT_MAP: Record<string, string> = {
  "os": "نظم تشغيل", "cybersecurity": "مبادئ الأمن السيبراني",
  "negotiation": "مهارات التفاوض", "net": "شبكات وتراسل البيانات",
  "networking": "شبكات وتراسل البيانات", "engineering drawing": "رسم هندسي واسقاط",
  "technology": "مبادئ تكنولوجيا", "english": "لغة انجليزية",
};

function mapSubject(raw: string): string {
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(SUBJECT_MAP)) {
    if (lower.includes(k)) return v;
  }
  return raw;
}

// CSV parser
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { current.push(cell.trim()); cell = ""; }
    else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && csv[i + 1] === '\n') i++;
      current.push(cell.trim());
      if (current.some(x => x !== "")) rows.push(current);
      current = []; cell = "";
    } else { cell += c; }
  }
  if (cell || current.length) { current.push(cell.trim()); rows.push(current); }
  return rows;
}

// Parse cell: "OS - ENG hamdy - AI LAB" or multi-line
function parseCell(raw: string): Entry {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
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

function getPublished(): DayData[] | null {
  try {
    const raw = localStorage.getItem(PUBLISH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function publish(data: DayData[]): void {
  localStorage.setItem(PUBLISH_KEY, JSON.stringify(data));
}

export function SmartScheduleEditor() {
  const [sheetUrl, setSheetUrl] = useState(localStorage.getItem(SHEET_KEY) || "");
  const [importing, setImporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [schedule, setSchedule] = useState<DayData[]>(getPublished() || []);
  const [editing, setEditing] = useState<{ day: number; period: number } | null>(null);
  const [editForm, setEditForm] = useState<Entry>({ subject: "", instructor: "", room: "", entry_type: "lecture" });
  const [hasChanges, setHasChanges] = useState(false);
  const [status, setStatus] = useState<"idle" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const extractId = (url: string) => {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  };

  const handleImport = async () => {
    if (!sheetUrl) return;
    setImporting(true);
    setStatus("idle");
    setErrorMsg("");

    const id = extractId(sheetUrl);
    if (!id) {
      setStatus("error");
      setErrorMsg("رابط غير صحيح");
      setImporting(false);
      return;
    }

    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`);
      if (!res.ok) {
        setStatus("error");
        setErrorMsg("فشل الاتصال. تأكد أن الجدول مشار للعامة");
        setImporting(false);
        return;
      }

      const csv = await res.text();
      if (csv.includes("<!DOCTYPE")) {
        setStatus("error");
        setErrorMsg("الجدول غير متاح. شارك: Share → Anyone with the link");
        setImporting(false);
        return;
      }

      const rows = parseCSV(csv);
      if (rows.length < 6) {
        setStatus("error");
        setErrorMsg("الجدول فارغ");
        setImporting(false);
        return;
      }

      localStorage.setItem(SHEET_KEY, sheetUrl);

      const startRow = rows[2] || [];

      // Build schedule for section 1 (default)
      const result: DayData[] = DAYS.map(day => ({
        day,
        entries: new Array(8).fill(null),
      }));

      // Parse all sections
      for (let i = 4; i < Math.min(rows.length, 20); i++) {
        const secNum = parseInt((rows[i][1] || "").trim());
        if (isNaN(secNum)) continue;

        const dataRow = rows[i];
        for (let d = 0; d < 6; d++) {
          const baseCol = 2 + d * 8;
          for (let p = 0; p < 8; p++) {
            const ci = baseCol + p;
            const raw = (dataRow[ci] || "").trim();
            if (!raw) continue;

            const entry = parseCell(raw);
            if (!entry.subject) continue;

            // For section 1, or if no section-specific data
            if (secNum === 1 && !result[d].entries[p]) {
              result[d].entries[p] = entry;
            }
          }
        }
      }

      setSchedule(result);
      setHasChanges(true);
      toast.success("تم الاستيراد بنجاح! يمكنك التعديل ثم النشر");
    } catch {
      setStatus("error");
      setErrorMsg("فشل الاتصال. تحقق من الإنترنت");
    }
    setImporting(false);
  };

  const startEdit = (dayIdx: number, periodIdx: number) => {
    const entry = schedule[dayIdx]?.entries[periodIdx];
    setEditing({ day: dayIdx, period: periodIdx });
    setEditForm(entry || { subject: "", instructor: "", room: "", entry_type: "lecture" });
  };

  const saveEdit = () => {
    if (!editing) return;
    const newSchedule = [...schedule];
    newSchedule[editing.day].entries[editing.period] = { ...editForm };
    setSchedule(newSchedule);
    setEditing(null);
    setHasChanges(true);
  };

  const clearEntry = (dayIdx: number, periodIdx: number) => {
    const newSchedule = [...schedule];
    newSchedule[dayIdx].entries[periodIdx] = null;
    setSchedule(newSchedule);
    setHasChanges(true);
  };

  const handlePublish = () => {
    setPublishing(true);
    publish(schedule);
    setHasChanges(false);
    setTimeout(() => {
      setPublishing(false);
      toast.success("تم نشر الجدول! يظهر الآن للطلاب");
    }, 500);
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
        {/* Import section */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={sheetUrl}
              onChange={(e) => { setSheetUrl(e.target.value); setStatus("idle"); }}
              placeholder="الصق رابط Google Sheet هنا..."
              dir="ltr"
              className="flex-1"
            />
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

        {/* Schedule grid */}
        {schedule.length > 0 && (
          <div className="space-y-4">
            {/* Edit modal */}
            {editing && (
              <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-bold text-primary">
                  تعديل: {DAYS[editing.day]} - الفترة {PERIODS[editing.period]?.label}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">المادة</Label>
                    <Input value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">المحاضر</Label>
                    <Input value={editForm.instructor} onChange={(e) => setEditForm({ ...editForm, instructor: e.target.value })} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">القاعة</Label>
                    <Input value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} className="h-9 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveEdit} size="sm" className="gap-1"><Save className="h-3.5 w-3.5" />حفظ</Button>
                  <Button onClick={() => setEditing(null)} size="sm" variant="outline">إلغاء</Button>
                </div>
              </div>
            )}

            {/* Table */}
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
                        const entry = schedule[di]?.entries[pi];
                        const isEditing = editing?.day === di && editing?.period === pi;
                        return (
                          <td key={di} className={`p-1.5 ${isEditing ? "bg-primary/10" : ""}`}>
                            {entry ? (
                              <div
                                className="group relative rounded-lg border border-border/50 p-2 cursor-pointer hover:border-primary/50 transition-colors bg-card"
                                onClick={() => startEdit(di, pi)}
                              >
                                <div className="font-bold text-xs text-foreground leading-tight">{entry.subject}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">{entry.instructor}</div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[10px] text-primary">{entry.room}</span>
                                  {entry.entry_type === "section" && (
                                    <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1 rounded">سكشن</span>
                                  )}
                                </div>
                                <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                                  <button onClick={(e) => { e.stopPropagation(); startEdit(di, pi); }}
                                    className="p-0.5 rounded bg-primary/10 hover:bg-primary/20">
                                    <Pencil className="h-2.5 w-2.5 text-primary" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); clearEntry(di, pi); }}
                                    className="p-0.5 rounded bg-destructive/10 hover:bg-destructive/20">
                                    <Trash2 className="h-2.5 w-2.5 text-destructive" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="rounded-lg border border-dashed border-border/30 p-3 text-center cursor-pointer hover:border-primary/30 transition-colors"
                                onClick={() => startEdit(di, pi)}
                              >
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

            {/* Publish button */}
            <div className="flex items-center gap-3">
              <Button onClick={handlePublish} disabled={publishing} className="gap-2" size="lg">
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                {publishing ? "جاري النشر..." : "نشر الجدول"}
              </Button>
              {hasChanges && (
                <span className="text-xs text-amber-500 font-medium">تغييرات غير منشورة</span>
              )}
              {!hasChanges && schedule.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />منشور
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
