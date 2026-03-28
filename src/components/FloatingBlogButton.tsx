import { useState } from "react";
import { ExternalLink, X, Newspaper, GraduationCap } from "lucide-react";

const PLATFORM_URL = "https://e-books.hitu.edu.eg/login";

const FloatingBlogButton = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
      {/* Expanded Card */}
      {isExpanded && (
        <div className="animate-fade-up rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl p-4 shadow-[0_0_30px_hsl(var(--primary)/0.15)] w-64">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-foreground">روابط سريعة</h4>
            <button
              onClick={() => setIsExpanded(false)}
              className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/20 transition-colors"
              aria-label="إغلاق"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-2">
            <a
              href="https://cyber-tmsah.blogspot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full rounded-xl bg-secondary/50 px-4 py-3 text-sm font-bold text-foreground transition-all duration-300 hover:bg-primary/10 hover:border-primary/30 border border-transparent"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Newspaper className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="block text-sm font-bold">المدونة</span>
                <span className="block text-[10px] text-muted-foreground">مقالات وشروحات أمن سيبراني</span>
              </div>
            </a>

            <a
              href={PLATFORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full rounded-xl bg-secondary/50 px-4 py-3 text-sm font-bold text-foreground transition-all duration-300 hover:bg-primary/10 hover:border-primary/30 border border-transparent"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 text-cyan-500" />
              </div>
              <div>
                <span className="block text-sm font-bold">منصة HITU</span>
                <span className="block text-[10px] text-muted-foreground">منصة جامعة حلوان التكنولوجية</span>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* FAB Buttons */}
      <div className="flex items-center gap-3">
        <a
          href={PLATFORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-[0_0_20px_hsl(187_72%_50%/0.3)] flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_hsl(187_72%_50%/0.5)]"
          aria-label="منصة الجامعة"
        >
          <span className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping opacity-20" />
          <GraduationCap className="h-5 w-5 relative z-10" />
        </a>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="group relative w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
          aria-label="روابط سريعة"
        >
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-30" />
          <Newspaper className="h-5 w-5 relative z-10" />
        </button>
      </div>
    </div>
  );
};

export default FloatingBlogButton;
