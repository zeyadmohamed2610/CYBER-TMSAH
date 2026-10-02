import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  ChevronDown,
  User,
} from "lucide-react";
import { useAttendanceAuth } from "@/features/attendance/context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "@/features/attendance/utils/dashboardRoutes";

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { user, role, fullName, signOut, avatarUrl } = useAttendanceAuth();

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

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserDropdownOpen(false);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleSignOut = async () => {
    setUserDropdownOpen(false);
    await signOut();
    navigate("/", { replace: true });
    setOpen(false);
  };

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
              className="group relative flex items-center gap-2 select-none py-1 transition-transform duration-300 active:scale-95 no-glow !outline-none !ring-0 !border-0 !shadow-none"
              dir="ltr"
              aria-label="CYBER TMSAH Home"
            >
              {/* Soft ambient backlight glow on hover */}
              <div className="absolute -inset-x-3 -inset-y-1.5 rounded-full bg-gradient-to-r from-purple-600/0 via-purple-600/25 to-indigo-600/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none" />

              {/* Wordmark Logo */}
              <div className="relative flex items-center tracking-[0.14em] font-sans drop-shadow-[0_0_15px_rgba(168,85,247,0.35)]">
                {/* CYBER in pure neon white with ambient glow */}
                <span
                  className="font-black text-xl sm:text-2xl text-white tracking-[0.14em] transition-all duration-300"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    textShadow: "0 0 20px rgba(255,255,255,0.4)",
                  }}
                >
                  CYBER
                </span>

                {/* TMSAH in smooth gradient */}
                <span
                  className="font-black text-xl sm:text-2xl tracking-[0.14em] ml-2 transition-all duration-300 group-hover:scale-105 bg-gradient-to-r from-[#F3E8FF] via-[#C084FC] to-[#9333EA] bg-clip-text text-transparent"
                  style={{
                    fontFamily: "'Inter', sans-serif",
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
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-6 h-6 rounded-lg object-cover border border-purple-400/40 shadow-inner shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-inner shrink-0">
                      {userInitial}
                    </div>
                  )}

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
                      {/* Button 0: Profile Page */}
                      <Link
                        to="/profile"
                        onClick={() => setUserDropdownOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:bg-purple-600/15 hover:text-purple-300 transition-all text-start"
                      >
                        <User className="w-4 h-4 text-purple-400" />
                        <span>الملف الشخصي</span>
                      </Link>


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
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-purple-950/40 to-indigo-950/30 border border-purple-500/20 mb-2">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-10 h-10 rounded-xl object-cover border border-purple-400/40 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-black text-base shrink-0">
                      {userInitial}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{displayName}</p>
                    <p className="text-[11px] text-purple-300/80 truncate font-mono" dir="ltr">{user.email}</p>
                  </div>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-white/10 bg-[#0A0F1D]/70 text-sm font-bold text-slate-100 text-start hover:border-purple-500/40"
                >
                  <User className="w-4 h-4 text-purple-400" />
                  <span>الملف الشخصي</span>
                </Link>


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


    </>
  );
};

export default Navbar;
