import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, User, Calendar, BookOpen, Shield, Zap, GraduationCap } from "lucide-react";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import FounderCard from "@/components/FounderCard";
import SEO from "@/components/SEO";
import FAQSection from "@/components/FAQSection";
import { supabase } from "@/lib/supabaseClient";
const heroBg = "/hero-bg.jpg";

const features = [
  { icon: BookOpen, title: "مواد دراسية", desc: "محاضرات ومراجعات شاملة لكل المواد" },
  { icon: Calendar, title: "جدول محدث", desc: "الجدول الأسبوعي الكامل لكل سكشن" },
  { icon: Shield, title: "حضور ذكي", desc: "نظام حضور بال GPS وكود جلسة متحرك" },
  { icon: Zap, title: "إشعارات فورية", desc: "تذكيرات بالامتحانات والكويزات" },
  { icon: GraduationCap, title: "كلي المواد", desc: "7 مواد تخصص الأمن السيبراني" },
  { icon: Clock, title: "يعمل بدون نت", desc: "تسجيل حضور حتى بدون إنترنت" },
];

const PERIODS_TIME = [
  "9:00 AM - 10:00 AM", "10:05 AM - 11:05 AM", "11:10 AM - 12:10 PM", "12:15 PM - 1:15 PM",
  "1:20 PM - 2:20 PM", "2:25 PM - 3:25 PM", "3:30 PM - 4:30 PM", "4:35 PM - 5:35 PM",
];

interface TodayLecture {
  time: string;
  subject: string;
  instructor: string;
  room: string;
}

