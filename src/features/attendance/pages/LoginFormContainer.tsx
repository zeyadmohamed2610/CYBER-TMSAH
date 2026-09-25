import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "../utils/dashboardRoutes";
import { useLang } from "@/i18n";

import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import { CustomRoleSelect } from "@/features/auth/components/CustomRoleSelect";
import { ForgotPasswordModal } from "@/features/auth/components/ForgotPasswordModal";
import { playCyberSuccessChime } from "@/features/auth/utils/cyberAudio";
import { recordAuditLog } from "@/features/auth/services/auditService";

type Tab = "login" | "join";
type JoinRole = "student" | "doctor" | "ta";

const STORAGE_KEY = "attendance_login_attempts";
const REMEMBER_KEY = "cyber_remember_user";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function getLockoutRemaining(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const { count, firstAttempt } = JSON.parse(raw) as { count: number; firstAttempt: number };
    if (count >= MAX_ATTEMPTS) {
      const remaining = LOCKOUT_MS - (Date.now() - firstAttempt);
      return remaining > 0 ? remaining : 0;
    }
  } catch { /**/ }
  return 0;
}

function recordAttempt(success: boolean): void {
  if (success) { localStorage.removeItem(STORAGE_KEY); return; }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev = raw
      ? (JSON.parse(raw) as { count: number; firstAttempt: number })
      : { count: 0, firstAttempt: Date.now() };
    const expired = Date.now() - prev.firstAttempt > LOCKOUT_MS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      expired ? { count: 1, firstAttempt: Date.now() } : { ...prev, count: prev.count + 1 }
    ));
  } catch { /**/ }
}

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           "#050B17",
  leftBg:       "linear-gradient(155deg,#0B1A30 0%,#070F1E 100%)",
  rightBg:      "#08101E",
  accent:       "#3B82F6",
  accentHover:  "#2563EB",
  accentMuted:  "rgba(59,130,246,0.12)",
  accentBorder: "rgba(59,130,246,0.22)",
  divider:      "rgba(255,255,255,0.06)",
  fieldBg:      "rgba(255,255,255,0.04)",
  fieldBorder:  "rgba(255,255,255,0.09)",
  fieldFocusBg: "rgba(59,130,246,0.06)",
  fieldFocusRing:"0 0 0 2px rgba(59,130,246,0.28)",
  text:         "#E2E8F0",
  muted:        "#64748B",
  subtle:       "#94A3B8",
  cardBg:       "rgba(255,255,255,0.03)",
  cardBorder:   "rgba(255,255,255,0.07)",
  error:        "rgba(239,68,68,0.12)",
  errorBorder:  "rgba(239,68,68,0.28)",
  errorText:    "#FCA5A5",
  warn:         "rgba(245,158,11,0.1)",
  warnBorder:   "rgba(245,158,11,0.25)",
  warnText:     "#FCD34D",
} as const;

