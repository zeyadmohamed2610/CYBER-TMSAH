import { Link } from "react-router-dom";
import { Github, Facebook, Linkedin, MessageCircle, ArrowUp } from "lucide-react";
import { UNIVERSITY_PLATFORM_URL } from "@/lib/externalLinks";

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative border-t border-border/50 mt-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent" />
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="section-container relative py-12">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center lg:items-start gap-4">
            <Link to="/" className="group flex items-center" dir="ltr">
              <span className="text-2xl font-black tracking-widest">
                <span
                  className="bg-gradient-to-r from-cyan-400 via-primary to-cyan-300 bg-clip-text text-transparent"
                  style={{
                    textShadow: "0 0 20px hsl(174 72% 50% / 0.5)",
                  }}
                >
                  CYBER
                </span>
              </span>
              <span className="text-primary text-2xl font-thin mx-2">⟡</span>
              <span className="text-2xl font-black tracking-widest text-foreground group-hover:text-primary transition-colors">
                TMSAH
              </span>
            </Link>

            <div className="text-center lg:text-right">
              <span className="text-sm font-medium text-foreground block">Capital Technological University</span>
              <span className="text-xs text-muted-foreground">جامعة العاصمة التكنولوجية</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">روابط سريعة</span>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/materials" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                المواد الدراسية
              </Link>
              <span className="w-1 h-1 rounded-full bg-primary/50" />
              <Link to="/schedule" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                الجدول الدراسي
              </Link>
              <span className="w-1 h-1 rounded-full bg-primary/50" />
              <Link to="/attendance" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                الحضور
              </Link>
              <span className="w-1 h-1 rounded-full bg-primary/50" />
              <a href={UNIVERSITY_PLATFORM_URL} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); window.open(UNIVERSITY_PLATFORM_URL, "_blank", "noopener"); }} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                المنصة
              </a>
              <span className="w-1 h-1 rounded-full bg-primary/50" />
              <a
                href="https://cyber-tmsah.blogspot.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                المدونة
              </a>
            </div>
          </div>

          <div className="flex flex-col items-center lg:items-end gap-4">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">تواصل معنا</span>
            <div className="flex items-center gap-3">
              {[
                { icon: Facebook, href: "https://www.facebook.com/zeyad.eltmsah", label: "Facebook" },
                { icon: Linkedin, href: "https://www.linkedin.com/in/zeyadmohamed26/", label: "LinkedIn" },
                { icon: Github, href: "https://github.com/zeyadmohamed2610", label: "GitHub" },
                { icon: MessageCircle, href: "https://wa.me/201553450232", label: "WhatsApp" },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-10 h-10 rounded-xl bg-card border border-border/50 flex items-center justify-center transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="my-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">© 2026 CYBER TMSAH - جميع الحقوق محفوظة</span>

          <button
            onClick={scrollToTop}
            className="group flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <span>العودة للأعلى</span>
            <div className="w-8 h-8 rounded-lg bg-card border border-border/50 flex items-center justify-center group-hover:border-primary group-hover:bg-primary/10 transition-all">
              <ArrowUp className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
