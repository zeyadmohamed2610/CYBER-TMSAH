import { useState, useEffect } from "react";
import { Pencil, Save, Globe, CheckCircle2, Trash2, ChevronDown, Calendar, GraduationCap, Coffee, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

interface Entry { subject: string; instructor: string; room: string; entry_type: "lecture" | "section" }
interface DayData { day: string; entries: (Entry | null)[]; isHoliday?: boolean; isTraining?: boolean }
type AllSections = Record<number, DayData[]>;

const DAYS = ["السبت", "الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس"];
const PERIODS = [
  { time: "9:00 AM - 10:00 AM", label: "الاولى" },
  { time: "10:05 AM - 11:05 AM", label: "الثانية" },
  { time: "11:10 AM - 12:10 PM", label: "الثالثة" },
  { time: "12:15 PM - 1:15 PM", label: "الرابعة" },
  { time: "1:20 PM - 2:20 PM", label: "الخامسة" },
  { time: "2:25 PM - 3:25 PM", label: "السادسة" },
  { time: "3:30 PM - 4:30 PM", label: "السابعة" },
  { time: "4:35 PM - 5:35 PM", label: "الثامنة" },
];

function makeEmpty(): DayData[] {
  return [...DAYS.map(d => ({ day: d, entries: new Array(8).fill(null) })), { day: "الجمعة", isHoliday: true, entries: [] }];
}

function initAll(): AllSections {
  const r: AllSections = {};
  for (let i = 1; i <= 15; i++) r[i] = makeEmpty();
  return r;
}

export function QuickScheduleEditor() {
  const [allSections, setAllSections] = useState<AllSections>(initAll);
  const [selectedSection, setSelectedSection] = useState(1);
  const [editing, setEditing] = useState<{ day: number; period: number } | null>(null);
  const [editForm, setEditForm] = useState<Entry>({ subject: "", instructor: "", room: "", entry_type: "lecture" });
  const [hasChanges, setHasChanges] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);

  const current = allSections[selectedSection] || makeEmpty();

  useEffect(() => {
    supabase.from("published_schedule").select("*").then(({ data }) => {
      if (data && data.length > 0) {
        const init = initAll();
        for (const row of data) {
          const di = DAYS.indexOf(row.day);
          if (di === -1 || !init[row.section]) continue;
          init[row.section][di].entries[row.period - 1] = {
            subject: row.subject, instructor: row.instructor, room: row.room,
            entry_type: (row.entry_type as "lecture" | "section") || "lecture",
          };
        }
        setAllSections(init);
      }
      setLoading(false);
    });
  }, []);

  const update = (d: DayData[]) => { setAllSections(p => ({ ...p, [selectedSection]: d })); setHasChanges(true); };

  const toggleHoliday = (di: number) => {
    const n = current.map(d => ({ ...d, entries: [...d.entries] }));
    n[di].isHoliday = !n[di].isHoliday;
    if (n[di].isHoliday) { n[di].isTraining = false; n[di].entries = new Array(8).fill(null); }
    update(n);
  };

  const toggleTraining = (di: number) => {
    const n = current.map(d => ({ ...d, entries: [...d.entries] }));
    n[di].isTraining = !n[di].isTraining;
    if (n[di].isTraining) { n[di].isHoliday = false; n[di].entries = new Array(8).fill(null); }
    update(n);
  };

  const startEdit = (di: number, pi: number) => {
    if (current[di]?.isHoliday || current[di]?.isTraining) return;
    setEditing({ day: di, period: pi });
    setEditForm(current[di]?.entries[pi] || { subject: "", instructor: "", room: "", entry_type: "lecture" });
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editForm.subject.trim()) { clearEntry(editing.day, editing.period); setEditing(null); return; }
    const n = current.map(d => ({ ...d, entries: [...d.entries] }));
    n[editing.day].entries[editing.period] = { ...editForm };
    update(n);
    setEditing(null);
  };

  const clearEntry = (di: number, pi: number) => {
    const n = current.map(d => ({ ...d, entries: [...d.entries] }));
    n[di].entries[pi] = null;
    update(n);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const rows: { section: number; day: string; period: number; subject: string; instructor: string; room: string; entry_type: string }[] = [];
      for (const [sec, days] of Object.entries(allSections)) {
        for (let di = 0; di < DAYS.length; di++) {
          for (let pi = 0; pi < 8; pi++) {
            const e = days[di].entries[pi];
            if (e && e.subject) {
              rows.push({ section: Number(sec), day: DAYS[di], period: pi + 1, subject: e.subject, instructor: e.instructor, room: e.room, entry_type: e.entry_type });
            }
          }
        }
      }
      const { error } = await supabase.rpc("publish_all_schedule", { p_rows: rows });
      if (error) throw error;
      setHasChanges(false);
      toast.success("تم نشر الجدول للطلاب");
    } catch { toast.error("فشل النشر"); }
    setPublishing(false);
  };

  const stats = {
    lec: current.reduce((a, d) => a + d.entries.filter(e => e?.entry_type === "lecture").length, 0),
    sec: current.reduce((a, d) => a + d.entries.filter(e => e?.entry_type === "section").length, 0),
  };

  if (loading) {
    return (
      <Card dir="rtl">
        <CardContent className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span>جاري تحميل</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            ادارة الجدول الدراسي
          </CardTitle>
          <div className="flex items-center gap-3">
            {hasChanges && <span className="text-xs text-amber-500 font-medium">غير منشور</span>}
            {!hasChanges && <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle2 className="h-3.5 w-3.5" />منشور</span>}
            <Button onClick={handlePublish} disabled={publishing} className="gap-2">
              <Globe className="h-4 w-4" />{publishing ? "جاري النشر" : "نشر"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">السكشن:</span>
            <div className="relative">
              <select value={selectedSection} onChange={e => { setSelectedSection(Number(e.target.value)); setEditing(null); }}
                className="appearance-none rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground outline-none pr-8 cursor-pointer">
                {Array.from({ length: 15 }, (_, i) => i + 1).map(n => <option key={n} value={n}>سكشن {n}</option>)}
              </select>
              <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5 text-primary" />{stats.lec} محاضرة</span>
            <span className="flex items-center gap-1"><Coffee className="h-3.5 w-3.5 text-cyan-400" />{stats.sec} سكشن</span>
          </div>
        </div>

        {editing && (
          <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-bold text-primary">
              سكشن {selectedSection} - {DAYS[editing.day]} - الفترة {PERIODS[editing.period]?.label} ({PERIODS[editing.period]?.time})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">المادة</Label>
                <Input value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">المحاضر</Label>
                <Input value={editForm.instructor} onChange={e => setEditForm({ ...editForm, instructor: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">القاعة</Label>
                <Input value={editForm.room} onChange={e => setEditForm({ ...editForm, room: e.target.value })} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">النوع</Label>
              <Select value={editForm.entry_type} onValueChange={v => setEditForm({ ...editForm, entry_type: v as "lecture" | "section" })}>
                <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lecture">محاضرة</SelectItem>
                  <SelectItem value="section">سكشن عملي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveEdit} size="sm" className="gap-1"><Save className="h-3.5 w-3.5" />حفظ</Button>
              <Button onClick={() => setEditing(null)} size="sm" variant="outline">الغاء</Button>
              {editForm.subject && (
                <Button onClick={() => { clearEntry(editing.day, editing.period); setEditing(null); }} size="sm" variant="destructive" className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" />حذف
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-2 text-right font-bold text-xs text-muted-foreground border-b border-border min-w-[90px]">الفترة</th>
                {DAYS.map((day, di) => {
                  const dd = current[di];
                  const isHoliday = dd?.isHoliday;
                  const isTraining = dd?.isTraining;
                  return (
                    <th key={day} className={"p-2 text-center border-b border-border min-w-[130px] " + (isHoliday ? "bg-amber-500/10" : isTraining ? "bg-cyan-500/10" : "")}>
                      <div className="font-bold text-xs text-foreground">{day}</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <button onClick={() => toggleHoliday(di)}
                          className={"text-[9px] px-2 py-0.5 rounded-full border transition-colors " + (isHoliday ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold" : "border-border/50 text-muted-foreground hover:border-amber-500/30")}>
                          اجازة
                        </button>
                        <button onClick={() => toggleTraining(di)}
                          className={"text-[9px] px-2 py-0.5 rounded-full border transition-colors " + (isTraining ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400 font-bold" : "border-border/50 text-muted-foreground hover:border-cyan-500/30")}>
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
                    const dd = current[di];
                    const entry = dd?.entries[pi];
                    const isEdit = editing?.day === di && editing?.period === pi;
                    const disabled = dd?.isHoliday || dd?.isTraining;

                    if (disabled) {
                      return (
                        <td key={di} className="p-1.5">
                          <div className="rounded-lg border border-dashed border-border/20 p-3 text-center">
                            <span className="text-[10px] text-muted-foreground/50">{dd.isHoliday ? "اجازة" : "تدريب"}</span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={di} className={"p-1.5 " + (isEdit ? "bg-primary/10" : "")}>
                        {entry ? (
                          <div className="group relative rounded-lg border border-border/50 p-2 cursor-pointer hover:border-primary/50 transition-colors bg-card" onClick={() => startEdit(di, pi)}>
                            <div className="font-bold text-xs text-foreground leading-tight">{entry.subject}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{entry.instructor}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-primary">{entry.room}</span>
                              {entry.entry_type === "section" && <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1 rounded font-bold">سكشن</span>}
                            </div>
                            <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                              <button onClick={e => { e.stopPropagation(); startEdit(di, pi); }} className="p-0.5 rounded bg-primary/10 hover:bg-primary/20"><Pencil className="h-2.5 w-2.5 text-primary" /></button>
                              <button onClick={e => { e.stopPropagation(); clearEntry(di, pi); }} className="p-0.5 rounded bg-destructive/10 hover:bg-destructive/20"><Trash2 className="h-2.5 w-2.5 text-destructive" /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border/30 p-3 text-center cursor-pointer hover:border-primary/30 transition-colors" onClick={() => startEdit(di, pi)}>
                            <span className="text-[10px] text-muted-foreground">+ اضافة</span>
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
