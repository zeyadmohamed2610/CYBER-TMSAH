import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FileText, Download, ChevronLeft, User, ExternalLink, BookOpen, Sparkles, GraduationCap, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import ShareButtons from "@/components/ShareButtons";
import { subjects } from "@/data/mockData";

/**
 * Subject Detail Page Component
 * Displays detailed information about a specific subject
 */
const SubjectDetail = () => {
  const { id } = useParams();
  const subject = subjects.find((s) => s.id === id);
  const [activeTab, setActiveTab] = useState<"lectures" | "sections">("lectures");
  
  // Last updated date (in production, this should come from API/CMS)
  const lastUpdated = "2025-02-27";

  if (!subject) {
    return (
      <>
        <SEO 
          title="المادة غير موجودة"
          description="عذراً، المادة المطلوبة غير موجودة في منصتنا."
        />
        <Layout>
          <div className="section-container py-20 text-center">
            <h1 className="text-2xl font-bold text-foreground">المادة غير موجودة</h1>
            <Link to="/materials" className="text-primary mt-4 inline-block">العودة للمواد</Link>
          </div>
        </Layout>
      </>
    );
  }

  return (
    <>
      <SEO 
        title={subject.title}
        description={`محاضرات ومراجعات ${subject.title} - ${subject.instructor}. جميع المحاضرات والملفات المتعلقة بالمادة.`}
        url={`https://www.cyber-tmsah.site/materials/${subject.id}`}
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

        <div className="section-container relative py-12 md:py-16">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Link to="/materials" className="hover:text-primary transition-colors flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              المواد الدراسية
            </Link>
            <ChevronLeft className="h-4 w-4" />
            <span className="text-foreground font-medium">{subject.title}</span>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Icon */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
              <span className="text-5xl">{subject.icon}</span>
            </div>
            
            <div className="flex-1">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">مادة دراسية</span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-black text-foreground">{subject.title}</h1>
              
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground font-medium">{subject.instructor}</span>
                </div>
                
                {/* Teaching Assistants */}
                {subject.teachingAssistants && subject.teachingAssistants.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div className="flex gap-1">
                      {subject.teachingAssistants.map((ta, taIndex) => (
                        <span key={taIndex} className="text-sm text-cyan-400 font-medium">
                          {ta}{taIndex < subject.teachingAssistants!.length - 1 ? " - " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Last Updated */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>آخر تحديث: {new Date(lastUpdated).toLocaleDateString('ar-EG')}</span>
                </div>
              </div>
              
              {/* Share Buttons */}
              <div className="mt-4">
                <ShareButtons 
                  title={subject.title}
                  url={`https://www.cyber-tmsah.site/materials/${subject.id}`}
                  description={`محاضرات ومراجعات ${subject.title}`}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <div className="text-center px-6 py-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
                <div className="text-2xl font-black text-primary">{subject.articles.length}</div>
                <div className="text-xs text-muted-foreground mt-1">محاضرة</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-container py-12">
        {/* PDF Section */}
        <ScrollReveal>
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">ملف المادة الكامل</h2>
            </div>
            
            <div className="group relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-sm p-6 border border-border/50 hover:border-primary/30 transition-all duration-300">
              {/* Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{subject.title} - الملف الكامل</h3>
                    <p className="text-sm text-muted-foreground mt-1">PDF - جميع المحاضرات</p>
                  </div>
                </div>
                <button
                  onClick={() => toast("ملف المادة غير جاهز بعد", { description: "سيتم إضافة الملف قريبًا إن شاء الله" })}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                >
                  <Download className="h-4 w-4" />
                  تحميل الملف
                </button>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Articles Section */}
        <ScrollReveal>
          <div>
            {/* Tabs */}
            {subject.sections && subject.sections.length > 0 ? (
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setActiveTab("lectures")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                    activeTab === "lectures"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <GraduationCap className="h-4 w-4" />
                  المحاضرات
                </button>
                <button
                  onClick={() => setActiveTab("sections")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                    activeTab === "sections"
                      ? "bg-cyan-500 text-white"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  السكاشن
                </button>
              </div>
            ) : null}
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {activeTab === "lectures" ? "شروحات المحاضرات" : "شروحات السكاشن"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "lectures" ? "اضغط على أي محاضرة للانتقال إلى الشرح التفصيلي" : "اضغط على أي سكشن للانتقال إلى الشرح التفصيلي"}
                </p>
              </div>
            </div>
            
            <div className="space-y-3 mt-6">
              {(activeTab === "lectures" ? subject.articles : subject.sections || []).map((item, index) => (
                "blogUrl" in item ? (
                  <a
                    key={item.id}
                    href={item.blogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-xl bg-card/50 backdrop-blur-sm p-4 border border-border/50 transition-all duration-300 hover:border-primary/50 hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-primary font-bold shadow-[0_0_15px_hsl(var(--primary)/0.15)]">
                        {index + 1}
                      </div>
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </span>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </a>
                ) : (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-cyan-500/10 backdrop-blur-sm p-4 border border-cyan-500/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold shadow-[0_0_15px_hsl(187_72%_50%/0.15)]">
                        {index + 1}
                      </div>
                      <div>
                        <span className="font-bold text-cyan-400">
                          {item.title}
                        </span>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-cyan-400" />
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>
      </Layout>
    </>
  );
};

export default SubjectDetail;
