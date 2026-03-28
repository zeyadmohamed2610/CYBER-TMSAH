import { useState, useRef, useCallback, useEffect } from "react";
import { Clock, MapPin, User, Calendar, GraduationCap, Sparkles, ChevronDown, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import { scheduleService, type DaySchedule } from "@/features/attendance/services/scheduleService";

const dayIcons: Record<string, string> = {
  "السبت": "☀️",
  "الأحد": "🌅",
  "الاثنين": "💪",
  "الثلاثاء": "📖",
  "الأربعاء": "📚",
  "الخمис": "🎯",
  "الجمعة": "🎉",
};

const todayName = new Date().toLocaleDateString("ar-EG", { weekday: "long" });

const Schedule = () => {
  const [selectedSection, setSelectedSection] = useState("سكشن 1");
  const [sections, setSections] = useState<string[]>(["سكشن 1"]);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scheduleService.fetchSections().then((secs) => {
      if (secs.length > 0) setSections(secs);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const sectionNum = parseInt(selectedSection.replace(/\D/g, "")) || 1;
    scheduleService.fetchSchedule(sectionNum).then(({ data, error }) => {
      if (error) toast.error("فشل تحميل الجدول.");
      setSchedule(data ?? []);
      setLoading(false);
    });
  }, [selectedSection]);

  const totalLectures = schedule.reduce(
    (acc, day) => acc + day.entries.filter((e) => e.entry_type === "lecture").length, 0,
  );
  const totalSections = schedule.reduce(
    (acc, day) => acc + day.entries.filter((e) => e.entry_type === "section").length, 0,
  );

  const handleDownloadImage = useCallback(async () => {
    if (!scheduleRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(scheduleRef.current, { backgroundColor: "#0a0a0f", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = `الجدول-${selectedSection}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch { toast.error("فشل تحميل الصورة."); }
    finally { setIsExporting(false); }
  }, [selectedSection]);

  const handleDownloadPDF = useCallback(async () => {
    if (!scheduleRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(scheduleRef.current, { backgroundColor: "#0a0a0f", scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`الجدول-${selectedSection}.pdf`);
    } catch { toast.error("فشل تحميل PDF."); }
    finally { setIsExporting(false); }
  }, [selectedSection]);

  const timePeriod = (i: number) => {
    const periods = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"];
    return periods[i] || `${i + 1}`;
  };

  return (
    <>
      <SEO title="الجدول الدراسي" description="جدول محاضرات الأمن السيبراني الأسبوعي." url="https://www.cyber-tmsah.site/schedule" />
      <Layout>
        {/* Header */}
        <section className="relative overflow-hidden border-b border-border/50">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }} />
          <div className="absolute top-20 right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />

          <div className="section-container relative py-14 md:py-18">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-black text-foreground">
                  الجدول الدراسي
                  <span className="block text-primary mt-2">الأسبوعي</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-md">
                  جميع محاضرات الأسبوع من السبت إلى الجمعة
                </p>
                <p className="text-sm text-muted-foreground/70">
                  ⏰ كل محاضرة ساعة واحدة + 10 دقائق راحة
                </p>
                <div className="flex flex-wrap gap-5 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-foreground">7</div>
                      <div className="text-xs text-muted-foreground">أيام</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-foreground">{loading ? "..." : totalLectures}</div>
                      <div className="text-xs text-muted-foreground">محاضرة</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-cyan-400">{loading ? "..." : totalSections}</div>
                      <div className="text-xs text-muted-foreground">سكشن</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-muted-foreground">اختر الشعبة</label>
                <div className="relative">
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="appearance-none w-full md:w-56 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-5 py-3.5 text-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all cursor-pointer hover:border-primary/30"
                  >
                    {sections.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDownloadImage} disabled={isExporting || loading}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary/20 disabled:opacity-50">
                    <ImageIcon className="h-4 w-4" />صورة
                  </button>
                  <button onClick={handleDownloadPDF} disabled={isExporting || loading}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary/20 disabled:opacity-50">
                    <FileText className="h-4 w-4" />PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section className="section-container py-10 md:py-14" ref={scheduleRef}>
          {loading ? (
            <div className="text-center py-20 text-muted-foreground">جاري تحميل الجدول...</div>
          ) : (
            <div className="space-y-4">
              {schedule.map((day, di) => {
                const isToday = day.day === todayName;
                return (
                  <ScrollReveal key={di}>
                    <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                      isToday
                        ? "bg-primary/5 border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
                        : "bg-card/50 border-border/50 hover:border-primary/30"
                    }`}>
                      {/* Today badge */}
                      {isToday && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full animate-pulse">
                            اليوم
                          </span>
                        </div>
                      )}

                      {/* Day header */}
                      <div className="flex items-center gap-3 p-4 md:p-5 border-b border-border/30">
                        <span className="text-2xl">{dayIcons[day.day] ?? "📅"}</span>
                        <div className="flex-1">
                          <h2 className={`text-lg font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{day.day}</h2>
                          {!day.isHoliday && !day.isTraining && day.entries.length > 0 && (
                            <div className="flex items-center gap-2 mt-0.5">
                              {day.entries.filter((e) => e.entry_type === "lecture").length > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {day.entries.filter((e) => e.entry_type === "lecture").length} محاضرة
                                </span>
                              )}
                              {day.entries.some((e) => e.entry_type === "section") && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">
                                  {day.entries.filter((e) => e.entry_type === "section").length} سكشن
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Day content */}
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
                                  {/* Period number + time */}
                                  <div className="text-center min-w-[70px]">
                                    <div className={`text-[10px] font-bold mb-0.5 ${isSec ? "text-cyan-400" : "text-primary"}`}>
                                      الفترة {timePeriod(li)}
                                    </div>
                                    <div className="text-sm font-bold text-foreground" dir="ltr">{entry.time_slot}</div>
                                  </div>

                                  <div className="w-px h-10 bg-border/40 hidden sm:block" />

                                  {/* Subject + details */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h3 className={`font-bold text-sm md:text-base truncate ${isSec ? "text-cyan-400" : "text-foreground"}`}>
                                        {entry.subject}
                                      </h3>
                                      {isSec && (
                                        <span className="text-[9px] font-bold bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded shrink-0">سكشن</span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" />{entry.instructor}
                                      </span>
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3" />{entry.room}
                                      </span>
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
