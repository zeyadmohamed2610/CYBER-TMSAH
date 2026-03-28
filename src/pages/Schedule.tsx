import { useState, useRef, useCallback, useEffect } from "react";
import { Clock, MapPin, User, Calendar, GraduationCap, Sparkles, ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import { scheduleService, type DaySchedule } from "@/features/attendance/services/scheduleService";
import { googleSheetsService } from "@/features/attendance/services/googleSheetsService";

const dayIcons: Record<string, string> = {
  "السبت": "☀️", "الأحد": "🌅", "الاثنين": "💪", "الثلاثاء": "📖",
  "الأربعاء": "📚", "الخميس": "🎯", "الجمعة": "🎉",
};

const todayName = new Date().toLocaleDateString("ar-EG", { weekday: "long" });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const Schedule = () => {
  const [selectedSection, setSelectedSection] = useState("سكشن 1");
  const [sections, setSections] = useState<string[]>(["سكشن 1"]);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadSections = async () => {
      if (googleSheetsService.getSheetUrl()) {
        const secs = await googleSheetsService.fetchAllSections();
        if (secs.length > 0) { setSections(secs); return; }
      }
      const secs = await scheduleService.fetchSections();
      if (secs.length > 0) setSections(secs);
    };
    loadSections();
  }, []);

  useEffect(() => {
    setLoading(true);
    const sectionNum = parseInt(selectedSection.replace(/\D/g, "")) || 1;
    const load = async () => {
      if (googleSheetsService.getSheetUrl()) {
        const { data, error } = await googleSheetsService.fetchScheduleForSection(sectionNum);
        if (!error && data.length > 0) { setSchedule(data); setLoading(false); return; }
      }
      const { data, error } = await scheduleService.fetchSchedule(sectionNum);
      if (error) toast.error("فشل تحميل الجدول.");
      setSchedule(data ?? []);
      setLoading(false);
    };
    load();
  }, [selectedSection]);

  const totalLectures = schedule.reduce((a, d) => a + d.entries.filter(e => e.entry_type === "lecture").length, 0);
  const totalSections = schedule.reduce((a, d) => a + d.entries.filter(e => e.entry_type === "section").length, 0);

  const captureDay = async (el: HTMLElement) => {
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
      toast.success(`تم تحميل ${dayEls.length} صورة بنجاح`);
    } catch {
      toast.error("فشل تحميل الصور");
    } finally {
      setIsExporting(false);
      setExportProgress("");
    }
  }, [selectedSection]);

  const exportAsPDF = useCallback(async () => {
    if (!scheduleRef.current) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const dayEls = scheduleRef.current.querySelectorAll<HTMLElement>("[data-day]");
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < dayEls.length; i++) {
        const el = dayEls[i];
        const dayName = el.dataset.day || `يوم-${i + 1}`;
        setExportProgress(`جاري تصدير ${dayName}...`);

        const canvas = await captureDay(el);
        const imgData = canvas.toDataURL("image/png");
        const ratio = canvas.width / canvas.height;

        if (i > 0) pdf.addPage();
        pdf.setFillColor(10, 10, 15);
        pdf.rect(0, 0, pw, ph, "F");

        let w = pw - 16;
        let h = w / ratio;
        if (h > ph - 16) { h = ph - 16; w = h * ratio; }

        pdf.addImage(imgData, "PNG", (pw - w) / 2, (ph - h) / 2, w, h);
      }
      pdf.save(`جدول-${selectedSection}.pdf`);
      toast.success(`تم تحميل PDF بـ ${dayEls.length} صفحات`);
    } catch {
      toast.error("فشل تحميل PDF");
    } finally {
      setIsExporting(false);
      setExportProgress("");
    }
  }, [selectedSection]);

  const periodLabel = (i: number) => {
    const l = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"];
    return l[i] || `${i + 1}`;
  };

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
                <p className="text-sm text-muted-foreground/70">⏰ كل محاضرة ساعة + 5 دقائق راحة بين الفترات</p>
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
                  <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={isExporting || loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary/20 disabled:opacity-50">
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isExporting ? exportProgress || "جاري التصدير..." : "تحميل الجدول"}
                  </button>
                  {showExportMenu && !isExporting && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                      <div className="absolute bottom-full mb-2 left-0 right-0 z-50 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                        <button onClick={exportAsImage}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors">
                          <span className="text-lg">🖼️</span>
                          <div className="text-right">
                            <span className="block font-bold">صور PNG</span>
                            <span className="block text-[10px] text-muted-foreground">صورة لكل يوم على حدة</span>
                          </div>
                        </button>
                        <button onClick={exportAsPDF}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors border-t border-border/50">
                          <span className="text-lg">📄</span>
                          <div className="text-right">
                            <span className="block font-bold">ملف PDF</span>
                            <span className="block text-[10px] text-muted-foreground">صفحة لكل يوم على حدة</span>
                          </div>
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
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>جاري تحميل الجدول...</span>
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
                        <span className="text-2xl">{dayIcons[day.day] ?? "📅"}</span>
                        <div className="flex-1">
                          <h2 className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{day.day}</h2>
                          {!day.isHoliday && !day.isTraining && day.entries.length > 0 && (
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
                          <div className="text-center py-8 rounded-xl bg-primary/5 border border-dashed border-primary/20">
                            <span className="text-3xl block mb-2">🎉</span>
                            <p className="font-bold text-primary">إجازة</p>
                            <p className="text-xs text-muted-foreground mt-1">استمتع بيومك!</p>
                          </div>
                        ) : day.isTraining ? (
                          <div className="text-center py-8 rounded-xl bg-amber-500/5 border border-dashed border-amber-500/20">
                            <span className="text-3xl block mb-2">🏋️</span>
                            <p className="font-bold text-amber-500">يوم التدريب</p>
                            <p className="text-xs text-muted-foreground mt-1">قريباً سيتم تزويد التفاصيل</p>
                          </div>
                        ) : day.entries.length === 0 ? (
                          <div className="text-center py-8 rounded-xl bg-muted/30 border border-dashed border-border/50">
                            <p className="text-sm text-muted-foreground">لا توجد محاضرات</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {day.entries.map((entry, li) => {
                              const isSec = entry.entry_type === "section";
                              return (
                                <div key={entry.id || li} className={`flex items-center gap-3 md:gap-4 rounded-xl p-3 md:p-4 border transition-all hover:border-primary/30 ${
                                  isSec ? "bg-cyan-500/5 border-cyan-500/20" : "bg-secondary/20 border-border/40"
                                }`}>
                                  <div className="text-center min-w-[80px]">
                                    <div className={`text-[10px] font-bold mb-0.5 ${isSec ? "text-cyan-400" : "text-primary"}`}>
                                      الفترة {periodLabel(li)}
                                    </div>
                                    <div className="text-xs font-bold text-foreground" dir="ltr">{entry.time_slot}</div>
                                  </div>
                                  <div className="w-px h-10 bg-border/40 hidden sm:block" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h3 className={`font-bold text-sm md:text-base leading-snug ${isSec ? "text-cyan-400" : "text-foreground"}`}>{entry.subject}</h3>
                                      {isSec && <span className="text-[9px] font-bold bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded shrink-0">سكشن</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" />{entry.instructor}</span>
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{entry.room}</span>
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