// ── Minimal Icons ─────────────────────────────────────────────────────────────
const Ic = {
  Logo: () => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="28" height="28" rx="7" fill={C.accent} fillOpacity=".15" stroke={C.accent} strokeOpacity=".4" strokeWidth="1.5"/>
      <path d="M16 6L7 10v8c0 6.3 4.8 12.2 9 13.8 4.2-1.6 9-7.5 9-13.8V10L16 6z"
        fill={C.accent} fillOpacity=".2" stroke={C.accent} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M12 16l3 3 5-6" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  User: ({ s = 15 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M3 17c0-3.314 2.686-6 6-6h2c3.314 0 6 2.686 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Lock: ({ s = 15 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="10" cy="13.5" r="1.2" fill="currentColor"/>
    </svg>
  ),
  Eye: ({ off, s = 15 }: { off?: boolean; s?: number }) => off ? (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M3 3l14 14M8.5 8.7A3 3 0 0111.3 11.5M6.4 6.5C4.7 7.7 3.5 9 3.5 10c0 2 3 5 6.5 5 1.3 0 2.5-.4 3.5-1M10 5c3.5 0 6.5 3 6.5 5 0 .7-.3 1.5-.9 2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ) : (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <ellipse cx="10" cy="10" rx="8.5" ry="5.5" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  Login: ({ s = 15 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4M9 14l4-4-4-4M13 10H3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  UserPlus: ({ s = 15 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 17c0-3.314 2.686-6 6-6M15 10v6M12 13h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Globe: ({ s = 14 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10 2c-2 2.5-3 5-3 8s1 5.5 3 8M10 2c2 2.5 3 5 3 8s-1 5.5-3 8M2 10h16" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  Warn: ({ s = 15 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M8.69 3.41L1.84 15.5A1.5 1.5 0 003.14 17.5h13.7a1.5 1.5 0 001.3-2.24L11.3 3.41a1.5 1.5 0 00-2.6 0z" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Check: ({ s = 32 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6.5 10l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Tag: ({ s = 15 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 3H4a1 1 0 00-1 1v6l7 7 7-7-7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="7" cy="8" r="1" fill="currentColor"/>
    </svg>
  ),
  Hash: ({ s = 15 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M4 8h12M4 12h12M8 4l-1.5 12M11.5 4L10 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ── Clean Field Component ─────────────────────────────────────────────────────
function Field({
  id, label, type = "text", value, onChange, placeholder,
  required, autoComplete, dir = "ltr", icon, suffix, badge,
  inputRef, autoFocus, onKeyDown,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean;
  autoComplete?: string; dir?: "ltr" | "rtl";
  icon?: React.ReactNode; suffix?: React.ReactNode; badge?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id}
          className="text-[10.5px] font-semibold tracking-[0.08em] uppercase select-none transition-colors duration-150"
          style={{ color: focused ? C.accent : C.subtle }}>
          {label}
        </label>
        {badge}
      </div>
      <div className="relative">
        {icon && (
          <span className="absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 transition-colors duration-150"
            style={{ color: focused ? C.accent : C.muted }}>
            {icon}
          </span>
        )}
        <input
          ref={inputRef}
          id={id} type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          autoComplete={autoComplete} dir={dir}
          autoFocus={autoFocus} onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            paddingInlineStart: icon ? "2.5rem" : "0.875rem",
            paddingInlineEnd: suffix ? "3rem" : "0.875rem",
            background: focused ? C.fieldFocusBg : C.fieldBg,
            border: `1px solid ${focused ? "rgba(59,130,246,0.5)" : C.fieldBorder}`,
            color: C.text,
            boxShadow: focused ? C.fieldFocusRing : "none",
            outline: "none",
            transition: "all 0.15s ease",
          }}
          className="w-full h-10 rounded-lg text-sm font-medium placeholder:text-slate-600"
        />
        {suffix && <span className="absolute end-3 top-1/2 -translate-y-1/2 z-10">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Left Branding Panel ───────────────────────────────────────────────────────
function BrandPanel({ lang, isRTL }: { lang: string; isRTL: boolean }) {
  return (
    <div className="hidden lg:flex flex-col justify-between h-full relative overflow-hidden p-10 xl:p-14"
      style={{ background: C.leftBg, borderInlineEnd: `1px solid ${C.divider}` }}>

      {/* Architectural grid lines decoration */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(59,130,246,0.05)" strokeWidth="1"/>
          </pattern>
          <radialGradient id="fadeGrid" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="1"/>
            <stop offset="100%" stopColor="white" stopOpacity="0"/>
          </radialGradient>
          <mask id="gridMask">
            <rect width="100%" height="100%" fill="url(#fadeGrid)"/>
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" mask="url(#gridMask)"/>
        {/* Accent line */}
        <line x1="0" y1="0" x2="0" y2="100%" stroke={C.accent} strokeOpacity="0.2" strokeWidth="1"/>
      </svg>

      {/* Top: Logo + wordmark */}
      <div className="relative z-10 flex items-center gap-3">
        <Ic.Logo />
        <div>
          <div className="text-[13px] font-black tracking-[0.2em] text-white" dir="ltr">
            CYBER<span style={{ color: C.accent }}>·</span>TMSAH
          </div>
          <div className="text-[10px] tracking-widest font-medium mt-0.5" style={{ color: C.muted }}>
            {lang === "ar" ? "نظام الحضور والمتابعة" : "ATTENDANCE SYSTEM"}
          </div>
        </div>
      </div>

      {/* Center: Main headline */}
      <div className="relative z-10 space-y-5">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: C.accentMuted, border: `1px solid ${C.accentBorder}`, color: C.accent }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"/>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"/>
            </span>
            {lang === "ar" ? "النظام متاح الآن" : "System Online"}
          </div>

          <h1 className="font-black leading-[1.1] tracking-tight"
            style={{ color: C.text, fontSize: "clamp(2rem,3vw,2.75rem)" }}>
            {lang === "ar"
              ? (<>منصة التعليم<br /><span style={{ color: C.accent }}>الرقمي</span> المتكاملة</>)
              : (<>The Integrated<br /><span style={{ color: C.accent }}>Academic</span> Platform</>)}
          </h1>

          <p className="text-sm leading-relaxed max-w-xs" style={{ color: C.muted }}>
            {lang === "ar"
              ? "إدارة الحضور والغياب، الجداول، والمواد الدراسية في مكان واحد."
              : "Manage attendance, schedules, and course materials — all in one place."}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex gap-5 pt-2">
          {[
            { n: "2,400+", label: lang === "ar" ? "طالب" : "Students" },
            { n: "40+",    label: lang === "ar" ? "دكتور" : "Faculty" },
            { n: "99.9%",  label: lang === "ar" ? "وقت التشغيل" : "Uptime" },
          ].map(({ n, label }) => (
            <div key={label}>
              <div className="text-lg font-black" style={{ color: C.text }}>{n}</div>
              <div className="text-[11px] font-medium" style={{ color: C.muted }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: University name */}
      <div className="relative z-10">
        <div className="h-px mb-4" style={{ background: C.divider }}/>
        <p className="text-[11px] font-medium" style={{ color: C.muted }}>
          {lang === "ar"
            ? "جامعة حلوان التكنولوجية الدولية · كلية الحاسبات"
            : "Helwan International Technological University"}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "rgba(100,116,139,0.6)" }}>
          © 2026 CYBER TMSAH
        </p>
      </div>
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAttendanceAuth();
  const { t, lang, setLang, isRTL, interpolate } = useLang();

  const [tab, setTab]                     = useState<Tab>("login");
  const [lockRemaining, setLockRemaining] = useState(getLockoutRemaining);
  const passInputRef                      = useRef<HTMLInputElement>(null);

  const [username, setUsername]           = useState("");
  const [password, setPassword]           = useState("");
  const [showPass, setShowPass]           = useState(false);
  const [rememberMe, setRememberMe]       = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [loginError, setLoginError]       = useState<string | null>(null);
  const [loginLoading, setLoginLoading]   = useState(false);

  const [joinRole, setJoinRole]           = useState<JoinRole>("student");
  const [fullName, setFullName]           = useState("");
  const [joinUsername, setJoinUsername]   = useState("");
  const [joinPassword, setJoinPassword]   = useState("");
  const [showJoinPass, setShowJoinPass]   = useState(false);
  const [seatNumber, setSeatNumber]       = useState("");
  const [sectionNumber, setSectionNumber] = useState("");
  const [rankInList, setRankInList]       = useState("");
  const [joinLoading, setJoinLoading]     = useState(false);
  const [joinSuccess, setJoinSuccess]     = useState(false);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(REMEMBER_KEY);
      if (savedUser) { setUsername(savedUser); setRememberMe(true); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (lockRemaining <= 0) return;
    const timer = setInterval(() => {
      const r = getLockoutRemaining();
      setLockRemaining(r);
      if (!r) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockRemaining]);

  useEffect(() => {
    if (!loading && user && role) navigate(getAttendanceDashboardRoute(role), { replace: true });
  }, [loading, navigate, role, user]);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: C.bg }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.accent }}/>
        <p className="text-sm font-medium" style={{ color: C.muted }}>{t.common.loading}</p>
      </div>
    </div>
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockRemaining > 0) return;
    setLoginLoading(true); setLoginError(null);

    const rawIdentifier = username.trim();
    let email = rawIdentifier;

    if (!email.includes("@")) {
      const { data: resolvedEmail } = await supabase.rpc("resolve_login_identifier", { p_identifier: email });
      email = resolvedEmail || null;
      if (!email) {
        recordAttempt(false);
        setLockRemaining(getLockoutRemaining());
        await recordAuditLog({ action: "login_failed", identifier: rawIdentifier, notes: "user_not_found" });
        setLoginError(lang === "ar"
          ? "⚠️ لم يتم العثور على حساب بهذا المعرّف."
          : "⚠️ No account found with this identifier.");
        setLoginLoading(false);
        return;
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      recordAttempt(false);
      setLockRemaining(getLockoutRemaining());
      const isWrongPassword = error.message?.toLowerCase().includes("invalid") || error.message?.toLowerCase().includes("password");
      const specificMsg = isWrongPassword
        ? (lang === "ar" ? "🔑 كلمة المرور غير صحيحة." : "🔑 Incorrect password.")
        : (lang === "ar" ? "❌ فشل تسجيل الدخول. حاول مرة أخرى." : "❌ Sign-in failed. Please try again.");
      await recordAuditLog({ action: "login_failed", identifier: rawIdentifier, notes: isWrongPassword ? "wrong_password" : error.message });
      setLoginError(specificMsg);
      setLoginLoading(false);
      return;
    }

    try {
      rememberMe ? localStorage.setItem(REMEMBER_KEY, rawIdentifier) : localStorage.removeItem(REMEMBER_KEY);
    } catch { /* ignore */ }

    playCyberSuccessChime();
    await recordAuditLog({ action: "login_success", identifier: rawIdentifier });
    recordAttempt(true);
    navigate("/attendance", { replace: true });
    setLoginLoading(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault(); setJoinLoading(true);
    const { error } = await supabase.from("join_requests").insert({
      full_name: fullName.trim(), username: joinUsername.trim(), role: joinRole,
      seat_number: seatNumber.trim() || null,
      section_number: sectionNumber ? parseInt(sectionNumber) : null,
      rank_in_list: rankInList ? parseInt(rankInList) : null,
    });
    if (error) {
      toast.error(lang === "ar" ? "فشل إرسال الطلب." : "Failed to submit.");
      setJoinLoading(false);
      return;
    }
    await recordAuditLog({ action: "join_request", identifier: joinUsername.trim(), role: joinRole });
    setJoinSuccess(true);
    toast.success(t.auth.requestSent);
    setJoinLoading(false);
  };

  const lockMinutes   = Math.ceil(lockRemaining / 60_000);
  const isStudent     = joinRole === "student";

  // Smart identifier badge
  const getUsernameBadge = () => {
    const v = username.trim();
    if (!v) return null;
    if (/^[0-9]+$/.test(v)) return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
        style={{ background: C.accentMuted, color: C.accent, border: `1px solid ${C.accentBorder}` }}>
        {lang === "ar" ? "رقم" : "ID"}
      </span>
    );
    if (v.includes("@")) return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
        style={{ background: "rgba(16,185,129,0.1)", color: "#34D399", border: "1px solid rgba(16,185,129,0.25)" }}>
        {lang === "ar" ? "بريد" : "Email"}
      </span>
    );
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
        style={{ background: C.fieldBg, color: C.muted, border: `1px solid ${C.fieldBorder}` }}>
        {lang === "ar" ? "مستخدم" : "User"}
      </span>
    );
  };

  // ── Shared button style ────────────────────────────────────────────────────
  const btnStyle: React.CSSProperties = {
    background: C.accent,
    color: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(59,130,246,0.2)",
    transition: "all 0.15s ease",
  };

  return (
    <div
      className="min-h-[100dvh] w-full flex"
      dir={isRTL ? "rtl" : "ltr"}
      style={{ background: C.bg, fontFamily: "'Inter', 'Cairo', sans-serif" }}>

      {/* ── LEFT: Branding Panel ── */}
      <BrandPanel lang={lang} isRTL={isRTL} />

      {/* ── RIGHT: Form Panel ── */}
      <div className="flex-1 flex flex-col min-h-[100dvh] overflow-y-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
          {/* Mobile-only logo */}
          <div className="flex lg:hidden items-center gap-2">
            <Ic.Logo />
            <span className="text-[12px] font-black tracking-[0.18em]" style={{ color: C.text }} dir="ltr">
              CYBER<span style={{ color: C.accent }}>·</span>TMSAH
            </span>
          </div>
          <div className="hidden lg:block"/>

          {/* Lang toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
            style={{ background: C.fieldBg, border: `1px solid ${C.fieldBorder}`, color: C.subtle }}
            title={lang === "en" ? "التبديل إلى العربية" : "Switch to English"}>
            <Ic.Globe />
            {lang === "en" ? "عربي" : "EN"}
          </button>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-5 py-8">
          <div className="w-full max-w-[400px]" style={{ animation: "fadeUp .35s ease forwards" }}>

            {/* ── Page header (mobile shows, desktop optional) ── */}
            <div className="mb-6">
              <h2 className="text-2xl font-black leading-tight" style={{ color: C.text }}>
                {tab === "login"
                  ? (lang === "ar" ? "تسجيل الدخول" : "Sign In")
                  : (lang === "ar" ? "طلب الانضمام" : "Request Access")}
              </h2>
              <p className="text-sm mt-1" style={{ color: C.muted }}>
                {tab === "login"
                  ? (lang === "ar" ? "أدخل بيانات حسابك للمتابعة" : "Enter your credentials to continue")
                  : (lang === "ar" ? "أرسل طلبك وسيتم مراجعته" : "Submit a request and we'll review it")}
              </p>
            </div>

            {/* ── Tab Switcher ── */}
            <div className="flex rounded-xl p-1 mb-5"
              style={{ background: C.fieldBg, border: `1px solid ${C.fieldBorder}` }}>
              {(["login", "join"] as Tab[]).map(tb => (
                <button key={tb} onClick={() => setTab(tb)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer"
                  style={{
                    background: tab === tb ? C.accent : "transparent",
                    color: tab === tb ? "#fff" : C.muted,
                    boxShadow: tab === tb ? "0 1px 6px rgba(59,130,246,0.35)" : "none",
                  }}>
                  {tb === "login" ? <><Ic.Login />{t.auth.signIn}</> : <><Ic.UserPlus />{t.auth.joinTitle}</>}
                </button>
              ))}
            </div>

            {/* ═══ LOGIN TAB ═══ */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">

                {/* Lockout warning */}
                {lockRemaining > 0 && (
                  <div className="flex gap-2.5 p-3 rounded-xl text-xs font-medium"
                    style={{ background: C.warn, border: `1px solid ${C.warnBorder}`, color: C.warnText }}>
                    <Ic.Warn s={14}/>
                    <span>{interpolate(t.auth.lockedOutTimer, { minutes: lockMinutes })}</span>
                  </div>
                )}

                <Field
                  id="l-user"
                  label={t.auth.username}
                  value={username}
                  onChange={setUsername}
                  placeholder={t.auth.usernamePlaceholder}
                  required
                  autoComplete="username"
                  autoFocus={typeof window !== "undefined" && window.innerWidth >= 768}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); passInputRef.current?.focus(); } }}
                  badge={getUsernameBadge()}
                  icon={<Ic.User />}
                />

                <Field
                  id="l-pass"
                  label={t.auth.password}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder={t.auth.passwordPlaceholder}
                  required
                  autoComplete="current-password"
                  inputRef={passInputRef}
                  icon={<Ic.Lock />}
                  suffix={
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="transition-colors p-0.5 cursor-pointer"
                      style={{ color: C.muted }}
                      title={showPass ? (lang === "ar" ? "إخفاء" : "Hide") : (lang === "ar" ? "إظهار" : "Show")}>
                      <Ic.Eye off={showPass}/>
                    </button>
                  }
                />

                {/* Remember me + Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-medium" style={{ color: C.muted }}>
                      {lang === "ar" ? "تذكرني" : "Remember me"}
                    </span>
                  </label>
                  <button type="button" onClick={() => setShowForgotModal(true)}
                    className="text-xs font-semibold transition-colors cursor-pointer"
                    style={{ color: C.accent }}>
                    {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                  </button>
                </div>

                {/* Error */}
                {loginError && (
                  <div role="alert" className="flex items-start gap-2 p-3 rounded-xl text-xs font-medium"
                    style={{ background: C.error, border: `1px solid ${C.errorBorder}`, color: C.errorText }}>
                    <Ic.Warn s={14}/>
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Submit */}
                <button type="submit" disabled={loginLoading || lockRemaining > 0}
                  className="w-full h-10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  style={btnStyle}
                  onMouseEnter={e => { if (!loginLoading) (e.currentTarget as HTMLButtonElement).style.background = C.accentHover; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.accent; }}>
                  {loginLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin"/><span>{t.auth.signingIn}</span></>
                    : <><Ic.Login /><span>{t.auth.signIn}</span></>}
                </button>

                <p className="text-center text-xs" style={{ color: C.muted }}>
                  {lang === "ar" ? "ليس لديك حساب؟" : "No account?"}{" "}
                  <button type="button" onClick={() => setTab("join")}
                    className="font-semibold transition-colors cursor-pointer hover:underline"
                    style={{ color: C.accent }}>
                    {t.auth.joinTitle}
                  </button>
                </p>
              </form>
            )}

            {/* ═══ JOIN TAB ═══ */}
            {tab === "join" && (
              joinSuccess ? (
                <div className="flex flex-col items-center gap-5 py-8 text-center">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl"
                    style={{ background: C.accentMuted, border: `1px solid ${C.accentBorder}` }}>
                    <span style={{ color: C.accent }}><Ic.Check s={30}/></span>
                  </div>
                  <div>
                    <h3 className="text-base font-black" style={{ color: C.text }}>
                      {lang === "ar" ? "تم الإرسال!" : "Request Sent!"}
                    </h3>
                    <p className="text-sm mt-1" style={{ color: C.muted }}>{t.auth.requestSent}</p>
                  </div>
                  <button onClick={() => { setJoinSuccess(false); setTab("login"); }}
                    className="h-9 px-6 rounded-xl text-sm font-bold cursor-pointer active:scale-[0.98]"
                    style={btnStyle}>
                    {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoin} className="space-y-3.5">
                  <Field id="j-name" label={t.auth.fullName} value={fullName} onChange={setFullName}
                    placeholder={t.auth.fullNamePlaceholder} required dir={isRTL ? "rtl" : "ltr"}
                    icon={<Ic.User />}/>

                  <Field id="j-user" label={t.auth.username} value={joinUsername} onChange={setJoinUsername}
                    placeholder={t.auth.usernamePlaceholder} required autoComplete="username"
                    icon={<Ic.User />}/>

                  <div>
                    <Field id="j-pass" label={t.auth.password} type={showJoinPass ? "text" : "password"}
                      value={joinPassword} onChange={setJoinPassword}
                      placeholder={t.auth.passwordPlaceholder} required autoComplete="new-password"
                      icon={<Ic.Lock />}
                      suffix={
                        <button type="button" onClick={() => setShowJoinPass(v => !v)}
                          className="transition-colors p-0.5 cursor-pointer" style={{ color: C.muted }}>
                          <Ic.Eye off={showJoinPass}/>
                        </button>
                      }/>
                    <PasswordStrengthMeter password={joinPassword} lang={lang}/>
                  </div>

                  <CustomRoleSelect
                    id="j-role"
                    label={t.auth.chooseRole}
                    value={joinRole}
                    onChange={v => setJoinRole(v as JoinRole)}
                    icon={<Ic.Tag />}
                    options={[
                      { value: "student", label: t.auth.student, icon: "🎓" },
                      { value: "doctor",  label: t.auth.doctor,  icon: "🩺" },
                      { value: "ta",      label: t.auth.ta,      icon: "💼" },
                    ]}
                    labelColor={C.subtle}
                    fieldBg={C.fieldBg}
                    fieldBorder={C.fieldBorder}
                    fieldFocus={C.fieldFocusBg}
                    fieldGlow={C.fieldFocusRing}
                    textColor={C.text}
                    faintColor={C.muted}
                    isRTL={isRTL}
                  />

                  {isStudent && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field id="j-seat" label={t.auth.seatNumber} value={seatNumber} onChange={setSeatNumber}
                        placeholder={t.auth.seatNumberPlaceholder} icon={<Ic.Hash />}/>
                      <Field id="j-sec" label={t.auth.sectionNumber} type="number" value={sectionNumber}
                        onChange={setSectionNumber} placeholder={t.auth.sectionPlaceholder} icon={<Ic.Hash />}/>
                    </div>
                  )}

                  {isStudent && (
                    <Field id="j-rank" label={t.auth.rankInList} type="number" value={rankInList}
                      onChange={setRankInList} placeholder={t.auth.rankPlaceholder} icon={<Ic.Hash />}/>
                  )}

                  <button type="submit" disabled={joinLoading}
                    className="w-full h-10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    style={btnStyle}>
                    {joinLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin"/><span>{t.auth.submitting}</span></>
                      : <><Ic.UserPlus /><span>{t.auth.submitRequest}</span></>}
                  </button>

                  <p className="text-center text-xs" style={{ color: C.muted }}>
                    {lang === "ar" ? "لديك حساب؟" : "Have an account?"}{" "}
                    <button type="button" onClick={() => setTab("login")}
                      className="font-semibold transition-colors cursor-pointer hover:underline"
                      style={{ color: C.accent }}>
                      {t.auth.signIn}
                    </button>
                  </p>
                </form>
              )
            )}

          </div>
        </div>

        {/* Bottom footer (mobile only) */}
        <div className="lg:hidden shrink-0 pb-5 text-center">
          <p className="text-[10px] font-medium" style={{ color: "rgba(100,116,139,0.5)" }}>
            © 2026 CYBER TMSAH · {lang === "ar" ? "جامعة حلوان التكنولوجية الدولية" : "Helwan International Technological University"}
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        lang={lang}
        isRTL={isRTL}
      />

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: #334155; }
        input[type="number"]::-webkit-inner-spin-button { opacity: 0; }
      `}</style>
    </div>
  );
};

export default LoginPage;
