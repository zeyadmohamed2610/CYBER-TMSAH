import { useState, useCallback } from "react";
import { Pencil, Save, Globe, CheckCircle2, Trash2, ClipboardPaste, ChevronDown } from "lucide-react";
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
  { time: "12:15 PM - 1:15 PM", label: "الرابعة" },
  { time: "1:20 PM - 2:20 PM", label: "الخامسة" },
  { time: "2:25 PM - 3:25 PM", label: "السادسة" },
  { time: "3:30 PM - 4:30 PM", label: "السابعة" },
  { time: "4:35 PM - 5:35 PM", label: "الثامنة" },
];

const SUBJECT_MAP: Record<string, string> = {
  "os": "نظم تشغيل", "cybersecurity": "مبادئ الأمن السيبراني",
  "negotiation": "مهارات التفاوض", "net": "شبكات وتراسل البيانات",
  "networking": "شبكات وتراسل البيانات", "engineering drawing": "رسم هندسي واسقاط",
  "technology": "مبادئ تكنولوجيا", "english": "لغة انجليزية",
  "رسم هندسي": "رسم هندسي واسقاط",
};

function mapSubject(raw: string): string {
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(SUBJECT_MAP)) {
    if (lower.includes(k)) return v;
  }
  return raw;
}

const PUBLISH_KEY = "cyber_published_schedule";

function loadPublished(): AllSections {
  try { const r = localStorage.getItem(PUBLISH_KEY); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}

function savePublished(data: AllSections): void {
  localStorage.setItem(PUBLISH_KEY, JSON.stringify(data));
}

function makeEmptySection(): DayData[] {
  return [...DAYS.map(d => ({ day: d, entries: new Array(8).fill(null) })), { day: "الجمعة", entries: [] }];
}

function parseCellText(raw: string): Entry {
  const text = raw.replace(/\r\n/g, "\n").replace(/<br\s*\/?>/gi, "\n").trim();
  if (!text) return { subject: "", instructor: "", room: "", entry_type: "lecture" };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  if (lines.length === 1 && lines[0].includes(" - ")) {
    const parts = lines[0].split(" - ").map(p => p.trim());
    return {
      subject: mapSubject(parts[0]),
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

export function QuickScheduleEditor() {
  const [allSections, setAllSections] = useState<AllSections>(loadPublished);
  const [selectedSection, setSelectedSection] = useState(1);
  const [editing, setEditing] = useState<{ day: number; period: number } | null>(null);
  const [editForm, setEditForm] = useState<Entry>({ subject: "", instructor: "", room: "", entry_type: "lecture" });
  const [hasChanges, setHasChanges] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const sectionNumbers = Object.keys(allSections).length > 0
    ? Object.keys(allSections).map(Number).sort((a, b) => a - b)
    : Array.from({ length: 15 }, (_, i) => i + 1);

  const currentSchedule = allSections[selectedSection] || makeEmptySection();

  // Parse pasted data from Excel/Sheets
  // Format: each row = one section, columns = 48 periods (6 days × 8)
  // Tab-separated columns, newline-separated rows
  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) return;

    const rows = pasteText.trim().split("\n");
    const imported: AllSections = { ...allSections };

    rows.forEach((row, rowIdx) => {
      const cells = row.split("\t");
      const secNum = rowIdx + 1;
      if (secNum > 15) return;

      const sectionData = makeEmptySection();

      for (let d = 0; d < 6; d++) {
        for (let p = 0; p < 8; p++) {
          const cellIdx = d * 8 + p;
          const raw = (cells[cellIdx] || "").trim();
          if (!raw) continue;

          const entry = parseCellText(raw);
          if (entry.subject) sectionData[d].entries[p] = entry;
        }
      }

      imported[secNum] = sectionData;
    });

    setAllSections(imported);
    setHasChanges(true);
    setShowPaste(false);
    setPasteText("");
    toast.success(`تم استيراد ${rows.length} سكشن`);
  }, [pasteText, allSections]);

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
    setTimeout(() => { setPublishing(false); toast.success("تم نشر الجدول!"); }, 300);
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" />
            إدارة الجدول الدراسي
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPaste(!showPaste)} className="gap-1">
              <ClipboardPaste className="h-3.5 w-3.5" />لصق من Excel
            </Button>
            {hasChanges && <span className="text-xs text-amber-500 font-medium">تغييرات غير منشورة</span>}
            {!hasChanges && Object.keys(allSections).length > 0 && (
              <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle2 className="h-3.5 w-3.5" />منشور</span>
            )}
            <Button onClick={handlePublish} disabled={publishing} size="sm" className="gap-1">
              <Globe className="h-3.5 w-3.5" />نشر
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Paste area */}
        {showPaste && (
          <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-bold text-primary">الصق البيانات من Google Sheets أو Excel</p>
            <p className="text-xs text-muted-foreground">
              كل صف = سكشن (1-15). الأعمدة = 48 خلية (6 أيام × 8 فترات). استخدم Tab للفصل بين الخلايا.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`مثال (Tab-separated):\nOS - ENG hamdy - AI LAB\t\t\t\nNet - ENG Walaa - AI LAB\t\t\t`}
              className="w-full h-32 rounded-lg border border-border bg-card p-3 text-xs font-mono text-foreground resize-y"
              dir="ltr"
            />
            <div className="flex gap-2">
              <Button onClick={handlePaste} size="sm">استيراد</Button>
              <Button onClick={() => { setShowPaste(false); setPasteText(""); }} size="sm" variant="outline">إلغاء</Button>
            </div>
          </div>
        )}

        {/* Section selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">السكشن:</span>
          <div className="relative">
            <select value={selectedSection} onChange={e => { setSelectedSection(Number(e.target.value)); setEditing(null); }}
              className="appearance-none rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer pr-8">
              {sectionNumbers.map(n => <option key={n} value={n}>سكشن {n}</option>)}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

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
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-2 text-right font-bold text-xs text-muted-foreground border-b border-border min-w-[90px]">الفترة</th>
                {DAYS.map(d => (
                  <th key={d} className="p-2 text-center font-bold text-xs text-foreground border-b border-border min-w-[130px]">{d}</th>
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
      </CardContent>
    </Card>
  );
}
