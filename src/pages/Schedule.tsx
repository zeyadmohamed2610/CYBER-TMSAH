import { useState, useRef, useCallback, useEffect } from "react";
import {
  MapPin, User, Calendar, GraduationCap, Sparkles, ChevronDown,
  Download, Loader2, LayoutGrid, List, Clock, Coffee, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import { supabase } from "@/lib/supabaseClient";

type UnifiedDay = {
  day: string;
  entries: { id: string; time_slot: string; subject: string; instructor: string; room: string; entry_type: string; period_label?: string; period: number }[];
  isHoliday?: boolean;
  isTraining?: boolean;
};

function normalizeDay(raw: string): string {
  return raw.replace("الإثنين", "الاثنين").replace("الأحد", "الاحد").replace("الأربعاء", "الاربعاء");
}

const DAYS_ORDER = ["الجمعة", "السبت", "الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس"];
const todayName = normalizeDay(new Date().toLocaleDateString("ar-EG", { weekday: "long" }));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const FRIDAY_PERIODS_TIME: Record<number, string> = {
  1: "09:00 - 10:00 ص",
  2: "10:00 - 11:00 ص",
  3: "11:00 - 12:00 م",
  4: "02:00 - 03:00 م",
  5: "03:00 - 04:00 م",
  6: "04:00 - 05:00 م",
  7: "05:00 - 06:00 م",
  8: "06:00 - 07:00 م",
  9: "07:00 - 08:00 م",
};

const STANDARD_PERIODS_TIME: Record<number, string> = {
  1: "09:00 - 10:00 ص",
  2: "10:00 - 11:00 ص",
  3: "11:00 - 12:00 م",
  4: "12:00 - 01:00 م",
  5: "01:00 - 02:00 م",
  6: "02:00 - 03:00 م",
  7: "03:00 - 04:00 م",
  8: "04:00 - 05:00 م",
  9: "05:00 - 06:00 م",
  10: "06:00 - 07:00 م",
  11: "07:00 - 08:00 م",
};

const PERIODS_LABEL = [
  "الفترة الأولى (1)", "الفترة الثانية (2)", "الفترة الثالثة (3)", "الفترة الرابعة (4)",
  "الفترة الخامسة (5)", "الفترة السادسة (6)", "الفترة السابعة (7)", "الفترة الثامنة (8)",
  "الفترة التاسعة (9)", "الفترة العاشرة (10)", "الفترة الحادية عشرة (11)"
];

function getTimeSlot(day: string, period: number): string {
  if (day === "الجمعة") {
    return FRIDAY_PERIODS_TIME[period] || `فترة ${period}`;
  }
  return STANDARD_PERIODS_TIME[period] || `فترة ${period}`;
}

const Schedule = () => {
  const [selectedSection, setSelectedSection] = useState("مجموعة 1");
  const [sections, setSections] = useState<string[]>(Array.from({ length: 15 }, (_, i) => `مجموعة ${i + 1}`));
  const [schedule, setSchedule] = useState<UnifiedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
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

        const baseData: UnifiedDay[] = DAYS_ORDER.map(day => {
          const flags = dayFlags[day] || { isHoliday: false, isTraining: false };
          const entries = (grouped[day] || []).sort((a, b) => a.period - b.period);
          const isOff = flags.isHoliday || (entries.length === 0 && (day === "السبت" || day === "الخميس"));
          return {
            day,
            entries: entries.map((e) => ({
              id: `${day}-${e.period}-${e.subject}`,
              time_slot: getTimeSlot(day, e.period),
              subject: e.subject,
              instructor: e.instructor,
              room: e.room,
              entry_type: e.entry_type,
              period_label: PERIODS_LABEL[e.period - 1] || `فترة ${e.period}`,
              period: e.period,
            })),
            isHoliday: isOff,
            isTraining: flags.isTraining,
          };
        });

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
  const totalItems = totalLectures + totalSections;

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
      const [{ default: html2canvas }, jspdfModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf/dist/jspdf.umd.min.js"),
      ]);
      const jsPDF = jspdfModule.jsPDF || jspdfModule.default || jspdfModule;
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
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border/50">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }} />
          <div className="absolute top-20 right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />

          <div className="section-container relative py-12 md:py-16">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-bold text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>تكنولوجيا الأمن السيبراني • الفرقة الثانية 2026/2027</span>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
                  الجدول الدراسي <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-400">الأسبوعي</span>
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  مواعيد وقاعات المحاضرات النظرية والسكاشن العملية لجميع الشعب من سكشن 1 إلى 15
                </p>

                <div className="flex flex-wrap gap-4 pt-2">
                  {[
                    { icon: Calendar, label: "أيام دراسية", value: "7 أيام" },
                    { icon: GraduationCap, label: "محاضرة", value: loading ? "..." : totalLectures },
                    { icon: Sparkles, label: "سكشن عملي", value: loading ? "..." : totalSections, isPurple: true },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3 bg-card/60 border border-border/50 px-3.5 py-2 rounded-xl backdrop-blur-sm">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <s.icon className={`h-4 w-4 ${s.isPurple ? "text-violet-400" : "text-primary"}`} />
                      </div>
                      <div>
                        <div className={`text-base font-bold ${s.isPurple ? "text-violet-400" : "text-primary"}`}>{s.value}</div>
                        <div className="text-[11px] text-muted-foreground">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-56">
                    <select
                      value={selectedSection}
                      onChange={e => setSelectedSection(e.target.value)}
                      className="appearance-none w-full rounded-xl border border-border/60 bg-card/90 backdrop-blur-md px-4 py-2.5 text-sm text-foreground font-bold outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer hover:border-primary/40 transition-all"
                    >
                      {sections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>

                  {/* View mode toggle */}
                  <div className="flex items-center bg-card/80 border border-border/60 rounded-xl p-1 shrink-0">
                    <button
                      onClick={() => setViewMode("cards")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === "cards"
                          ? "bg-primary text-primary-foreground shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="عرض البطاقات (مناسب للهواتف)"
                    >
                      <List className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">بطاقات</span>
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === "table"
                          ? "bg-primary text-primary-foreground shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="عرض الجدول الشبكي المجمع (مناسب للابتوب والكمبيوتر)"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">شبكي</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={isExporting || loading || totalItems === 0}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-all hover:bg-primary/20 disabled:opacity-50 h-9"
                  >
                    {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {isExporting ? exportProgress : "تصدير الجدول"}
                  </button>
                  {showExportMenu && !isExporting && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                      <div className="absolute top-full mt-2 left-0 right-0 z-50 rounded-xl border border-border bg-card shadow-2xl overflow-hidden" role="menu">
                        <button
                          onClick={exportAsImage}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-primary/10 transition-colors"
                        >
                          <span>🖼️</span>
                          <span className="font-bold">تحميل صور PNG</span>
                        </button>
                        <button
                          onClick={exportAsPDF}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-primary/10 transition-colors border-t border-border/50"
                        >
                          <span>📄</span>
                          <span className="font-bold">تحميل ملف PDF</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="section-container py-8 md:py-12" ref={scheduleRef}>
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden animate-pulse p-5">
                  <div className="h-5 bg-muted rounded w-32 mb-4" />
                  <div className="h-16 bg-muted/40 rounded-xl" />
                </div>
              ))}
            </div>
          ) : totalItems === 0 ? (
            /* Luxury Empty State */
            <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-card/90 via-card/50 to-background/90 p-8 sm:p-14 text-center backdrop-blur-xl shadow-2xl">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-primary/20 to-violet-500/20 flex items-center justify-center border border-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.25)]">
                <Calendar className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">الجدول الدراسي قيد التجهيز والتحديث</h3>
              <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base leading-relaxed">
                الجدول حالياً فارغ وجارٍ إضافة وتعديل بيانات المحاضرات والسكاشن لشعبة {selectedSection} من لوحة تحكم المسؤول.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30">
                  <Sparkles className="h-3.5 w-3.5" />
                  تحديثات فورية ومباشرة
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/30">
                  <Clock className="h-3.5 w-3.5" />
                  11 فترة مخصصة لجميع الشعب
                </span>
              </div>
            </div>
          ) : viewMode === "table" ? (
            /* Panoramic Grid Table (Desktop / Laptop View) */
            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-xl custom-scrollbar scroll-touch">
              <table className="w-full text-sm border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="p-3 text-right font-bold text-xs text-muted-foreground w-28">الفترة والتوقيت</th>
                    {DAYS_ORDER.map((day) => {
                      const isToday = day === todayName;
                      return (
                        <th key={day} className={`p-3 text-center font-bold text-xs border-r border-border/50 ${isToday ? "bg-primary/15 text-primary" : "text-foreground"}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{day}</span>
                            {isToday && <span className="w-2 h-2 rounded-full bg-primary animate-ping" />}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 11 }, (_, pi) => pi + 1).map((pNum) => (
                    <tr key={pNum} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="p-2.5 text-center bg-muted/30 border-l border-border/40">
                        <div className="text-[11px] font-bold text-primary">{PERIODS_LABEL[pNum - 1]}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">{STANDARD_PERIODS_TIME[pNum]}</div>
                      </td>
                      {DAYS_ORDER.map((day) => {
                        const dayObj = schedule.find(d => d.day === day);
                        const entry = dayObj?.entries.find(e => e.period === pNum);
                        const isOff = dayObj?.isHoliday;

                        if (isOff) {
                          if (pNum === 1) {
                            return (
                              <td key={day} rowSpan={11} className="p-3 text-center border-r border-border/30 bg-amber-500/5">
                                <div className="text-xs font-bold text-amber-500/80">إجازة رسمية</div>
                              </td>
                            );
                          }
                          return null;
                        }

                        if (!entry) {
                          return (
                            <td key={day} className="p-2 text-center border-r border-border/30 text-muted-foreground/30 text-xs">
                              —
                            </td>
                          );
                        }

                        const isSec = entry.entry_type === "section";
                        return (
                          <td key={day} className={`p-2 border-r border-border/40 align-top ${isSec ? "bg-violet-500/5" : "bg-primary/5"}`}>
                            <div className="rounded-lg p-2 border border-border/40 h-full flex flex-col justify-between gap-1 shadow-sm">
                              <div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isSec ? "bg-violet-500/20 text-violet-400" : "bg-primary/20 text-primary"}`}>
                                  {isSec ? "سكشن" : "محاضرة"}
                                </span>
                                <h4 className="font-bold text-xs text-foreground mt-1 leading-snug">{entry.subject}</h4>
                              </div>
                              <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1 border-t border-border/30 pt-1">
                                {entry.instructor && <div className="truncate"><User className="inline h-2.5 w-2.5 mr-1 text-primary/70" />{entry.instructor}</div>}
                                {entry.room && <div className="font-semibold text-foreground/80"><MapPin className="inline h-2.5 w-2.5 mr-1 text-primary/70" />{entry.room}</div>}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards View (Mobile & Tablet Friendly) */
            <div className="space-y-5">
              {schedule.map((day, di) => {
                const isToday = day.day === todayName;
                return (
                  <ScrollReveal key={di}>
                    <div
                      data-day={day.day}
                      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                        isToday
                          ? "bg-primary/5 border-primary/40 shadow-[0_0_25px_hsl(var(--primary)/0.12)]"
                          : "bg-card/50 border-border/50 hover:border-primary/30"
                      }`}
                    >
                      {isToday && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full animate-pulse">
                            اليوم
                          </span>
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
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
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
                            <p className="font-bold text-amber-500">إجازة رسمية</p>
                            <p className="text-xs text-muted-foreground mt-1">عطلة أسبوعية خالية من المحاضرات</p>
                          </div>
                        ) : day.isTraining ? (
                          <div className="text-center py-8 rounded-xl bg-violet-500/5 border border-dashed border-violet-500/20">
                            <GraduationCap className="h-8 w-8 mx-auto mb-2 text-violet-500/50" />
                            <p className="font-bold text-violet-400">يوم التدريب الميداني</p>
                          </div>
                        ) : day.entries.length === 0 ? (
                          <div className="text-center py-8 rounded-xl bg-muted/20 border border-dashed border-border/40">
                            <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-3">
                              <Coffee className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">لا توجد محاضرات مجدولة لهذا اليوم</p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {day.entries.map((entry, li) => {
                              const isSec = entry.entry_type === "section";
                              return (
                                <div
                                  key={entry.id || li}
                                  className={`flex items-center gap-3 md:gap-4 rounded-xl p-3 md:p-4 border-r-4 border border-l-0 transition-all hover:brightness-110 overflow-hidden ${
                                    isSec
                                      ? "bg-violet-500/5 border-r-violet-400 border-border/20"
                                      : "bg-secondary/20 border-r-primary/60 border-border/30"
                                  }`}
                                >
                                  <div className="text-center min-w-[70px] sm:min-w-[90px] shrink-0">
                                    <div className={`text-[10px] font-bold mb-0.5 ${isSec ? "text-violet-400" : "text-primary"}`}>
                                      {entry.period_label || `فترة ${entry.period}`}
                                    </div>
                                    <div className="text-xs sm:text-sm font-bold text-foreground" dir="ltr">
                                      {entry.time_slot}
                                    </div>
                                  </div>
                                  <div className="w-px h-10 bg-border/40 hidden sm:block" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className={`font-bold text-sm md:text-base leading-snug ${isSec ? "text-violet-400" : "text-foreground"}`}>
                                        {entry.subject}
                                      </h3>
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded shrink-0 ${isSec ? "bg-violet-500/15 text-violet-400" : "bg-primary/15 text-primary"}`}>
                                        {isSec ? "سكشن عملي" : "محاضرة نظرية"}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                      {entry.instructor && (
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3 text-primary/70" />
                                          {entry.instructor}
                                        </span>
                                      )}
                                      {entry.room && (
                                        <span className="flex items-center gap-1 font-semibold text-foreground/80">
                                          <MapPin className="h-3 w-3 text-primary/70" />
                                          {entry.room}
                                        </span>
                                      )}
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
