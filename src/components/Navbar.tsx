import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  Globe,
  Shield,
  Settings,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { useAttendanceAuth } from "@/features/attendance/context/AttendanceAuthContext";
import { useLang } from "@/i18n";
import { getAttendanceDashboardRoute } from "@/features/attendance/utils/dashboardRoutes";

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { user, role, fullName, signOut } = useAttendanceAuth();
  const { lang, setLang, isRTL } = useLang();

  // Close dropdown on outside click
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [userDropdownOpen]);

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

  // Prevent scroll when mobile menu or modal is open
  useEffect(() => {
    document.body.style.overflow = open || profileModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, profileModalOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserDropdownOpen(false);
        setProfileModalOpen(false);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleSignOut = async () => {
    setUserDropdownOpen(false);
    setProfileModalOpen(false);
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
  const displayName = fullName || user?.email?.split("@")[0] || "User";
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-[60] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg"
      >
        {lang === "ar" ? "تخطي إلى المحتوى" : "Skip to content"}
      </a>

      {/* Top subtle cyan accent line */}
      <div className="fixed top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/70 to-transparent z-[51] pointer-events-none" />

      <nav
        ref={menuRef}
        className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-2xl transition-colors duration-200 shadow-sm"
        role="navigation"
        aria-label="التنقل الرئيسي"
      >
        <div className="section-container flex items-center justify-between py-2.5">
          {/* Logo & Role Badge */}
          <div className="flex items-center gap-3">
            <Link
              to={dashboardPath}
              className="group flex items-center gap-2.5 transition-transform duration-200 active:scale-95"
              dir="ltr"
            >
              {/* Cyber Shield Icon */}
              <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 text-primary shadow-[0_0_20px_hsl(var(--primary)/0.25)] transition-all duration-300 group-hover:border-primary group-hover:shadow-[0_0_28px_hsl(var(--primary)/0.4)]">
                <Shield className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-ping" />
              </div>

              {/* Title */}
              <span className="font-black text-xl tracking-wider select-none">
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_hsl(var(--primary)/0.3)]">
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
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-primary/30 bg-primary/10 text-primary transition-all hover:bg-primary/20 hover:scale-105"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span>{roleInfo.label}</span>
              </Link>
            )}
          </div>

          {/* Desktop Right Controls: Lang, Theme, User Account Popup */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 text-xs font-bold transition-all text-foreground shadow-sm"
              title={lang === "en" ? "التبديل إلى العربية" : "Switch to English"}
            >
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{lang === "en" ? "عربي" : "EN"}</span>
            </button>



            {/* User Account Button with Dropdown Popup */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen((v) => !v)}
                  className={`flex items-center gap-2.5 h-10 px-3.5 rounded-2xl border transition-all duration-200 select-none shadow-sm ${
                    userDropdownOpen
                      ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.25)]"
                      : "border-border/80 bg-card/70 hover:bg-card hover:border-primary/50"
                  }`}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                >
                  {/* Avatar Circle */}
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-primary to-violet-400 flex items-center justify-center text-primary-foreground font-black text-xs shadow-inner">
                    {userInitial}
                  </div>

                  {/* Name */}
                  <span className="max-w-[140px] truncate text-xs font-bold text-foreground">
                    {displayName}
                  </span>

                  {/* Arrow Icon */}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                      userDropdownOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>

                {/* ── Dropdown Popup Card (Strictly 2 buttons: Settings & Sign Out) ── */}
                {userDropdownOpen && (
                  <div
                    className="absolute end-0 top-full mt-2 w-44 rounded-2xl border border-border/90 bg-card/95 backdrop-blur-2xl p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)] z-50 animate-fade-up"
                    dir={isRTL ? "rtl" : "ltr"}
                  >
                    <div className="space-y-0.5">
                      {/* Button 1: Settings */}
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setProfileModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-all text-start"
                      >
                        <Settings className="w-4 h-4 text-primary" />
                        <span>{lang === "ar" ? "الإعدادات" : "Settings"}</span>
                      </button>

                      {/* Divider */}
                      <div className="my-1 h-px bg-border/60 mx-1" />

                      {/* Button 2: Sign Out */}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 transition-all text-start"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{lang === "ar" ? "تسجيل الخروج" : "Sign Out"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/"
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-[0_4px_16px_hsl(var(--primary)/0.35)] hover:opacity-90 transition-all"
              >
                <span>{lang === "ar" ? "تسجيل الدخول" : "Sign In"}</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">


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

        {/* Mobile menu drawer */}
        {open && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-4 space-y-2 animate-fade-up">
            {/* Mobile Actions: ONLY Settings & Sign Out */}
            {user && (
              <button
                onClick={() => {
                  setOpen(false);
                  setProfileModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-border/70 bg-card/60 text-sm font-bold text-foreground text-start hover:border-primary/50"
              >
                <Settings className="w-4 h-4 text-primary" />
                <span>{lang === "ar" ? "الإعدادات" : "Settings"}</span>
              </button>
            )}

            <button
              onClick={() => {
                setLang(lang === "en" ? "ar" : "en");
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-border/70 bg-card/60 text-sm font-semibold text-foreground text-start"
            >
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span>{lang === "en" ? "اللغة: العربية" : "Language: English"}</span>
            </button>

            {user ? (
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-bold text-start"
              >
                <LogOut className="w-4 h-4" />
                <span>{lang === "ar" ? "تسجيل الخروج" : "Sign Out"}</span>
              </button>
            ) : (
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
              >
                <span>{lang === "ar" ? "تسجيل الدخول" : "Sign In"}</span>
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* ── Settings Modal (Responsive on Phone & PC) ── */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-4 bg-black/65 backdrop-blur-md animate-fade-up overflow-y-auto"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="relative w-full max-w-sm sm:max-w-md my-auto rounded-3xl border border-primary/20 bg-card/95 backdrop-blur-2xl p-5 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.55)] space-y-5">
            {/* Top Close Button */}
            <button
              onClick={() => setProfileModalOpen(false)}
              className="absolute top-4 end-4 sm:top-5 sm:end-5 w-8 h-8 rounded-full border border-border/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile Info Header */}
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-primary to-violet-400 flex items-center justify-center text-primary-foreground font-black text-xl sm:text-2xl shadow-[0_0_24px_hsl(var(--primary)/0.35)] shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-black text-foreground truncate">{displayName}</h3>
                <p className="text-xs text-muted-foreground truncate">{user?.email || "cyber.user"}</p>
                {roleInfo && (
                  <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-primary/30 bg-primary/10 text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span>{roleInfo.label}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="h-px bg-border/60" />

            {/* Account Details */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {lang === "ar" ? "بيانات الحساب" : "Account Details"}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-background/50 border border-border/50">
                  <span className="text-muted-foreground block text-[10px] mb-1">
                    {lang === "ar" ? "معرف المستخدم" : "User ID"}
                  </span>
                  <span className="font-mono font-bold text-foreground text-xs truncate block">
                    {user?.id ? `${user.id.slice(0, 8)}…` : "—"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-background/50 border border-border/50">
                  <span className="text-muted-foreground block text-[10px] mb-1">
                    {lang === "ar" ? "حالة الأمان" : "Security"}
                  </span>
                  <span className="font-bold text-green-500 flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === "ar" ? "مشفر ونشط" : "Active"}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Appearance Preferences */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {lang === "ar" ? "المظهر واللغة" : "Theme & Language"}
              </h4>

              {/* Theme Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl text-xs font-bold border transition-all ${
                    isDark
                      ? "border-primary bg-primary/15 text-primary shadow-[0_0_15px_hsl(var(--primary)/0.25)]"
                      : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>{lang === "ar" ? "الوضع الداكن" : "Dark"}</span>
                </button>
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl text-xs font-bold border transition-all ${
                    !isDark
                      ? "border-primary bg-primary/15 text-primary shadow-[0_0_15px_hsl(var(--primary)/0.25)]"
                      : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>{lang === "ar" ? "الوضع الفاتح" : "Light"}</span>
                </button>
              </div>

              {/* Language Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setLang("ar")}
                  className={`flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl text-xs font-bold border transition-all ${
                    lang === "ar"
                      ? "border-primary bg-primary/15 text-primary shadow-[0_0_15px_hsl(var(--primary)/0.25)]"
                      : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>العربية</span>
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={`flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl text-xs font-bold border transition-all ${
                    lang === "en"
                      ? "border-primary bg-primary/15 text-primary shadow-[0_0_15px_hsl(var(--primary)/0.25)]"
                      : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>English</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions: Close & Sign Out */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => setProfileModalOpen(false)}
                className="flex-1 h-10 sm:h-11 rounded-xl bg-card border border-border/80 text-foreground text-xs font-bold hover:bg-background transition-all"
              >
                {lang === "ar" ? "إغلاق" : "Close"}
              </button>
              <button
                onClick={handleSignOut}
                className="h-10 sm:h-11 px-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive hover:text-destructive-foreground text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === "ar" ? "تسجيل الخروج" : "Sign Out"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
