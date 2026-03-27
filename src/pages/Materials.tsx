import { useState, useEffect } from "react";
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

  // Fetch from DB on mount
  useEffect(() => {
    materialsService.fetchMaterials().then((data) => {
      setMaterials(data);
      setLoading(false);
    }).catch(() => {
      toast.error("Failed to load materials.");
      setLoading(false);
    });
  }, []);

  // Sort: those with TAs first
  const sorted = [...materials].sort((a, b) => {
    const aHasTA = (a.teaching_assistants?.length || 0) > 0;
    const bHasTA = (b.teaching_assistants?.length || 0) > 0;
    if (aHasTA && !bHasTA) return -1;
    if (!aHasTA && bHasTA) return 1;
    return 0;
  });

  // Unique doctors count
  const uniqueDoctors = new Set(
    materials.flatMap((m) => [m.instructor, m.second_instructor].filter(Boolean)),
  );

  // Search filter
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
      {/* Hero Header */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />

        <div className="section-container relative">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">الفصل الدراسي الأول</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-foreground mb-4">
              المواد <span className="text-primary">الدراسية</span>
            </h1>

            <p className="text-muted-foreground text-lg">
              اختر المادة للوصول إلى المحاضرات والملفات والمراجعات
            </p>

            <div className="flex items-center justify-center gap-6 mt-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">{loading ? "..." : materials.length}</span>
                </span>
                <span>مواد دراسية</span>
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

      {/* Search + Subjects Grid */}
      <section className="section-container pb-20 space-y-6">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by subject name or doctor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            dir="auto"
          />
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-10">Loading materials...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">No subjects match your search.</p>
        ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((subject, index) => (
            <ScrollReveal key={subject.id}>
              <Link
                to={`/materials/${subject.slug}`}
                className="group relative overflow-hidden rounded-2xl bg-card border border-border/50 transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)] block"
              >
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">0{index + 1}</span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative p-6 pt-14">
                  <div className="text-5xl mb-5 transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)]">
                    {subject.icon}
                  </div>

                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-300 mb-3 line-clamp-1">
                    {subject.title}
                  </h3>

                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">{subject.instructor}</span>
                  </div>

                  {subject.second_instructor && (
                    <div className="flex items-center gap-2.5 mt-2">
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">{subject.second_instructor}</span>
                    </div>
                  )}

                  {subject.teaching_assistants && subject.teaching_assistants.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-xs text-cyan-400 font-medium">المعيدين</span>
                      </div>
                      <div className="grid gap-2">
                        {subject.teaching_assistants.map((ta, taIndex) => (
                          <div key={taIndex} className="flex items-center gap-2 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                            <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                              <User className="h-3 w-3 text-cyan-400" />
                            </div>
                            <span className="text-sm font-medium text-cyan-400">{ta}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative border-t border-border/50 p-4 flex items-center justify-between bg-card/50 backdrop-blur-sm">
                  <span className="text-xs text-muted-foreground">عرض المحاضرات</span>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-all duration-300">
                    <ArrowLeft className="h-4 w-4 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                </div>

                <div className="absolute inset-0 rounded-2xl border-2 border-primary/0 group-hover:border-primary/30 transition-all duration-500 pointer-events-none" />
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
