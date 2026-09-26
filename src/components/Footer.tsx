import { Link } from "react-router-dom";
import { Github, Facebook, Linkedin, MessageCircle } from "lucide-react";

const Footer = () => {

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
          <div className="flex flex-col items-center lg:items-start gap-4 order-2 lg:order-1">
            <Link to="/" className="group flex items-center select-none" dir="ltr" aria-label="CYBER TMSAH Home">
              <span className="font-black text-2xl text-white tracking-[0.14em] drop-shadow-[0_2px_12px_rgba(255,255,255,0.3)]">
                CYBER
              </span>
              <span
                className="font-black text-2xl tracking-[0.14em] ml-2 transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #F3E8FF 0%, #C084FC 45%, #9333EA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 16px rgba(168,85,247,0.7))",
                }}
              >
                TMSAH
              </span>
              <span className="relative flex h-2 w-2 ml-1.5 -top-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400 shadow-[0_0_8px_#A855F7]" />
              </span>
            </Link>

            <div className="text-center lg:text-right">
              <span className="text-sm font-medium text-foreground block">Helwan International Technological University</span>
              <span className="text-xs text-muted-foreground">جامعة حلوان التكنولوجية الدولية</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 order-1 lg:order-2">
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

          <div className="flex flex-col items-center lg:items-end gap-4 order-3">
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

        <div className="text-center">
          <span className="text-xs text-muted-foreground">© 2026 CYBER TMSAH - جميع الحقوق محفوظة</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
