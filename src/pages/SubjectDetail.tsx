import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, User, ExternalLink, BookOpen, GraduationCap, Users } from "lucide-react";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import { subjects } from "@/data/mockData";

const SubjectDetail = () => {
  const { id } = useParams();
  const subject = subjects.find((s) => s.id === id);
  const [activeTab, setActiveTab] = useState<"lectures" | "sections">("lectures");

  if (!subject) {
    return (
      <>
        <SEO title="المادة غير موجودة" />
        <Layout>
          <div className="section-container py-20 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h1 className="text-2xl font-bold text-foreground mb-4">المادة غير موجودة</h1>
            <Link to="/materials" className="text-primary hover:underline">العودة للمواد</Link>
          </div>
        </Layout>
      </>
    );
  }

  const hasSections = subject.sections && subject.sections.length > 0;
  const displayItems = activeTab === "lectures" ? subject.articles : (subject.sections || []);

  return (
    <>
      <SEO
        title={subject.title}
        description={"محاضرات ومراجعات " + subject.title + " - " + subject.instructor}
        url={"https://www.cyber-tmsah.site/materials/" + subject.id}
      />
      <Layout>
        <section className="relative overflow-hidden border-b border-border/50">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }} />
          <div className="absolute top-20 right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />

          <div className="section-container relative py-12 md:py-16">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <Link to="/materials" className="hover:text-primary transition-colors flex items-center gap-1">
                <BookOpen className="h-4 w-4" />المواد الدراسية
              </Link>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-foreground font-medium">{subject.title}</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center">
                <span className="text-4xl md:text-5xl">{subject.icon}</span>
              </div>

              <div className="flex-1">
                <h1 className="text-2xl md:text-4xl font-black text-foreground">{subject.title}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm text-foreground font-medium">{subject.instructor}</span>
                  </div>
                  {subject.secondInstructor && (
                    <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-1.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm text-foreground font-medium">{subject.secondInstructor}</span>
                    </div>
                  )}
                  {subject.teachingAssistants && subject.teachingAssistants.length > 0 && (
                    <div className="flex items-center gap-2 bg-cyan-500/10 rounded-lg px-3 py-1.5">
                      <Users className="h-3.5 w-3.5 text-cyan-400" />
                      <span className="text-sm text-cyan-400 font-medium">{subject.teachingAssistants.join(" - ")}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="text-center px-5 py-3 rounded-xl bg-card border border-border/50">
                  <div className="text-xl font-black text-primary">{subject.articles.length}</div>
                  <div className="text-[10px] text-muted-foreground">محاضرة</div>
                </div>
                {hasSections && (
                  <div className="text-center px-5 py-3 rounded-xl bg-card border border-border/50">
                    <div className="text-xl font-black text-cyan-400">{subject.sections!.length}</div>
                    <div className="text-[10px] text-muted-foreground">سكشن</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="section-container py-10">
          <ScrollReveal>
            {hasSections && (
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setActiveTab("lectures")}
                  className={"flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all " + (activeTab === "lectures" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
                  <GraduationCap className="h-4 w-4" />المحاضرات
                </button>
                <button onClick={() => setActiveTab("sections")}
                  className={"flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all " + (activeTab === "sections" ? "bg-cyan-500 text-white" : "bg-card text-muted-foreground hover:text-foreground")}>
                  <Users className="h-4 w-4" />السكاشن
                </button>
              </div>
            )}

            <div className="space-y-3">
              {displayItems.map((item, index) => {
                if ("blogUrl" in item) {
                  return (
                    <a key={item.id} href={item.blogUrl} target="_blank" rel="noopener noreferrer"
                      className="group flex items-center gap-4 rounded-xl bg-card border border-border/50 p-4 transition-all hover:border-primary/50 hover:bg-primary/5">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {index + 1}
                      </div>
                      <span className="flex-1 font-medium text-foreground group-hover:text-primary transition-colors">{item.title}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 rtl:rotate-180" />
                    </a>
                  );
                }
                return (
                  <div key={item.id} className="flex items-center gap-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 p-4">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold text-sm shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-cyan-400">{item.title}</span>
                      <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <BookOpen className="h-4 w-4 text-cyan-400/50 shrink-0" />
                  </div>
                );
              })}
            </div>

            {displayItems.length === 0 && (
              <div className="text-center py-12">
                <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">لا يوجد محتوى حالياً</p>
              </div>
            )}
          </ScrollReveal>
        </section>
      </Layout>
    </>
  );
};

export default SubjectDetail;
