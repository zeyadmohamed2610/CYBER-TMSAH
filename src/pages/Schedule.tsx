import { useState, useRef, useCallback, useMemo } from "react";
import { Clock, MapPin, User, Calendar, GraduationCap, Sparkles, ChevronDown, Download, Image, FileText, Moon } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import { sections, getSectionSchedule, timeSlots } from "@/data/mockData";

const Schedule = () => {
  const [selectedSection, setSelectedSection] = useState(sections[0]);
  const [isExporting, setIsExporting] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  // Get schedule for selected section and sort lectures by time
  const currentSchedule = useMemo(() => {
    const schedule = getSectionSchedule(selectedSection);
    return schedule.map(day => ({
      ...day,
      // Sort lectures by time slot index (first period to last)
      lectures: [...day.lectures].sort((a, b) => {
        const timeA = timeSlots.indexOf(a.time);
        const timeB = timeSlots.indexOf(b.time);
        return timeA - timeB;
      })
    }));
  }, [selectedSection]);

  // Count total lectures and sections (excluding holidays and training days)
  const { totalLectures, totalSections } = currentSchedule.reduce(
    (acc, day) => {
      if (day.isHoliday || day.isTraining) return acc;
      const lectures = day.lectures.filter(l => l.type === "lecture").length;
      const sections = day.lectures.filter(l => l.type === "section").length;
      return { 
        totalLectures: acc.totalLectures + lectures, 
        totalSections: acc.totalSections + sections 
      };
    }, 
    { totalLectures: 0, totalSections: 0 }
  );

  const handleDownloadImage = useCallback(async () => {
    if (!scheduleRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(scheduleRef.current, {
        backgroundColor: "#0a0a0f",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `الجدول-الدراسي-${selectedSection}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      toast.error("Failed to download image. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [selectedSection]);

  const handleDownloadPDF = useCallback(async () => {
    if (!scheduleRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(scheduleRef.current, {
        backgroundColor: "#0a0a0f",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? "landscape" : "portrait",
        unit: "px",
        format: [imgWidth, imgHeight],
      });
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`الجدول-الدراسي-${selectedSection}.pdf`);
    } catch (e) {
      toast.error("Failed to download PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [selectedSection]);

  return (
    <>
      <SEO 
        title="الجدول الدراسي"
        description="جدول محاضرات الأمن السيبراني الأسبوعي الكامل. جميع المحاضرات من السبت إلى الجمعة مع التفاصيل الكاملة."
        url="https://www.cyber-tmsah.site/schedule"
      />
      <Layout>
        {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.1) 0%, transparent 50%)`,
          }}
        />
        
        {/* Animated Grid */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />

        {/* Floating Orbs */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-[80px]" />

        <div className="section-container relative py-16 md:py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            {/* Title Section */}
            <div className="space-y-4">
              {/* Badge - Ramadan */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30">
                <Moon className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-500">رمضان 2026</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-black text-foreground">
                الجدول الدراسي
                <span className="block text-primary mt-2 drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
                  الأسبوعي
                </span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-md">
                جميع محاضرات الأسبوع من السبت إلى الجمعة مع التفاصيل الكاملة
              </p>
              <p className="text-sm text-amber-500/80 font-medium">
                ⏰ المواعيد الرمضانية (40 دقيقة محاضرة + 5 دقائق راحة)
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-6 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">7</div>
                    <div className="text-sm text-muted-foreground">أيام الأسبوع</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{totalLectures}</div>
                    <div className="text-sm text-muted-foreground">محاضرة</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-cyan-400">{totalSections}</div>
                    <div className="text-sm text-muted-foreground">سكشن</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section Selector & Download */}
            <div className="flex flex-col gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  اختر الشعبة
                </label>
                <div className="relative">
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="appearance-none w-full md:w-56 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-5 py-3.5 text-foreground font-semibold outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all cursor-pointer hover:border-primary/30"
                  >
                    {sections.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Download Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadImage}
                  disabled={isExporting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition-all duration-300 hover:bg-primary/20 hover:shadow-[0_0_20px_hsl(var(--primary)/0.2)] disabled:opacity-50"
                >
                  <Image className="h-4 w-4" />
                  صورة
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isExporting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition-all duration-300 hover:bg-primary/20 hover:shadow-[0_0_20px_hsl(var(--primary)/0.2)] disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule Grid */}
      <section className="section-container py-12 md:py-16" ref={scheduleRef}>
        {/* Ramadan Banner */}
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-amber-500/10 border border-amber-500/20">
          <div className="flex items-center justify-center gap-3 text-amber-500">
            <Moon className="h-5 w-5 animate-pulse" />
            <span className="font-bold">المواعيد الرمضانية</span>
            <span className="text-amber-500/70">|</span>
            <span className="text-sm">40 دقيقة محاضرة + 5 دقائق راحة</span>
          </div>
        </div>
        
        <div className="space-y-6">
          {currentSchedule.map((day, di) => (
            <ScrollReveal key={di}>
              <div className="group relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-500">
                {/* Training Badge Corner */}
                {day.isTraining && (
                  <div className="absolute top-0 left-0 z-10">
                    <div className="relative">
                      <div className="absolute -top-1 -left-1 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] border-t-amber-500" />
                      <span className="absolute top-1 left-1 text-[8px] font-bold text-white rotate-45 -left-2">تدريب</span>
                    </div>
                  </div>
                )}
                
                {/* Background Glow on Hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Day Header */}
                <div className="relative flex items-center gap-4 p-6 border-b border-border/30">
                  {/* Day Number */}
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
                    <Calendar className="h-6 w-6 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
                  </div>
                  
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                      {day.day}
                    </h2>
                    {/* Day Stats */}
                    {!day.isHoliday && !day.isTraining && day.lectures.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {day.lectures.filter(l => l.type === "lecture").length} محاضرة
                        </span>
                        {day.lectures.some(l => l.type === "section") && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {day.lectures.filter(l => l.type === "section").length} سكشن
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Lectures Grid or Holiday or Training */}
                <div className="relative p-6">
                  {day.lectures.length === 0 ? (
                    <div className="flex items-center justify-center py-12 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-dashed border-primary/30">
                      <div className="text-center space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse">
                          <span className="text-4xl">🎉</span>
                        </div>
                        <p className="text-xl font-bold text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
                          إجازة
                        </p>
                        <p className="text-sm text-muted-foreground">استمتع بيومك!</p>
                      </div>
                    </div>
                  ) : day.isTraining ? (
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-dashed border-primary/30">
                      <div className="relative flex flex-col items-center justify-center py-12 text-center space-y-4">
                        {/* Icon */}
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center shadow-[0_0_25px_hsl(var(--primary)/0.2)]">
                          <span className="text-4xl">🏋️</span>
                        </div>
                        
                        <div>
                          <h3 className="text-xl font-black text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)]">
                            يوم التدريب
                          </h3>
                          <p className="text-muted-foreground mt-2 font-medium">
                            {day.trainingMessage}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {day.lectures.map((lecture, li) => {
                        const isSection = lecture.type === "section";
                        return (
                        <div
                          key={li}
                          className={`group/card relative overflow-hidden rounded-xl backdrop-blur-sm p-4 border transition-all duration-300 hover:border-primary/50 ${
                            isSection 
                              ? "bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20" 
                              : "bg-secondary/30 border-border/50 hover:bg-secondary/50"
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center gap-4">
                            {/* Time Badge */}
                            <div className="flex items-center gap-3 md:min-w-[140px]">
                              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                                isSection 
                                  ? "bg-cyan-500/10 border-cyan-500/30" 
                                  : "bg-primary/10 border-primary/30"
                              }`}>
                                <Clock className={`h-5 w-5 ${isSection ? "text-cyan-400" : "text-primary"}`} />
                              </div>
                              <span className={`text-base font-bold ${isSection ? "text-cyan-400" : "text-primary"}`} dir="ltr">{lecture.time}</span>
                            </div>

                            {/* Divider */}
                            <div className="hidden md:block w-px h-10 bg-border/50" />
                            
                            {/* Subject */}
                            <div className="flex-1 mt-4 md:mt-0">
                              <h3 className={`font-bold group-hover/card:text-primary transition-colors ${isSection ? "text-cyan-400" : "text-foreground"}`}>
                                {lecture.subject}
                              </h3>
                            </div>
                            
                            {/* Details */}
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <User className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="text-muted-foreground">{lecture.instructor}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <MapPin className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="text-muted-foreground">{lecture.room}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  )}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>
      </Layout>
    </>
  );
};

export default Schedule;
