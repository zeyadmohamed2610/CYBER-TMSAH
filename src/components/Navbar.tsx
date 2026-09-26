import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  Settings,
  ChevronDown,
  CheckCircle2,
  Moon,
  Sun,
} from "lucide-react";
import { useAttendanceAuth } from "@/features/attendance/context/AttendanceAuthContext";
import { useTheme } from "@/context/ThemeContext";
import { getAttendanceDashboardRoute } from "@/features/attendance/utils/dashboardRoutes";

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { user, role, fullName, signOut } = useAttendanceAuth();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

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

  const getRoleLabel = () => {
    if (!role) return null;
    switch (role) {
      case "student":
        return "بوابة الطالب";
      case "doctor":
        return "بوابة المحاضر";
      case "ta":
        return "بوابة المعيد";
      case "owner":
        return "الإدارة الأكاديمية (المالك)";
      case "coordinator":
        return "منسق البرنامج الأكاديمي";
      default:
        return null;
    }
  };

  const roleLabel = getRoleLabel();
  const dashboardPath = role ? getAttendanceDashboardRoute(role) : "/";
  const displayName = fullName || user?.email?.split("@")[0] || "User";
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-[60] focus:bg-purple-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        تخطي إلى المحتوى
      </a>

      {/* Top luminous cyber accent line */}
      <div className="fixed top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/80 to-transparent z-[51] pointer-events-none" />

      <nav
        ref={menuRef}
        className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#060813]/85 backdrop-blur-2xl transition-colors duration-200 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
        role="navigation"
        aria-label="التنقل الرئيسي"
      >
        <div className="section-container flex items-center justify-between py-2.5">
          {/* Glowing Wordmark Logo (Shield & Role Badge removed as requested) */}
          <div className="flex items-center gap-3">
            <Link
              to={dashboardPath}
              className="group relative flex items-center gap-2 select-none py-1 transition-transform duration-300 active:scale-95"
              dir="ltr"
              aria-label="CYBER TMSAH Home"
            >
              {/* Ambient backlight glow on hover */}
              <div className="absolute -inset-x-3 -inset-y-1.5 rounded-2xl bg-gradient-to-r from-purple-600/0 via-purple-600/20 to-indigo-600/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none" />

              {/* Wordmark Logo */}
              <div className="relative flex items-center tracking-[0.14em] font-sans">
                {/* CYBER in pure neon white with ambient glow */}
                <span
                  className="font-black text-xl sm:text-2xl text-white tracking-[0.14em] transition-all duration-300 drop-shadow-[0_2px_14px_rgba(255,255,255,0.3)] group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.65)]"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  CYBER
                </span>

                {/* TMSAH in vibrant purple/violet gradient with radiant drop-shadow */}
                <span
                  className="font-black text-xl sm:text-2xl tracking-[0.14em] ml-2 transition-all duration-300 group-hover:scale-105"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    background: "linear-gradient(135deg, #F3E8FF 0%, #C084FC 45%, #9333EA 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 16px rgba(168,85,247,0.7))",
                  }}
                >
                  TMSAH
                </span>

                {/* Micro cyber spark pulse dot */}
                <span className="relative flex h-2 w-2 ml-1.5 -top-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-r from-purple-400 to-indigo-400 shadow-[0_0_8px_#A855F7]" />
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Right Controls: User Account Popup (Language switcher removed) */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen((v) => !v)}
                  className={`flex items-center gap-2.5 h-10 px-3.5 rounded-2xl border transition-all duration-200 select-none shadow-sm ${
                    userDropdownOpen
                      ? "border-purple-500/70 bg-purple-600/15 shadow-[0_0_24px_rgba(168,85,247,0.3)]"
                      : "border-white/10 bg-[#0A0F1D]/80 hover:bg-[#0E1528] hover:border-purple-500/40 hover:shadow-[0_0_18px_rgba(168,85,247,0.18)]"
                  }`}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                >
                  {/* Avatar Circle */}
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-inner">
                    {userInitial}
                  </div>

                  {/* Name */}
                  <span className="max-w-[140px] truncate text-xs font-bold text-slate-100">
                    {displayName}
                  </span>

                  {/* Arrow Icon */}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      userDropdownOpen ? "rotate-180 text-purple-400" : ""
                    }`}
                  />
                </button>

                {/* Dropdown Popup Card */}
                {userDropdownOpen && (
                  <div
                    className="absolute end-0 top-full mt-2 w-48 rounded-2xl border border-purple-500/25 bg-[#0B0F1D]/95 backdrop-blur-2xl p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-50 animate-fade-up"
                    dir="rtl"
                  >
                    <div className="space-y-1">
                      {/* Button 1: Settings */}
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setProfileModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:bg-purple-600/15 hover:text-purple-300 transition-all text-start"
                      >
                        <Settings className="w-4 h-4 text-purple-400" />
                        <span>الإعدادات</span>
                      </button>

                      {/* Divider */}
                      <div className="my-1 h-px bg-white/10 mx-1" />

                      {/* Button 2: Sign Out */}
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all text-start"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>تسجيل الخروج</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/"
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_28px_rgba(124,58,237,0.5)] hover:scale-[1.02] active:scale-95 transition-all"
              >
                <span>تسجيل الدخول</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              className="flex items-center justify-center text-slate-200 p-2 rounded-xl hover:bg-purple-600/15 transition-colors"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={open}
            >
              {open ? <X className="h-6 w-6 text-purple-400" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {open && (
          <div className="md:hidden border-t border-white/10 bg-[#060813]/95 backdrop-blur-2xl px-4 py-4 space-y-2 animate-fade-up">
            {user ? (
              <>
                <button
                  onClick={() => {
                    setOpen(false);
                    setProfileModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-white/10 bg-[#0A0F1D]/70 text-sm font-bold text-slate-100 text-start hover:border-purple-500/40"
                >
                  <Settings className="w-4 h-4 text-purple-400" />
                  <span>الإعدادات</span>
                </button>

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm font-bold text-start"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </>
            ) : (
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-[0_4px_20px_rgba(124,58,237,0.35)]"
              >
                <span>تسجيل الدخول</span>
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Settings Modal (Refined dark cyberpunk style) */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-up overflow-y-auto"
          dir="rtl"
        >
          <div className="relative w-full max-w-sm sm:max-w-md my-auto rounded-3xl border border-purple-500/30 bg-[#0A0F1D]/95 backdrop-blur-2xl p-5 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.7)] space-y-5">
            {/* Top Close Button */}
            <button
              onClick={() => setProfileModalOpen(false)}
              className="absolute top-4 start-4 sm:top-5 sm:start-5 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile Info Header */}
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-[0_0_24px_rgba(168,85,247,0.4)] shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-black text-white truncate">{displayName}</h3>
                <p className="text-xs text-slate-400 truncate">{user?.email || "cyber.user"}</p>
                {roleLabel && (
                  <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-purple-500/40 bg-purple-600/15 text-purple-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    <span>{roleLabel}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="h-px bg-white/10" />

            {/* Account Details */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                بيانات الحساب
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-slate-400 block text-[10px] mb-1">
                    معرف المستخدم
                  </span>
                  <span className="font-mono font-bold text-white text-xs truncate block">
                    {user?.id ? `${user.id.slice(0, 8)}…` : "—"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-slate-400 block text-[10px] mb-1">
                    حالة الأمان
                  </span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>مشفر ونشط</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Appearance Preferences */}
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                المظهر
              </h4>

              {/* Theme Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl text-xs font-bold border transition-all ${
                    isDark
                      ? "border-purple-500 bg-purple-600/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                      : "border-white/10 bg-black/40 text-slate-400 hover:text-white"
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>الوضع الداكن (الافتراضي)</span>
                </button>
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl text-xs font-bold border transition-all ${
                    !isDark
                      ? "border-purple-500 bg-purple-600/20 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                      : "border-white/10 bg-black/40 text-slate-400 hover:text-white"
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>الوضع الفاتح</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions: Close & Sign Out */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => setProfileModalOpen(false)}
                className="flex-1 h-10 sm:h-11 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs font-bold hover:bg-white/10 transition-all"
              >
                إغلاق
              </button>
              <button
                onClick={handleSignOut}
                className="h-10 sm:h-11 px-4 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
