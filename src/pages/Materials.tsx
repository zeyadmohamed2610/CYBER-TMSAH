import { Link } from "react-router-dom";
import { User, BookOpen, ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import { subjects } from "@/data/mockData";

/**
 * Materials Page Component
 * Displays all available subjects with links to their details
 */
const Materials = () => {
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
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="section-container relative">
          <div className="max-w-2xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-6">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">الفصل الدراسي الأول</span>
            </div>
            
            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-black text-foreground mb-4">
              المواد <span className="text-primary">الدراسية</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-muted-foreground text-lg">
              اختر المادة للوصول إلى المحاضرات والملفات والمراجعات
            </p>
            
            {/* Stats */}
            <div className="flex items-center justify-center gap-6 mt-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">{subjects.length}</span>
                </span>
                <span>مواد دراسية</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">7</span>
                </span>
                <span>دكاترة
              </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Subjects Grid */}
      <section className="section-container pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {subjects.map((subject, index) => <ScrollReveal key={subject.id}>
              <Link to={`/materials/${subject.id}`} className="group relative overflow-hidden rounded-2xl bg-card border border-border/50 transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)] block">
                {/* Card Number */}
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">0{index + 1}</span>
                </div>
                
                {/* Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Glow Effect */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Content */}
                <div className="relative p-6 pt-14">
                  {/* Icon */}
                  <div className="text-5xl mb-5 transition-all duration-500 group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)]">
                    {subject.icon}
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-300 mb-3 line-clamp-1">
                    {subject.title}
                  </h3>
                  
                  {/* Instructor */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">{subject.instructor}</span>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="relative border-t border-border/50 p-4 flex items-center justify-between bg-card/50 backdrop-blur-sm">
                  <span className="text-xs text-muted-foreground">عرض المحاضرات</span>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-all duration-300">
                    <ArrowLeft className="h-4 w-4 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                </div>
                
                {/* Hover Border Glow */}
                <div className="absolute inset-0 rounded-2xl border-2 border-primary/0 group-hover:border-primary/30 transition-all duration-500 pointer-events-none" />
              </Link>
            </ScrollReveal>)}
        </div>
      </section>
      </Layout>
    </>
  );
};

export default Materials;