function getTodayDate(): string {
  return new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function normalizeDay(raw: string): string {
  return raw.replace("الإثنين", "الاثنين").replace("الاحد", "الاحد").replace("الأحد", "الاحد").replace("الأربعاء", "الاربعاء");
}

const Index = () => {
  const [selectedSection, setSelectedSection] = useState("سكشن 1");
  const [sections, setSections] = useState<string[]>(Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`));
  const [todayLectures, setTodayLectures] = useState<TodayLecture[]>([]);
  const todayName = normalizeDay(new Date().toLocaleDateString("ar-EG", { weekday: "long" }));
  const todayDate = getTodayDate();

  useEffect(() => {
    supabase.from("published_schedule").select("section").then(({ data }) => {
      if (data && data.length > 0) {
        const secs = [...new Set(data.map(r => r.section))].sort((a, b) => a - b);
        setSections(secs.map(n => `سكشن ${n}`));
      }
    });
  }, []);

  useEffect(() => {
    const sectionNum = parseInt(selectedSection.replace(/\D/g, "")) || 1;
    supabase.from("published_schedule")
      .select("period, subject, instructor, room, entry_type")
      .eq("section", sectionNum)
      .eq("day", todayName)
      .order("period")
      .then(({ data }) => {
        if (!data) { setTodayLectures([]); return; }
        setTodayLectures(data.map(r => ({
          time: PERIODS_TIME[r.period - 1] || "",
          subject: r.subject,
          instructor: r.instructor,
          room: r.room,
        })));
      });
  }, [selectedSection, todayName]);

  return (
    <>
      <SEO 
        title="الرئيسية"
        description="منصة CYBER TMSAH - منصة أكاديمية متكاملة لطلاب الأمن السيبراني. مواد دراسية، جداول محاضرات، ومراجعات شاملة."
        url="https://www.cyber-tmsah.site"
      />
      <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="h-full w-full object-cover opacity-20" width={1543} height={868} fetchPriority="high" decoding="async" sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="section-container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">جامعة حلوان التكنولوجية الدولية</span>
            </div>

            <h1 className="animate-fade-up text-4xl md:text-5xl lg:text-6xl font-black leading-tight text-foreground">
              منصة{" "}
              <span className="relative inline-block" dir="ltr">
                <span className="bg-gradient-to-r from-cyan-400 via-primary to-cyan-300 bg-clip-text text-transparent" style={{
                  textShadow: '0 0 30px hsl(174 72% 50% / 0.5), 0 0 60px hsl(174 72% 50% / 0.3)'
                }}>
                  CYBER TMSAH
                </span>
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full" />
              </span>
              <br />
              <span className="text-3xl md:text-4xl lg:text-5xl font-bold text-muted-foreground mt-3 block">
                للأمن السيبراني
              </span>
            </h1>

            <p className="animate-fade-up-delay-1 mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto">
              مواد دراسية • جداول محاضرات • نظام حضور ذكي
              <br />
              <span className="text-primary font-medium">كل ما تحتاجه في مكان واحد</span>
            </p>

            <div className="animate-fade-up-delay-2 mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/materials" className="group relative inline-flex items-center gap-3 rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)]">
                <span className="relative z-10">ابدأ الآن</span>
                <ArrowLeft className="h-5 w-5 relative z-10 transition-transform group-hover:-translate-x-1" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-cyan-500 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link to="/schedule" className="group inline-flex items-center gap-3 rounded-xl border-2 border-primary/50 bg-background/50 backdrop-blur-sm px-8 py-4 text-base font-bold text-foreground transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:scale-105">
                <Calendar className="h-5 w-5 text-primary" />
                <span>الجدول الدراسي</span>
              </Link>
              <Link to="/attendance" className="group inline-flex items-center gap-3 rounded-xl border-2 border-cyan-400/40 bg-cyan-400/10 backdrop-blur-sm px-8 py-4 text-base font-bold text-cyan-300 transition-all duration-300 hover:border-cyan-300 hover:bg-cyan-400/15 hover:scale-105">
                <Shield className="h-5 w-5" />
                <span>الحضور</span>
              </Link>
            </div>

            <div className="animate-fade-up-delay-2 mt-14 grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="text-center p-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
                <div className="text-2xl md:text-3xl font-black text-primary">7</div>
                <div className="text-[11px] md:text-xs text-muted-foreground mt-1">مواد دراسية</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
                <div className="text-2xl md:text-3xl font-black text-primary">15</div>
                <div className="text-[11px] md:text-xs text-muted-foreground mt-1">سكاشن</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
                <div className="text-2xl md:text-3xl font-black text-primary">8</div>
                <div className="text-[11px] md:text-xs text-muted-foreground mt-1">فترات يومياً</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <ScrollReveal>
        <section className="section-container py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black text-foreground">
              لماذا <span className="text-primary">CYBER TMSAH</span>؟
            </h2>
            <p className="text-muted-foreground mt-2">كل ما تحتاجه لنجاحك الأكاديمي في مكان واحد</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title} className="group relative rounded-2xl p-5 bg-card/50 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:bg-card">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground text-sm md:text-base">{f.title}</h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* Today Schedule */}
      <ScrollReveal>
        <section className="section-container py-16">
          <div className="relative mb-10">
            <div className="absolute -top-10 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 mb-4">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">محاضرات اليوم</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground">
                  جدول <span className="text-primary">اليوم</span>
                </h2>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-2 text-muted-foreground bg-card/50 rounded-lg px-3 py-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{todayDate}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <span className="text-sm text-muted-foreground">اختر السكشن:</span>
                <div className="relative">
                  <select aria-label="اختر السكشن" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="appearance-none w-full sm:w-52 rounded-xl border-2 border-border bg-card px-5 py-3 text-sm font-medium text-foreground outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer hover:border-primary/50">
                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {todayName === "الجمعة" ? (
            <div className="relative rounded-2xl bg-gradient-to-br from-card to-card/50 p-10 text-center border border-border/50 overflow-hidden">
              <div className="absolute inset-0 bg-primary/5" />
              <div className="relative">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-primary/40" />
                <h3 className="text-2xl font-bold text-foreground mb-2">يوم إجازة!</h3>
                <p className="text-muted-foreground">استمتع بوقتك، لا توجد محاضرات اليوم</p>
              </div>
            </div>
          ) : todayLectures.length > 0 ? (
            <div className="grid gap-3">
              {todayLectures.map((lecture, i) => (
                <div key={i} className="group relative rounded-2xl p-4 md:p-5 transition-all duration-300 overflow-hidden bg-card border border-border/50 hover:border-primary/30">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                    <div className="flex items-center gap-3 sm:min-w-[150px]">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block" dir="ltr">{lecture.time}</span>
                        <span className="text-[10px] text-muted-foreground">الفترة {i + 1}</span>
                      </div>
                    </div>
                    <div className="hidden sm:block w-px h-10 bg-border" />
                    <div className="flex-1">
                      <h4 className="text-sm md:text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {lecture.subject}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        {lecture.instructor && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3 text-primary" />
                            {lecture.instructor}
                          </span>
                        )}
                        {lecture.room && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 text-primary" />
                            {lecture.room}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-card border border-border/50 p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-muted-foreground">لا توجد محاضرات اليوم</p>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link to="/schedule" className="inline-flex items-center gap-2 text-primary font-medium hover:underline transition-all">
              <span>عرض الجدول الأسبوعي الكامل</span>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </ScrollReveal>

      {/* Founder Card */}
      <ScrollReveal>
        <section className="section-container py-16">
          <FounderCard />
        </section>
      </ScrollReveal>

      {/* FAQ */}
      <FAQSection />
    </Layout>
    </>
  );
};

export default Index;
