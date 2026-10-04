import { Facebook, Github, Linkedin, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
const socials = [
  { icon: Facebook, href: "https://www.facebook.com/zeyad.eltmsah", label: "Facebook" },
  { icon: Linkedin, href: "https://www.linkedin.com/in/zeyadmohamed26/", label: "LinkedIn" },
  { icon: Github, href: "https://github.com/zeyadmohamed2610", label: "GitHub" },
  { icon: MessageCircle, href: "https://wa.me/201553450232", label: "WhatsApp" },
];
export default function Footer() {
  return (
    <footer className="mt-6 border-t border-border/60 bg-card/40" dir="rtl">
      <div className="section-container py-4">
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" aria-label="CYBER TMSAH Home" className="shrink-0">
              <img
                src="/brand/logo-small.webp"
                alt=""
                width="32"
                height="32"
                className="h-8 w-8 object-contain"
              />
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-bold">
                <span dir="ltr">CYBER TMSAH</span> · نظام الحضور والغياب
              </p>
              <p className="mt-1 text-xs text-muted-foreground">جامعة حلوان التكنولوجية الدولية</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <span className="text-xs text-muted-foreground">تواصل معنا</span>
            <div className="flex items-center gap-1">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/60 hover:bg-primary/10 hover:text-primary"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 border-t border-border/40 pt-3 text-center text-xs text-muted-foreground">
          © 2026 CYBER TMSAH - جميع الحقوق محفوظة
        </p>
      </div>
    </footer>
  );
}
