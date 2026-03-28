import { useState } from "react";
import { ExternalLink, X, Newspaper } from "lucide-react";

const FloatingBlogButton = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
      {/* Expanded Card */}
      {isExpanded && (
        <div className="animate-fade-up rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl p-4 shadow-[0_0_30px_hsl(var(--primary)/0.15)] w-64">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-foreground">مدونة CYBER TMSAH</h4>
            <button
              onClick={() => setIsExpanded(false)}
              className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/20 transition-colors"
              aria-label="إغلاق"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            مقالات ودروس في الأمن السيبراني، شروحات تقنية، وأحدث الأخبار الأمنية.
          </p>
          <a
            href="https://cyber-tmsah.blogspot.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
          >
            <span>زيارة المدونة</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group relative w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)] flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
        aria-label="المدونة"
      >
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-30" />
        <Newspaper className="h-6 w-6 relative z-10" />
      </button>
    </div>
  );
};

export default FloatingBlogButton;
