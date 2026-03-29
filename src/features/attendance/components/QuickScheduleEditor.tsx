import { useState } from "react";
import { Pencil, Save, Globe, CheckCircle2, Trash2, ChevronDown, Calendar, GraduationCap, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  isHoliday?: boolean;
  isTraining?: boolean;
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

const PUBLISH_KEY = "cyber_published_schedule";

function loadPublished(): AllSections {
  try { const r = localStorage.getItem(PUBLISH_KEY); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}

function savePublished(data: AllSections): void {
  localStorage.setItem(PUBLISH_KEY, JSON.stringify(data));
}

function makeEmptySection(): DayData[] {
  return [...DAYS.map(d => ({ day: d, entries: new Array(8).fill(null) })), { day: "الجمعة", isHoliday: true, entries: [] }];
}

export function QuickScheduleEditor() {
  const [allSections, setAllSections] = useState<AllSections>(() => {
    const saved = loadPublished();
    if (Object.keys(saved).length > 0) return saved;
    const init: AllSections = {};
    for (let i = 1; i <= 15; i++) init[i] = makeEmptySection();
    return init;
  });

  const [selectedSection, setSelectedSection] = useState(1);
  const [editing, setEditing] = useState<{ day: number; period: number } | null>(null);
  const [editForm, setEditForm] = useState<Entry>({ subject: "", instructor: "", room: "", entry_type: "lecture" });
  const [hasChanges, setHasChanges] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const sectionNumbers = Object.keys(allSections).map(Number).sort((a, b) => a - b);
  const currentSchedule = allSections[selectedSection] || makeEmptySection();

  const updateCurrentSchedule = (newDays: DayData[]) => {
    setAllSections(prev => ({ ...prev, [selectedSection]: newDays }));
    setHasChanges(true);
  };

  const toggleHoliday = (dayIdx: number) => {
    const newDays = [...currentSchedule.map(d => ({ ...d, entries: [...d.entries] }))];
    newDays[dayIdx].isHoliday = !newDays[dayIdx].isHoliday;
    if (newDays[dayIdx].isHoliday) {
      newDays[dayIdx].isTraining = false;
      newDays[dayIdx].entries = new Array(8).fill(null);
    }
    updateCurrentSchedule(newDays);
  };

  const toggleTraining = (dayIdx: number) => {
    const newDays = [...currentSchedule.map(d => ({ ...d, entries: [...d.entries] }))];
    newDays[dayIdx].isTraining = !newDays[dayIdx].isTraining;
    if (newDays[dayIdx].isTraining) {
      newDays[dayIdx].isHoliday = false;
      newDays[dayIdx].entries = new Array(8).fill(null);
    }
    updateCurrentSchedule(newDays);
  };

  const startEdit = (dayIdx: number, periodIdx: number) => {
    if (currentSchedule[dayIdx]?.isHoliday || currentSchedule[dayIdx]?.isTraining) return;
    const entry = currentSchedule[dayIdx]?.entries[periodIdx];
    setEditing({ day: dayIdx, period: periodIdx });
    setEditForm(entry || { subject: "", instructor: "", room: "", entry_type: "lecture" });
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editForm.subject.trim()) { clearEntry(editing.day, editing.period); setEditing(null); return; }
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

  const copyDayToAllSections = (dayIdx: number) => {
    const dayData = currentSchedule[dayIdx];
    const updated = { ...allSections };
    for (const sec of Object.keys(updated).map(Number)) {
      const newDays = [...updated[sec].map(d => ({ ...d, entries: [...d.entries] }))];
      newDays[dayIdx] = { ...dayData, entries: [...dayData.entries] };
      updated[sec] = newDays;
    }
    setAllSections(updated);
    setHasChanges(true);
    toast.success(`تم نسخ ${DAYS[dayIdx]} لكل السكاشن`);
  };

  const handlePublish = () => {
    setPublishing(true);
    savePublished(allSections);
    setHasChanges(false);
    setTimeout(() => { setPublishing(false); toast.success("تم نشر الجدول للطلاب!"); }, 300);
  };

  const stats = {
    lectures: currentSchedule.reduce((a, d) => a + d.entries.filter(e => e?.entry_type === "lecture").length, 0),
    sections: currentSchedule.reduce((a, d) => a + d.entries.filter(e => e?.entry_type === "section").length, 0),
    holidays: currentSchedule.filter(d => d.isHoliday).length,
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            إدارة الجدول الدراسي
          </CardTitle>
          <div className="flex items-center gap-3">
            {hasChanges && <span className="text-xs text-amber-500 font-medium">تغييرات غير منشورة</span>}
            {!hasChanges && Object.keys(allSections).length > 0 && (
              <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle2 className="h-3.5 w-3.5" />منشور</span>
            )}
            <Button onClick={handlePublish} disabled={publishing} className="gap-2">
              <Globe className="h-4 w-4" />{publishing ? "جاري النشر..." : "نشر الجدول"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section selector + stats */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">السكشن:</span>
            <div className="relative">
              <select value={selectedSection} onChange={e => { setSelectedSection(Number(e.target.value)); setEditing(null); }}
                className="appearance-none rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer pr-8">
                {sectionNumbers.map(n => <option key={n} value={n}>سكشن {n}</option>)}
              </select>
              <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5 text-primary" />{stats.lectures} محاضرة</span>
            <span className="flex items-center gap-1"><Coffee className="h-3.5 w-3.5 text-cyan-400" />{stats.sections} سكشن</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-amber-400" />{stats.holidays} إجازة</span>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-bold text-primary">
              سكشن {selectedSection} — {DAYS[editing.day]} — الفترة {PERIODS[editing.period]?.label} ({PERIODS[editing.period]?.time})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1 sm:col-span-2"><Label className="text-xs">المادة</Label>
                <Input value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} className="h-9 text-sm" placeholder="مثال: نظم تشغيل" /></div>
              <div className="space-y-1"><Label className="text-xs">المحاضر</Label>
                <Input value={editForm.instructor} onChange={(e) => setEditForm({ ...editForm, instructor: e.target.value })} className="h-9 text-sm" placeholder="د. أحمد" /></div>
              <div className="space-y-1"><Label className="text-xs">القاعة</Label>
                <Input value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} className="h-9 text-sm" placeholder="G201" /></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">النوع</Label>
              <Select value={editForm.entry_type} onValueChange={(v) => setEditForm({ ...editForm, entry_type: v as "lecture" | "section" })}>
                <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lecture">محاضرة</SelectItem>
                  <SelectItem value="section">سكشن (عملي)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveEdit} size="sm" className="gap-1"><Save className="h-3.5 w-3.5" />حفظ</Button>
              <Button onClick={() => setEditing(null)} size="sm" variant="outline">إلغاء</Button>
              {editForm.subject && (
                <Button onClick={() => { clearEntry(editing.day, editing.period); setEditing(null); }} size="sm" variant="destructive" className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" />حذف
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-2 text-right font-bold text-xs text-muted-foreground border-b border-border min-w-[90px]">الفترة</th>
                {DAYS.map((day, di) => {
                  const dayData = currentSchedule[di];
                  const isHoliday = dayData?.isHoliday;
                  const isTraining = dayData?.isTraining;
                  return (
                    <th key={day} className={`p-2 text-center border-b border-border min-w-[130px] ${isHoliday ? "bg-amber-500/10" : isTraining ? "bg-cyan-500/10" : ""}`}>
                      <div className="font-bold text-xs text-foreground">{day}</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <button onClick={() => toggleHoliday(di)}
                          className={"text-[9px] px-2 py-0.5 rounded-full border transition-colors " + (isHoliday ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold" : "border-border text-muted-foreground hover:border-amber-500/30")}>
                          اجازة
                        </button>
                        <button onClick={() => toggleTraining(di)}
                          className={"text-[9px] px-2 py-0.5 rounded-full border transition-colors " + (isTraining ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400 font-bold" : "border-border text-muted-foreground hover:border-cyan-500/30")}>
                          تدريب
                        </button>
                      </div>
                    </th>
                  );
                })}
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
                    const dayData = currentSchedule[di];
                    const entry = dayData?.entries[pi];
                    const isEditing = editing?.day === di && editing?.period === pi;
                    const isDisabled = dayData?.isHoliday || dayData?.isTraining;

                    if (isDisabled) {
                      return (
                        <td key={di} className="p-1.5">
                          <div className="rounded-lg border border-dashed border-border/20 p-3 text-center">
                            <span className="text-[10px] text-muted-foreground/50">
                              {dayData.isHoliday ? "إجازة" : "تدريب"}
                            </span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={di} className={"p-1.5" + (isEditing ? " bg-primary/10" : "")}>
                        {entry ? (
                          <div className="group relative rounded-lg border border-border/50 p-2 cursor-pointer hover:border-primary/50 transition-colors bg-card"
                            onClick={() => startEdit(di, pi)}>
                            <div className="font-bold text-xs text-foreground leading-tight">{entry.subject}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{entry.instructor}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-primary">{entry.room}</span>
                              {entry.entry_type === "section" && <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1 rounded font-bold">سكشن</span>}
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

        {/* Copy day helper */}
        <div className="text-xs text-muted-foreground text-center">
          نصيحة: اضغط على أزرار "إجازة" و "تدريب" في رأس كل يوم للتبديل
        </div>
      </CardContent>
    </Card>
  );
}
