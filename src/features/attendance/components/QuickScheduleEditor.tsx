import { useState, useEffect } from "react";
import { Pencil, Save, Globe, CheckCircle2, Trash2, ChevronDown, ChevronRight, ChevronLeft, Calendar, GraduationCap, Coffee, Loader2, FileText, Upload, Eye, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [mobileDay, setMobileDay] = useState(0);
  const [scheduleTab, setScheduleTab] = useState("schedule");
  
  // Exam state
  const [examFiles, setExamFiles] = useState<{id: string, title: string, type: string, url: string, section: number}[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewExam, setPreviewExam] = useState<{id: string, title: string, type: string, url: string} | null>(null);

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

    // Load exam files
    supabase.from("exam_schedules").select("*")
      .then(({ data, error }) => {
        if (error) {
          setExamFiles([]);
        } else if (data) {
          setExamFiles(data.map(f => ({
            id: f.id,
            title: f.title,
            type: f.exam_type,
            url: f.file_url,
            section: f.section
          })));
        }
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
      const rows: { section: number; day: string; period: number; subject: string; instructor: string; room: string; entry_type: string; is_holiday: boolean; is_training: boolean }[] = [];
      for (const [sec, days] of Object.entries(allSections)) {
        for (let di = 0; di < DAYS.length; di++) {
          const dayData = days[di];
          const isHoliday = dayData.isHoliday || false;
          const isTraining = dayData.isTraining || false;

          if (isHoliday || isTraining) {
            rows.push({ section: Number(sec), day: DAYS[di], period: 1, subject: "", instructor: "", room: "", entry_type: "lecture", is_holiday: isHoliday, is_training: isTraining });
          }

          for (let pi = 0; pi < 8; pi++) {
            const e = dayData.entries[pi];
            if (e && e.subject) {
              rows.push({ section: Number(sec), day: DAYS[di], period: pi + 1, subject: e.subject, instructor: e.instructor, room: e.room, entry_type: e.entry_type, is_holiday: false, is_training: false });
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

  const handleUploadExam = async (e: React.ChangeEvent<HTMLInputElement>, examType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      // Check if storage bucket exists, create if not
      const { data: bucketData } = await supabase.storage.getBucket("exam-files");
      if (!bucketData) {
        await supabase.storage.createBucket("exam-files", { public: true });
      }
      
      const fileName = `${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("exam-files")
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from("exam-files").getPublicUrl(fileName);
      
      const title = `${examType === "midterm" ? "ميدتيرم" : "فاينل"} - سكشن ${selectedSection} - ${new Date().toLocaleDateString("ar-EG")}`;
      
      const { error: dbError } = await supabase.from("exam_schedules").insert({
        title,
        exam_type: examType,
        file_url: publicUrl,
        section: selectedSection,
        file_name: file.name
      });
      
      if (dbError) {
        console.log("Table not found, storing locally");
        const newExam = {
          id: Date.now().toString(),
          title,
          type: examType,
          url: publicUrl,
          section: selectedSection
        };
        setExamFiles(prev => [newExam, ...prev]);
        toast.success("تم رفع الملف (محلي)");
      } else {
        toast.success("تم رفع جدول الامتحان بنجاح");
      }
      
      const { data: newFiles } = await supabase.from("exam_schedules").select("*");
      if (newFiles) {
        const sorted = (newFiles || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setExamFiles(sorted.map(f => ({
          id: f.id,
          title: f.title,
          type: f.exam_type,
          url: f.file_url,
          section: f.section
        })));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "فشل رفع الملف";
      console.error("Upload error:", err);
      toast.error(errorMessage);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleDeleteExam = async (id: string) => {
    try {
      const { error } = await supabase.from("exam_schedules").delete().eq("id", id);
      if (error) throw error;
      setExamFiles(prev => prev.filter(f => f.id !== id));
      toast.success("تم حذف جدول الامتحان");
    } catch {
      toast.error("فشل الحذف");
    }
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
            ادارة الجدول والامتحانات
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
        <Tabs value={scheduleTab} onValueChange={setScheduleTab} className="w-full">
          <div className="flex items-center justify-end mb-4">
            <TabsList className="gap-1 bg-muted/50 p-1">
              <TabsTrigger value="schedule" className="gap-1 px-4">
                <Calendar className="h-4 w-4" /> الجدول
              </TabsTrigger>
              <TabsTrigger value="exams" className="gap-1 px-4">
                <FileText className="h-4 w-4" /> الامتحانات
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="schedule" className="space-y-6 mt-0">
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
            <p className="text-sm font-bold text-primary truncate">
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
                <SelectTrigger className="h-9 w-full max-w-[160px] text-sm"><SelectValue /></SelectTrigger>
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
                    <th key={day} className={"hidden md:table-cell p-2 text-center border-b border-border min-w-[130px] " + (isHoliday ? "bg-amber-500/10" : isTraining ? "bg-cyan-500/10" : "")}>
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
                {/* Mobile: single day header */}
                <th className={"md:hidden p-2 text-center border-b border-border " + (current[mobileDay]?.isHoliday ? "bg-amber-500/10" : current[mobileDay]?.isTraining ? "bg-cyan-500/10" : "")}>
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setMobileDay(d => (d - 1 + DAYS.length) % DAYS.length)} className="p-1 rounded hover:bg-muted" aria-label="اليوم السابق">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div>
                      <div className="font-bold text-xs text-foreground">{DAYS[mobileDay]}</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <button onClick={() => toggleHoliday(mobileDay)}
                          className={"text-[9px] px-2 py-0.5 rounded-full border transition-colors " + (current[mobileDay]?.isHoliday ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold" : "border-border/50 text-muted-foreground")}>
                          اجازة
                        </button>
                        <button onClick={() => toggleTraining(mobileDay)}
                          className={"text-[9px] px-2 py-0.5 rounded-full border transition-colors " + (current[mobileDay]?.isTraining ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400 font-bold" : "border-border/50 text-muted-foreground")}>
                          تدريب
                        </button>
                      </div>
                    </div>
                    <button onClick={() => setMobileDay(d => (d + 1) % DAYS.length)} className="p-1 rounded hover:bg-muted" aria-label="اليوم التالي">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                </th>
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
                        <td key={di} className="hidden md:table-cell p-1.5">
                          <div className="rounded-lg border border-dashed border-border/20 p-3 text-center">
                            <span className="text-[10px] text-muted-foreground/50">{dd.isHoliday ? "اجازة" : "تدريب"}</span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={di} className={`hidden md:table-cell p-1.5 ${isEdit ? "bg-primary/10" : ""}`}>
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
                  {/* Mobile: single day cell */}
                  {(() => {
                    const di = mobileDay;
                    const dd = current[di];
                    const entry = dd?.entries[pi];
                    const isEdit = editing?.day === di && editing?.period === pi;
                    const disabled = dd?.isHoliday || dd?.isTraining;

                    if (disabled) {
                      return (
                        <td className="md:hidden p-1.5">
                          <div className="rounded-lg border border-dashed border-border/20 p-3 text-center">
                            <span className="text-[10px] text-muted-foreground/50">{dd.isHoliday ? "اجازة" : "تدريب"}</span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td className={`md:hidden p-1.5 ${isEdit ? "bg-primary/10" : ""}`}>
                        {entry ? (
                          <div className="group relative rounded-lg border border-border/50 p-3 cursor-pointer hover:border-primary/50 transition-colors bg-card" onClick={() => startEdit(di, pi)}>
                            <div className="font-bold text-sm text-foreground leading-tight">{entry.subject}</div>
                            <div className="text-xs text-muted-foreground mt-1">{entry.instructor}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-primary">{entry.room}</span>
                              {entry.entry_type === "section" && <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-bold">سكشن</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border/30 p-4 text-center cursor-pointer hover:border-primary/30 transition-colors" onClick={() => startEdit(di, pi)}>
                            <span className="text-xs text-muted-foreground">+ اضافة</span>
                          </div>
                        )}
                      </td>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </TabsContent>
          
          <TabsContent value="exams" className="space-y-6 mt-0">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-sm">جدول الميدتيرم</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">قم برفع جدول امتحانات الميدتيرم للسكشن المحدد</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-primary/90 transition-colors text-xs font-medium">
                    <Upload className="h-4 w-4" />
                    رفع الجدول
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => handleUploadExam(e, "midterm")} disabled={uploading} />
                  </label>
                </div>
              </div>
              
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-amber-500" />
                  <h3 className="font-bold text-sm">جدول الفاينل</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">قم برفع جدول امتحانات الفاينل للسكشن المحدد</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg cursor-pointer hover:bg-amber-600 transition-colors text-xs font-medium">
                    <Upload className="h-4 w-4" />
                    رفع الجدول
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => handleUploadExam(e, "final")} disabled={uploading} />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                الجداول المرفوعة ({examFiles.length})
              </h3>
              {examFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد جداول امتحانات مرفوعة بعد</p>
              ) : (
                <div className="space-y-2">
                  {examFiles.map((exam) => (
                    <div key={exam.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          exam.type === "midterm" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500"
                        }`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{exam.title}</p>
                          <p className="text-xs text-muted-foreground">سكشن {exam.section}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(exam.url, '_blank')}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteExam(exam.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
