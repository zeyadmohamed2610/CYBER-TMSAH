import { useState, useRef, useCallback, useEffect } from "react";
import { Clock, MapPin, User, Calendar, GraduationCap, Sparkles, ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import { supabase } from "@/lib/supabaseClient";

type UnifiedDay = {
  day: string;
  entries: { id: string; time_slot: string; subject: string; instructor: string; room: string; entry_type: string; period_label?: string }[];
  isHoliday?: boolean;
  isTraining?: boolean;
};

function normalizeDay(raw: string): string {
  return raw.replace("الإثنين", "الاثنين").replace("الأحد", "الاحد").replace("الأربعاء", "الاربعاء");
}

const DAYS_ORDER = ["السبت", "الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس", "الجمعة"];
const todayName = normalizeDay(new Date().toLocaleDateString("ar-EG", { weekday: "long" }));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const PERIODS_TIME = [
  "9:00 AM - 10:00 AM", "10:05 AM - 11:05 AM", "11:10 AM - 12:10 PM", "12:15 PM - 1:15 PM",
  "1:20 PM - 2:20 PM", "2:25 PM - 3:25 PM", "3:30 PM - 4:30 PM", "4:35 PM - 5:35 PM",
];
const PERIODS_LABEL = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"];

const Schedule = () => {
  const [selectedSection, setSelectedSection] = useState("مجموعة 1");
  const [sections, setSections] = useState<string[]>(Array.from({ length: 15 }, (_, i) => `مجموعة ${i + 1}`));
  const [schedule, setSchedule] = useState<UnifiedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("published_schedule").select("section").then(({ data }) => {
      if (data && data.length > 0) {
        const secs = [...new Set(data.map(r => r.section))].sort((a, b) => a - b);
        setSections(secs.map(n => `مجموعة ${n}`));
      }
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const sectionNum = parseInt(selectedSection.replace(/\D/g, "")) || 1;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("published_schedule")
          .select("section, day, period, subject, instructor, room, entry_type, is_holiday, is_training")
          .eq("section", sectionNum);

        if (error || !data || data.length === 0) {
          setSchedule([]);
          setLoading(false);
          return;
        }

        const grouped: Record<string, { subject: string; instructor: string; room: string; entry_type: string; period: number }[]> = {};
        const dayFlags: Record<string, { isHoliday: boolean; isTraining: boolean }> = {};

        for (const row of data) {
          if (row.is_holiday) { dayFlags[row.day] = { isHoliday: true, isTraining: false }; continue; }
          if (row.is_training) { dayFlags[row.day] = { isHoliday: false, isTraining: true }; continue; }
          if (!row.subject || row.subject.trim() === "") continue;
          if (!grouped[row.day]) grouped[row.day] = [];
          grouped[row.day].push({ subject: row.subject, instructor: row.instructor, room: row.room, entry_type: row.entry_type, period: row.period });
        }

        const baseData: UnifiedDay[] = DAYS_ORDER.filter(d => d !== "الجمعة").map(day => {
          const flags = dayFlags[day] || { isHoliday: false, isTraining: false };
          const entries = (grouped[day] || []).sort((a, b) => a.period - b.period);
          return {
            day,
            entries: entries.map((e) => ({
              id: `${day}-${e.period}-${e.subject}`,
              time_slot: PERIODS_TIME[e.period - 1] || "",
              subject: e.subject,
              instructor: e.instructor,
              room: e.room,
              entry_type: e.entry_type,
              period_label: PERIODS_LABEL[e.period - 1] || "",
            })),
            isHoliday: flags.isHoliday,
            isTraining: flags.isTraining,
          };
        });

        baseData.push({ day: "الجمعة", entries: [], isHoliday: true });
        setSchedule(baseData);
      } catch {
        setSchedule([]);
      }
      setLoading(false);
    };

    load();
  }, [selectedSection]);

  const totalLectures = schedule.reduce((a, d) => a + d.entries.filter(e => e.entry_type === "lecture").length, 0);
  const totalSections = schedule.reduce((a, d) => a + d.entries.filter(e => e.entry_type === "section").length, 0);

  const captureDay = async (el: HTMLElement) => {
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(el, { backgroundColor: "#0a0a0f", scale: 2, useCORS: true, logging: false });
  };

  const exportAsImage = useCallback(async () => {
    if (!scheduleRef.current) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const dayEls = scheduleRef.current.querySelectorAll<HTMLElement>("[data-day]");
      for (let i = 0; i < dayEls.length; i++) {
        const el = dayEls[i];
        const dayName = el.dataset.day || `يوم-${i + 1}`;
        setExportProgress(`جاري تصدير ${dayName}...`);
        const canvas = await captureDay(el);
        const link = document.createElement("a");
        link.download = `جدول-${dayName}-${selectedSection}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        if (i < dayEls.length - 1) await sleep(500);
      }
      toast.success(`تم تحميل ${dayEls.length} صورة`);
    } catch { toast.error("فشل التصدير"); }
    finally { setIsExporting(false); setExportProgress(""); }
  }, [selectedSection]);

  const exportAsPDF = useCallback(async () => {
    if (!scheduleRef.current) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const dayEls = scheduleRef.current.querySelectorAll<HTMLElement>("[data-day]");
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < dayEls.length; i++) {
        const el = dayEls[i];
        const dayName = el.dataset.day || `يوم-${i + 1}`;
        setExportProgress(`جاري تصدير ${dayName}...`);
        const canvas = await html2canvas(el, { backgroundColor: "#0a0a0f", scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL("image/png");
        const ratio = canvas.width / canvas.height;
        if (i > 0) pdf.addPage();
        pdf.setFillColor(10, 10, 15);
        pdf.rect(0, 0, pw, ph, "F");
        let w = pw - 16, h = w / ratio;
        if (h > ph - 16) { h = ph - 16; w = h * ratio; }
        pdf.addImage(imgData, "PNG", (pw - w) / 2, (ph - h) / 2, w, h);
      }
      pdf.save(`جدول-${selectedSection}.pdf`);
      toast.success(`تم تحميل PDF`);
    } catch { toast.error("فشل التصدير"); }
    finally { setIsExporting(false); setExportProgress(""); }
  }, [selectedSection]);

  return (
    <>
      <SEO title="الجدول الدراسي" description="جدول محاضرات الأمن السيبراني الأسبوعي." url="https://www.cyber-tmsah.site/schedule" />
      <Layout>
        <section className="relative overflow-hidden border-b border-border/50">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }} />
          <div className="absolute top-20 right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />

          <div className="section-container relative py-14">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-black text-foreground">
                  الجدول الدراسي<span className="block text-primary mt-1">الأسبوعي</span>
                </h1>
                <p className="text-lg text-muted-foreground">جميع محاضرات الأسبوع من السبت إلى الجمعة</p>
                <p className="text-sm text-muted-foreground/70">⏰ كل محاضرة ساعة + 5 دقائق راحة</p>
                <div className="flex flex-wrap gap-5 pt-1">
                  {[
                    { icon: Calendar, label: "أيام", value: 7 },
                    { icon: GraduationCap, label: "محاضرة", value: loading ? "..." : totalLectures },
                    { icon: Sparkles, label: "سكشن", value: loading ? "..." : totalSections, cyan: true },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                        <s.icon className={`h-5 w-5 ${s.cyan ? "text-cyan-400" : "text-primary"}`} />
                      </div>
                      <div>
                        <div className={`text-xl font-bold ${s.cyan ? "text-cyan-400" : "text-primary"}`}>{s.value}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-muted-foreground">اختر الشعبة</label>
                <div className="relative">
                  <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
                    className="appearance-none w-full md:w-56 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-5 py-3.5 text-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all cursor-pointer hover:border-primary/30">
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                </div>

                <div className="relative">
                  <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={isExporting || loading || schedule.length === 0}
                    aria-label="تحميل الجدول"
                    aria-expanded={showExportMenu}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary/20 disabled:opacity-50">
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isExporting ? exportProgress : "تحميل الجدول"}
                  </button>
                  {showExportMenu && !isExporting && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                      <div className="absolute top-full mt-2 sm:top-auto sm:bottom-full sm:mt-0 sm:mb-2 left-0 right-0 z-50 rounded-xl border border-border bg-card shadow-xl overflow-hidden" role="menu">
                        <button onClick={exportAsImage} role="menuitem"
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
                          <span className="text-lg">🖼️</span>
                          <div className="text-right"><span className="block font-bold">صور PNG</span><span className="block text-[10px] text-muted-foreground">صورة لكل يوم</span></div>
                        </button>
                        <button onClick={exportAsPDF} role="menuitem"
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors border-t border-border/50">
                          <span className="text-lg">📄</span>
                          <div className="text-right"><span className="block font-bold">ملف PDF</span><span className="block text-[10px] text-muted-foreground">صفحة لكل يوم</span></div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-container py-10 md:py-14" ref={scheduleRef}>
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden animate-pulse">
                  <div className="flex items-center gap-3 p-4 md:p-5 border-b border-border/30">
                    <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-24" />
                      <div className="h-3 bg-muted/60 rounded w-16" />
                    </div>
                  </div>
                  <div className="p-4 md:p-5 space-y-2">
                    {[0, 1].map((j) => (
                      <div key={j} className="flex items-center gap-3 rounded-xl p-3 bg-secondary/20 border border-border/40">
                        <div className="w-16 sm:w-20 h-8 bg-muted rounded shrink-0" />
                        <div className="hidden sm:block w-px h-10 bg-border/40" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-2/3" />
                          <div className="h-3 bg-muted/60 rounded w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : schedule.length === 0 ? (
            <div className="text-center py-20">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg text-muted-foreground">لا يوجد جدول منشور حالياً</p>
              <p className="text-sm text-muted-foreground mt-2">المدير يحتاج لنشر الجدول أولاً من لوحة التحكم</p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedule.map((day, di) => {
                const isToday = day.day === todayName;
                return (
                  <ScrollReveal key={di}>
                    <div data-day={day.day} className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                      isToday ? "bg-primary/5 border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
                        : "bg-card/50 border-border/50 hover:border-primary/30"
                    }`}>
                      {isToday && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full animate-pulse">اليوم</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 p-4 md:p-5 border-b border-border/30">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isToday ? "bg-primary/20" : "bg-primary/10"}`}>
                          <Calendar className={`h-5 w-5 ${isToday ? "text-primary" : "text-primary/70"}`} />
                        </div>
                        <div className="flex-1">
                          <h2 className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{day.day}</h2>
                          {!day.isHoliday && day.entries.length > 0 && (
                            <div className="flex items-center gap-2 mt-0.5">
                              {day.entries.filter(e => e.entry_type === "lecture").length > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {day.entries.filter(e => e.entry_type === "lecture").length} محاضرة
                                </span>
                              )}
                              {day.entries.some(e => e.entry_type === "section") && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">
                                  {day.entries.filter(e => e.entry_type === "section").length} سكشن
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-4 md:p-5">
                        {day.isHoliday ? (
                          <div className="text-center py-8 rounded-xl bg-amber-500/5 border border-dashed border-amber-500/20">
                            <Calendar className="h-8 w-8 mx-auto mb-2 text-amber-500/50" />
                            <p className="font-bold text-amber-500">اجازة</p>
                            <p className="text-xs text-muted-foreground mt-1">استمتع بيومك</p>
                          </div>
                        ) : day.isTraining ? (
                          <div className="text-center py-8 rounded-xl bg-cyan-500/5 border border-dashed border-cyan-500/20">
                            <GraduationCap className="h-8 w-8 mx-auto mb-2 text-cyan-500/50" />
                            <p className="font-bold text-cyan-500">يوم التدريب</p>
                          </div>
                        ) : day.entries.length === 0 ? (
                          <div className="text-center py-8 rounded-xl bg-muted/20 border border-dashed border-border/40">
                            <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-3">
                              <Calendar className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">لا توجد محاضرات</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">استمتع بيومك بعيداً عن الدراسة ☕</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {day.entries.map((entry, li) => {
                              const isSec = entry.entry_type === "section";
                              return (
                                <div key={entry.id || li} className={`flex items-center gap-3 md:gap-4 rounded-xl p-3 md:p-4 border-r-4 border border-l-0 transition-all hover:brightness-110 overflow-hidden ${
                                  isSec
                                    ? "bg-cyan-500/5 border-r-cyan-400 border-border/20"
                                    : "bg-secondary/20 border-r-primary/60 border-border/30"
                                }`}>
                                  <div className="text-center min-w-[60px] sm:min-w-[80px]">
                                    <div className={`text-[10px] font-bold mb-0.5 ${isSec ? "text-cyan-400" : "text-primary"}`}>
                                      الفترة {entry.period_label || PERIODS_LABEL[li] || ""}
                                    </div>
                                    <div className="text-xs sm:text-sm font-bold text-foreground" dir="ltr">{entry.time_slot}</div>
                                  </div>
                                  <div className="w-px h-10 bg-border/40 hidden sm:block" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h3 className={`font-bold text-sm md:text-base leading-snug ${isSec ? "text-cyan-400" : "text-foreground"}`}>{entry.subject}</h3>
                                      {isSec && <span className="text-[9px] font-bold bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded shrink-0">سكشن</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                      {entry.instructor && <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" />{entry.instructor}</span>}
                                      {entry.room && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{entry.room}</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          )}
        </section>
      </Layout>
    </>
  );
};

export default Schedule;
