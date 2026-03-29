import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { User, BookOpen, ArrowLeft, Users, Search } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import { materialsService, type CourseMaterial } from "@/features/attendance/services/materialsService";

const Materials = () => {
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    materialsService.fetchMaterials().then(({ data, error }) => {
      if (error) {
        toast.error("فشل تحميل المواد.");
      }
      setMaterials(data ?? []);
      setLoading(false);
    }).catch(() => {
      toast.error("فشل تحميل المواد.");
      setLoading(false);
    });
  }, []);

  const sorted = useMemo(() =>
    [...materials].sort((a, b) => {
      const aHasTA = (a.teaching_assistants?.length || 0) > 0;
      const bHasTA = (b.teaching_assistants?.length || 0) > 0;
      if (aHasTA && !bHasTA) return -1;
      if (!aHasTA && bHasTA) return 1;
      return 0;
    }),
  [materials]);

  const uniqueDoctors = useMemo(() =>
    new Set(
      materials.flatMap((m) => [m.instructor, m.second_instructor].filter(Boolean)),
    ),
  [materials]);

  const filtered = sorted.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.instructor.toLowerCase().includes(q) ||
      (m.second_instructor?.toLowerCase().includes(q) ?? false) ||
      m.teaching_assistants.some((ta) => ta.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <SEO
        title="المواد الدراسية"
        description="جميع مواد الأمن السيبراني. محاضرات، ملفات، ومراجعات لجميع المواد الدراسية."
        url="https://www.cyber-tmsah.site/materials"
      />
      <Layout>
      <section className="relative py-12 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />

        <div className="section-container relative">
          <div className="max-w-2xl mx-auto text-center px-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">الفصل الدراسي الأول</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-foreground mb-4">
              المواد <span className="text-primary">الدراسية</span>
            </h1>

            <p className="text-muted-foreground text-base md:text-lg">
              اختر المادة للوصول إلى المحاضرات والملفات والمراجعات
            </p>

            <div className="flex items-center justify-center gap-4 md:gap-6 mt-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">{loading ? "..." : materials.length}</span>
                </span>
                <span className="hidden sm:inline">مواد دراسية</span>
                <span className="sm:hidden">مواد</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">{loading ? "..." : uniqueDoctors.size}</span>
                </span>
                <span>دكاترة</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-container pb-16 md:pb-20 space-y-6">
        <div className="relative max-w-md mx-auto px-4 md:px-0">
          <Search className="absolute right-7 md:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث عن مادة أو دكتور أو معيد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-300"
            dir="auto"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">جاري تحميل المواد...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-muted-foreground">لا توجد مواد مطابقة لبحثك.</p>
          </div>
        ) : (
        <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 px-4 md:px-0">
          {filtered.map((subject, index) => (
            <ScrollReveal key={subject.id}>
              <Link
                to={`/materials/${subject.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-card border border-border/50 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 block"
              >
                <div className="absolute top-3 left-3 z-10 w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-[10px] font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative p-5 md:p-6 pt-14 flex-1">
                  <div className="text-4xl mb-4 transition-transform duration-300 group-hover:scale-110">
                    {subject.icon}
                  </div>

                  <h3 className="text-base md:text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-200 mb-3 line-clamp-2">
                    {subject.title}
                  </h3>

                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground truncate">{subject.instructor}</span>
                  </div>

                  {subject.second_instructor && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <User className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground truncate">{subject.second_instructor}</span>
                    </div>
                  )}

                  {subject.teaching_assistants && subject.teaching_assistants.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3 w-3 text-cyan-400" />
                        <span className="text-[11px] text-cyan-400 font-medium">المعيدين</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {subject.teaching_assistants.map((ta, taIndex) => (
                          <span key={taIndex} className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/15 rounded-md px-2 py-1">
                            <User className="h-2.5 w-2.5 shrink-0" />
                            {ta}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative border-t border-border/50 px-5 py-3.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">عرض المحاضرات</span>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center transition-all duration-200 group-hover:bg-primary">
                    <ArrowLeft className="h-3.5 w-3.5 text-primary transition-colors duration-200 group-hover:text-primary-foreground rtl:rotate-180" />
                  </div>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
        )}
      </section>
      </Layout>
    </>
  );
};

export default Materials;
