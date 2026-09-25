import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, Sun, Moon, Globe, Shield, User } from "lucide-react";
import { useAttendanceAuth } from "@/features/attendance/context/AttendanceAuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/i18n";
import { getAttendanceDashboardRoute } from "@/features/attendance/utils/dashboardRoutes";

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { user, role, fullName, signOut } = useAttendanceAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang } = useLang();

  // Close mobile drawer on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
    setOpen(false);
  };

  const getRoleBadge = () => {
    if (!role) return null;
    switch (role) {
      case "student":
        return { label: lang === "ar" ? "بوابة الطالب" : "Student Portal", icon: "🎓" };
      case "doctor":
        return { label: lang === "ar" ? "بوابة المحاضر" : "Doctor Portal", icon: "👨‍🏫" };
      case "ta":
        return { label: lang === "ar" ? "بوابة المعيد" : "TA Portal", icon: "🔬" };
      case "owner":
        return { label: lang === "ar" ? "الإدارة الأكاديمية" : "Admin Portal", icon: "⚡" };
      default:
        return null;
    }
  };

  const roleInfo = getRoleBadge();
  const dashboardPath = role ? getAttendanceDashboardRoute(role) : "/";

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-[60] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg"
      >
        {lang === "ar" ? "تخطي إلى المحتوى" : "Skip to content"}
      </a>

      <nav
        ref={menuRef}
        className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl transition-colors duration-200"
        role="navigation"
        aria-label="التنقل الرئيسي"
      >
        <div className="section-container flex items-center justify-between py-3">
          {/* Logo & Role Badge */}
          <div className="flex items-center gap-3">
            <Link
              to={dashboardPath}
              className="group flex items-center gap-2.5 transition-transform duration-200 active:scale-95"
              dir="ltr"
            >
              {/* Cyber Shield Icon */}
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 text-primary shadow-[0_0_15px_hsl(187_92%_45%/0.25)] transition-colors group-hover:border-primary">
                <Shield className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
              </div>

              {/* Title */}
              <span className="font-black text-xl tracking-wider select-none">
                <span className="bg-gradient-to-r from-cyan-400 via-primary to-cyan-300 bg-clip-text text-transparent">
                  CYBER
                </span>
                <span className="text-foreground transition-colors group-hover:text-primary ml-1.5">
                  TMSAH
                </span>
              </span>
            </Link>

            {/* Active Role Badge (if logged in) */}
            {roleInfo && (
              <Link
                to={dashboardPath}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-primary/30 bg-primary/10 text-primary transition-all hover:bg-primary/15"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span>{roleInfo.label}</span>
              </Link>
            )}
          </div>

          {/* Desktop Right Controls: Lang, Theme, User, SignOut */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* User Greeting (if logged in) */}
            {user && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-md text-xs font-semibold text-muted-foreground">
                <User className="w-3.5 h-3.5 text-primary" />
                <span className="max-w-[140px] truncate text-foreground font-bold">
                  {fullName || user.email?.split("@")[0]}
                </span>
              </div>
            )}

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-primary/40 text-xs font-bold transition-all text-foreground"
              title={lang === "en" ? "التبديل إلى العربية" : "Switch to English"}
            >
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span>{lang === "en" ? "عربي" : "EN"}</span>
            </button>

            {/* Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-primary/40 transition-all text-foreground"
              title={isDark ? (lang === "ar" ? "الوضع الفاتح الهادئ" : "Light mode") : (lang === "ar" ? "الوضع الداكن" : "Dark mode")}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-cyan-600 transition-transform duration-200 hover:-rotate-12" />
              )}
            </button>

            {/* Logout / Login button */}
            {user ? (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground text-destructive text-xs font-bold transition-all duration-200"
                title={lang === "ar" ? "تسجيل الخروج" : "Sign Out"}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === "ar" ? "خروج" : "Logout"}</span>
              </button>
            ) : (
              <Link
                to="/"
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-[0_2px_12px_hsl(187_92%_45%/0.3)] hover:opacity-90 transition-all"
              >
                <span>{lang === "ar" ? "تسجيل الدخول" : "Sign In"}</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {/* Quick theme button on mobile header */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/70 bg-card/60 text-foreground"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-600" />}
            </button>

            <button
              className="flex items-center justify-center text-foreground p-2 rounded-xl hover:bg-primary/10 transition-colors"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={open}
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {open && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-4 space-y-3 animate-fade-up">
            {user && (
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">
                    {fullName || user.email?.split("@")[0]}
                  </span>
                </div>
                {roleInfo && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-primary/30 bg-primary/10 text-primary">
                    {roleInfo.label}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  setLang(lang === "en" ? "ar" : "en");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/60 text-sm font-semibold text-foreground"
              >
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span>{lang === "en" ? "اللغة: العربية" : "Language: English"}</span>
              </button>

              {user ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{lang === "ar" ? "تسجيل الخروج" : "Logout"}</span>
                </button>
              ) : (
                <Link
                  to="/"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
                >
                  <span>{lang === "ar" ? "تسجيل الدخول" : "Sign In"}</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;
