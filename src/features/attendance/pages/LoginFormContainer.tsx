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

// ────────────────────────────────────────────────────────────────────────────
// Icons
// ────────────────────────────────────────────────────────────────────────────
const Icon = {
  User: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Lock: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
    </svg>
  ),
  Eye: ({ off }: { off?: boolean }) => off ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18M10.5 10.7a3 3 0 004 3.8M7.4 7.6C5.3 9 4 11 4 12c0 2.5 3.6 6 8 6a9 9 0 004.6-1.4M12 6c4.4 0 8 3.5 8 6 0 .9-.4 1.9-1.1 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="12" rx="10" ry="6.5" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  Hash: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 9h16M4 15h16M9 4l-2 16M15 4l-2 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Tag: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 2H6a2 2 0 00-2 2v6l8 8 8-8-8-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor"/>
    </svg>
  ),
  LogIn: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  UserPlus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M2 20c0-4 3.13-7 7-7M19 10v6M16 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Globe: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 3c-2.5 3-4 6-4 9s1.5 6 4 9M12 3c2.5 3 4 6 4 9s-1.5 6-4 9M3 12h18" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="0.8" fill="currentColor"/>
    </svg>
  ),
  Check: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ────────────────────────────────────────────────────────────────────────────
// Field Component — Premium
// ────────────────────────────────────────────────────────────────────────────
function Field({
  id, label, type = "text", value, onChange, placeholder,
  required, autoComplete, dir = "ltr",
  icon, suffix, badge, inputRef, autoFocus, onKeyDown,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean;
  autoComplete?: string; dir?: "ltr" | "rtl";
  icon?: React.ReactNode; suffix?: React.ReactNode; badge?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>; autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-[6px]">
        <label htmlFor={id}
          className="block text-[11px] font-semibold uppercase tracking-[0.07em] select-none transition-colors duration-150"
          style={{ color: focused ? "rgba(129,140,248,1)" : "rgba(100,116,139,1)" }}>
          {label}
        </label>
        {badge}
      </div>
      <div className="relative">
        {icon && (
          <span className="absolute start-[13px] top-1/2 -translate-y-1/2 pointer-events-none z-10 transition-colors duration-200"
            style={{ color: focused ? "rgba(129,140,248,0.9)" : "rgba(71,85,105,1)" }}>
            {icon}
          </span>
        )}
        <input
          ref={inputRef} id={id} type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          autoComplete={autoComplete} dir={dir}
          autoFocus={autoFocus} onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full rounded-[10px] text-sm font-medium transition-all duration-200 placeholder:text-slate-600"
          style={{
            height: "44px",
            paddingInlineStart: icon ? "42px" : "14px",
            paddingInlineEnd: suffix ? "44px" : "14px",
            background: focused ? "rgba(79,70,229,0.06)" : "rgba(255,255,255,0.035)",
            border: `1.5px solid ${focused ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.08)"}`,
            color: "#E2E8F0",
            boxShadow: focused
              ? "0 0 0 3px rgba(99,102,241,0.12), 0 1px 2px rgba(0,0,0,0.2)"
              : "0 1px 2px rgba(0,0,0,0.15)",
            outline: "none",
          }}
        />
        {suffix && (
          <span className="absolute end-[10px] top-1/2 -translate-y-1/2 z-10">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAttendanceAuth();
  const { t, lang, setLang, isRTL, interpolate } = useLang();

  const [tab, setTab]                       = useState<Tab>("login");
  const [lockRemaining, setLockRemaining]   = useState(getLockoutRemaining);
  const passRef                             = useRef<HTMLInputElement>(null);

  const [username, setUsername]             = useState("");
  const [password, setPassword]             = useState("");
  const [showPass, setShowPass]             = useState(false);
  const [rememberMe, setRememberMe]         = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [loginError, setLoginError]         = useState<string | null>(null);
  const [loginLoading, setLoginLoading]     = useState(false);

  const [joinRole, setJoinRole]             = useState<JoinRole>("student");
  const [fullName, setFullName]             = useState("");
  const [joinUsername, setJoinUsername]     = useState("");
  const [joinPassword, setJoinPassword]     = useState("");
  const [showJoinPass, setShowJoinPass]     = useState(false);
  const [seatNumber, setSeatNumber]         = useState("");
  const [sectionNumber, setSectionNumber]   = useState("");
  const [rankInList, setRankInList]         = useState("");
  const [joinLoading, setJoinLoading]       = useState(false);
  const [joinSuccess, setJoinSuccess]       = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) { setUsername(saved); setRememberMe(true); }
    } catch { /**/ }
  }, []);

  useEffect(() => {
    if (lockRemaining <= 0) return;
    const id = setInterval(() => {
      const r = getLockoutRemaining();
      setLockRemaining(r);
      if (!r) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lockRemaining]);

  useEffect(() => {
    if (!loading && user && role)
      navigate(getAttendanceDashboardRoute(role), { replace: true });
  }, [loading, navigate, role, user]);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#02060F" }}>
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#6366F1" }}/>
    </div>
  );

  // ── Login handler ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockRemaining > 0) return;
    setLoginLoading(true); setLoginError(null);

    const raw = username.trim();
    let email = raw;

    if (!email.includes("@")) {
      const { data } = await supabase.rpc("resolve_login_identifier", { p_identifier: email });
      email = data || null;
      if (!email) {
        recordAttempt(false); setLockRemaining(getLockoutRemaining());
        await recordAuditLog({ action: "login_failed", identifier: raw, notes: "user_not_found" });
        setLoginError(lang === "ar"
          ? "لم يتم العثور على حساب بهذا المعرّف."
          : "No account found with this identifier.");
        setLoginLoading(false); return;
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      recordAttempt(false); setLockRemaining(getLockoutRemaining());
      const isPass = error.message?.toLowerCase().includes("invalid") || error.message?.toLowerCase().includes("password");
      await recordAuditLog({ action: "login_failed", identifier: raw, notes: isPass ? "wrong_password" : error.message });
      setLoginError(isPass
        ? (lang === "ar" ? "كلمة المرور غير صحيحة." : "Incorrect password.")
        : (lang === "ar" ? "فشل تسجيل الدخول. حاول مرة أخرى." : "Sign-in failed. Try again."));
      setLoginLoading(false); return;
    }

    try { rememberMe ? localStorage.setItem(REMEMBER_KEY, raw) : localStorage.removeItem(REMEMBER_KEY); } catch { /**/ }
    playCyberSuccessChime();
    await recordAuditLog({ action: "login_success", identifier: raw });
    recordAttempt(true);
    navigate("/attendance", { replace: true });
    setLoginLoading(false);
  };

  // ── Join handler ───────────────────────────────────────────────────────────
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
      setJoinLoading(false); return;
    }
    await recordAuditLog({ action: "join_request", identifier: joinUsername.trim(), role: joinRole });
    setJoinSuccess(true);
    toast.success(t.auth.requestSent);
    setJoinLoading(false);
  };

  const lockMins  = Math.ceil(lockRemaining / 60_000);
  const isStudent = joinRole === "student";

  const getBadge = () => {
    const v = username.trim();
    if (!v) return null;
    const [bg, color, border, label] = /^[0-9]+$/.test(v)
      ? ["rgba(99,102,241,0.1)", "#818CF8", "rgba(99,102,241,0.25)", lang === "ar" ? "رقم" : "ID"]
      : v.includes("@")
      ? ["rgba(16,185,129,0.08)", "#34D399", "rgba(16,185,129,0.2)", lang === "ar" ? "بريد" : "Email"]
      : ["rgba(255,255,255,0.06)", "#64748B", "rgba(255,255,255,0.1)", lang === "ar" ? "مستخدم" : "User"];
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
        style={{ background: bg, color, border: `1px solid ${border}` }}>
        {label}
      </span>
    );
  };

  // Primary button style
  const PrimaryBtn = ({
    children, loading: ld, disabled,
  }: { children: React.ReactNode; loading?: boolean; disabled?: boolean }) => (
    <button
      type="submit"
      disabled={disabled || ld}
      className="w-full flex items-center justify-center gap-2 rounded-[10px] text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.985] cursor-pointer"
      style={{
        height: "44px",
        background: "linear-gradient(180deg, #5B52F0 0%, #4338CA 100%)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.12) inset, 0 3px 12px rgba(79,70,229,0.45), 0 1px 3px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)")}
      onMouseLeave={e => (e.currentTarget.style.background = "linear-gradient(180deg, #5B52F0 0%, #4338CA 100%)")}>
      {ld ? <><Loader2 className="w-4 h-4 animate-spin"/><span>{t.auth.signingIn}</span></> : children}
    </button>
  );

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-hidden px-4 py-10"
      dir={isRTL ? "rtl" : "ltr"}
      style={{ background: "#02060F" }}>

      {/* ── Background: layered gradients ───────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {/* Deep purple blob — top */}
        <div style={{
          position: "absolute", top: "-20%", left: "10%",
          width: "70vw", height: "70vh",
          background: "radial-gradient(ellipse at center, rgba(79,70,229,0.13) 0%, transparent 65%)",
          filter: "blur(40px)",
        }}/>
        {/* Blue blob — bottom right */}
        <div style={{
          position: "absolute", bottom: "-15%", right: "5%",
          width: "50vw", height: "55vh",
          background: "radial-gradient(ellipse at center, rgba(59,130,246,0.09) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}/>
        {/* Noise texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}/>
        {/* Subtle grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 1,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        }}/>
      </div>

      {/* ── Lang toggle ──────────────────────────────────────────────── */}
      <div className="fixed top-4 end-4 z-50">
        <button
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold cursor-pointer transition-all duration-150"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(100,116,139,1)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
            (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(100,116,139,1)";
          }}>
          <Icon.Globe/>{lang === "en" ? "عربي" : "EN"}
        </button>
      </div>

      {/* ── Brand mark ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center mb-8" style={{ animation: "rise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}>
        {/* Logo mark */}
        <div className="flex items-center justify-center mb-4"
          style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, rgba(99,102,241,0.22), rgba(79,70,229,0.1))",
            border: "1px solid rgba(99,102,241,0.35)",
            boxShadow: "0 0 0 1px rgba(99,102,241,0.1), 0 8px 24px rgba(79,70,229,0.25)",
          }}>
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <path d="M16 3L5 8v9c0 7 5 13.5 11 15.5C22 30.5 27 24 27 17V8L16 3z"
              fill="rgba(99,102,241,0.2)" stroke="#818CF8" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M11 16.5l3.5 3.5L21 13" stroke="#818CF8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Wordmark */}
        <div className="text-center" dir="ltr">
          <div className="font-black tracking-[0.22em] text-white" style={{ fontSize: 17, letterSpacing: "0.22em" }}>
            CYBER<span style={{ color: "#6366F1" }}>·</span>TMSAH
          </div>
          <div className="text-[11px] font-medium mt-1 tracking-wide" style={{ color: "rgba(71,85,105,1)" }}>
            {lang === "ar" ? "نظام الحضور والمتابعة الأكاديمي" : "Academic Attendance Platform"}
          </div>
        </div>
      </div>

      {/* ── Card ─────────────────────────────────────────────────────── */}
      <div
        className="relative z-10 w-full overflow-hidden"
        style={{
          maxWidth: 420,
          borderRadius: 18,
          background: "rgba(8,13,24,0.92)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.03),
            0 24px 48px rgba(0,0,0,0.8),
            0 8px 16px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.06)
          `,
          backdropFilter: "blur(20px)",
          animation: "rise 0.55s cubic-bezier(0.22,1,0.36,1) 0.05s both",
        }}>

        {/* Card top accent line */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.5) 50%, transparent 100%)",
        }}/>

        <div className="px-7 pt-6 pb-7">

          {/* ── Card header ─────────────────────────────────────────── */}
          <div className="mb-6">
            <h1 className="font-bold text-white" style={{ fontSize: 20, letterSpacing: "-0.02em" }}>
              {tab === "login"
                ? (lang === "ar" ? "تسجيل الدخول" : "Sign in")
                : (lang === "ar" ? "طلب الانضمام" : "Request Access")}
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "#475569" }}>
              {tab === "login"
                ? (lang === "ar" ? "أدخل بيانات حسابك للمتابعة" : "Enter your credentials to continue")
                : (lang === "ar" ? "أرسل طلبك للانضمام للمنصة" : "Submit a request to join the platform")}
            </p>
          </div>

          {/* ── Tabs — underline style ──────────────────────────────── */}
          <div className="relative flex mb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {(["login", "join"] as Tab[]).map(tb => (
              <button key={tb} onClick={() => setTab(tb)}
                className="flex items-center gap-1.5 pb-3 me-6 text-[13px] font-semibold cursor-pointer transition-colors duration-150 relative"
                style={{ color: tab === tb ? "#818CF8" : "#475569" }}>
                {tb === "login"
                  ? <><Icon.LogIn/>{t.auth.signIn}</>
                  : <><Icon.UserPlus/>{t.auth.joinTitle}</>}
                {tab === tb && (
                  <span className="absolute bottom-[-1px] start-0 end-0 h-[2px] rounded-full"
                    style={{ background: "#6366F1", boxShadow: "0 0 8px rgba(99,102,241,0.6)" }}/>
                )}
              </button>
            ))}
          </div>

          {/* ══════ LOGIN ══════ */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">

              {lockRemaining > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl text-[13px]"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D" }}>
                  <span className="shrink-0 mt-[1px]"><Icon.AlertTriangle/></span>
                  <span>{interpolate(t.auth.lockedOutTimer, { minutes: lockMins })}</span>
                </div>
              )}

              <Field
                id="l-user" label={t.auth.username} value={username} onChange={setUsername}
                placeholder={t.auth.usernamePlaceholder} required autoComplete="username"
                autoFocus={typeof window !== "undefined" && window.innerWidth >= 768}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); passRef.current?.focus(); } }}
                badge={getBadge()} icon={<Icon.User/>}/>

              <Field
                id="l-pass" label={t.auth.password} type={showPass ? "text" : "password"}
                value={password} onChange={setPassword}
                placeholder={t.auth.passwordPlaceholder} required autoComplete="current-password"
                inputRef={passRef} icon={<Icon.Lock/>}
                suffix={
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer transition-colors"
                    style={{ color: "#475569" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#CBD5E1")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                    <Icon.Eye off={showPass}/>
                  </button>
                }/>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded cursor-pointer" style={{ accentColor: "#6366F1" }}/>
                  <span className="text-[12px] font-medium transition-colors" style={{ color: "#475569" }}>
                    {lang === "ar" ? "تذكرني" : "Remember me"}
                  </span>
                </label>
                <button type="button" onClick={() => setShowForgotModal(true)}
                  className="text-[12px] font-semibold cursor-pointer transition-colors"
                  style={{ color: "#6366F1" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#818CF8")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#6366F1")}>
                  {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                </button>
              </div>

              {/* Error */}
              {loginError && (
                <div role="alert"
                  className="flex items-start gap-2 p-3 rounded-xl text-[13px] font-medium"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
                  <span className="shrink-0 mt-[1px]"><Icon.AlertTriangle/></span>
                  <span>{loginError}</span>
                </div>
              )}

              <div className="pt-1">
                <PrimaryBtn loading={loginLoading} disabled={lockRemaining > 0}>
                  <Icon.LogIn/><span>{t.auth.signIn}</span>
                </PrimaryBtn>
              </div>

              <p className="text-center text-[12px] pt-1" style={{ color: "#475569" }}>
                {lang === "ar" ? "ليس لديك حساب؟" : "No account?"}{" "}
                <button type="button" onClick={() => setTab("join")}
                  className="font-semibold cursor-pointer transition-colors"
                  style={{ color: "#6366F1" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#818CF8")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#6366F1")}>
                  {t.auth.joinTitle}
                </button>
              </p>
            </form>
          )}

          {/* ══════ JOIN ══════ */}
          {tab === "join" && (
            joinSuccess ? (
              <div className="flex flex-col items-center gap-5 py-6 text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl"
                  style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}>
                  <span style={{ color: "#818CF8" }}><Icon.Check/></span>
                </div>
                <div>
                  <p className="font-bold text-white">{lang === "ar" ? "تم الإرسال بنجاح!" : "Request Sent!"}</p>
                  <p className="text-[13px] mt-1" style={{ color: "#475569" }}>{t.auth.requestSent}</p>
                </div>
                <button onClick={() => { setJoinSuccess(false); setTab("login"); }}
                  className="h-10 px-6 rounded-xl text-sm font-semibold text-white cursor-pointer active:scale-[0.98] transition-all"
                  style={{
                    background: "linear-gradient(180deg, #5B52F0 0%, #4338CA 100%)",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.12) inset, 0 3px 12px rgba(79,70,229,0.4)",
                  }}>
                  {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoin} className="space-y-3.5">
                <Field id="j-name" label={t.auth.fullName} value={fullName} onChange={setFullName}
                  placeholder={t.auth.fullNamePlaceholder} required dir={isRTL ? "rtl" : "ltr"} icon={<Icon.User/>}/>

                <Field id="j-user" label={t.auth.username} value={joinUsername} onChange={setJoinUsername}
                  placeholder={t.auth.usernamePlaceholder} required autoComplete="username" icon={<Icon.User/>}/>

                <div>
                  <Field id="j-pass" label={t.auth.password} type={showJoinPass ? "text" : "password"}
                    value={joinPassword} onChange={setJoinPassword}
                    placeholder={t.auth.passwordPlaceholder} required autoComplete="new-password"
                    icon={<Icon.Lock/>}
                    suffix={
                      <button type="button" onClick={() => setShowJoinPass(v => !v)}
                        className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer transition-colors"
                        style={{ color: "#475569" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#CBD5E1")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                        <Icon.Eye off={showJoinPass}/>
                      </button>
                    }/>
                  <PasswordStrengthMeter password={joinPassword} lang={lang}/>
                </div>

                <CustomRoleSelect
                  id="j-role" label={t.auth.chooseRole} value={joinRole}
                  onChange={v => setJoinRole(v as JoinRole)} icon={<Icon.Tag/>}
                  options={[
                    { value: "student", label: t.auth.student, icon: "🎓" },
                    { value: "doctor",  label: t.auth.doctor,  icon: "🩺" },
                    { value: "ta",      label: t.auth.ta,      icon: "💼" },
                  ]}
                  labelColor="#64748B"
                  fieldBg="rgba(255,255,255,0.035)"
                  fieldBorder="rgba(255,255,255,0.08)"
                  fieldFocus="rgba(79,70,229,0.06)"
                  fieldGlow="0 0 0 3px rgba(99,102,241,0.12)"
                  textColor="#E2E8F0"
                  faintColor="#475569"
                  isRTL={isRTL}/>

                {isStudent && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="j-seat" label={t.auth.seatNumber} value={seatNumber} onChange={setSeatNumber}
                      placeholder={t.auth.seatNumberPlaceholder} icon={<Icon.Hash/>}/>
                    <Field id="j-sec" label={t.auth.sectionNumber} type="number" value={sectionNumber}
                      onChange={setSectionNumber} placeholder={t.auth.sectionPlaceholder} icon={<Icon.Hash/>}/>
                  </div>
                )}

                {isStudent && (
                  <Field id="j-rank" label={t.auth.rankInList} type="number" value={rankInList}
                    onChange={setRankInList} placeholder={t.auth.rankPlaceholder} icon={<Icon.Hash/>}/>
                )}

                <div className="pt-1">
                  <PrimaryBtn loading={joinLoading}>
                    <Icon.UserPlus/><span>{t.auth.submitRequest}</span>
                  </PrimaryBtn>
                </div>

                <p className="text-center text-[12px] pt-1" style={{ color: "#475569" }}>
                  {lang === "ar" ? "لديك حساب؟" : "Have an account?"}{" "}
                  <button type="button" onClick={() => setTab("login")}
                    className="font-semibold cursor-pointer"
                    style={{ color: "#6366F1" }}>
                    {t.auth.signIn}
                  </button>
                </p>
              </form>
            )
          )}
        </div>
      </div>

      {/* ── Page footer ──────────────────────────────────────────────── */}
      <p className="relative z-10 mt-8 text-[11px] font-medium text-center"
        style={{ color: "rgba(51,65,85,1)", animation: "rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both" }}>
        © 2026 CYBER TMSAH ·{" "}
        {lang === "ar" ? "جامعة حلوان التكنولوجية الدولية" : "Helwan International Technological University"}
      </p>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        lang={lang}
        isRTL={isRTL}/>

      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: #1E293B; }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { opacity: 0; }
      `}</style>
    </div>
  );
};

export default LoginPage;
