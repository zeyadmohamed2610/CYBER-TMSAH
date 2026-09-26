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

import { DEPARTMENTS, ACADEMIC_YEARS } from "../types";

type Tab = "login" | "join";
type JoinRole = "coordinator" | "doctor" | "ta" | "student";

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
  Mail: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Dept: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Year: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" stroke="currentColor" strokeWidth="1.6"/>
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
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id}
          className="block text-[12px] font-semibold tracking-wide select-none transition-colors duration-150"
          style={{ color: focused ? "#818CF8" : "#CBD5E1" }}>
          {label}
        </label>
        {badge}
      </div>
      <div className="relative">
        {icon && (
          <span className="absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 transition-colors duration-200"
            style={{ color: focused ? "#818CF8" : "#94A3B8" }}>
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
          className="w-full rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            height: "46px",
            paddingInlineStart: icon ? "42px" : "14px",
            paddingInlineEnd: suffix ? "44px" : "14px",
            background: focused ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.045)",
            border: `1.5px solid ${focused ? "#6366F1" : "rgba(255,255,255,0.12)"}`,
            color: "#FFFFFF",
            boxShadow: focused
              ? "0 0 0 3.5px rgba(99,102,241,0.22), 0 2px 4px rgba(0,0,0,0.2)"
              : "0 1px 2px rgba(0,0,0,0.15)",
            outline: "none",
          }}
        />
        {suffix && (
          <span className="absolute end-2.5 top-1/2 -translate-y-1/2 z-10">{suffix}</span>
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
  const [joinEmail, setJoinEmail]           = useState("");
  const [joinUsername, setJoinUsername]     = useState("");
  const [joinPassword, setJoinPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showJoinPass, setShowJoinPass]     = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [department, setDepartment]         = useState<string>("cybersecurity");
  const [academicYear, setAcademicYear]     = useState<string>("1");
  const [sectionNumber, setSectionNumber]   = useState("");
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
    e.preventDefault();
    setJoinLoading(true);

    // 1. Full name validation: English 3-part name
    const trimmedName = fullName.trim();
    const nameParts = trimmedName.split(/\s+/).filter(Boolean);
    const isEnglishOnly = /^[A-Za-z\s]+$/.test(trimmedName);
    if (!isEnglishOnly || nameParts.length < 3) {
      toast.error(
        lang === "ar"
          ? "يجب كتابة الاسم ثلاثي باللغة الإنجليزية (مثال: Ahmed Mohamed Ali)"
          : "Full name must be at least 3 parts in English (e.g. John David Smith)"
      );
      setJoinLoading(false);
      return;
    }

    // 2. Email validation
    const trimmedEmail = joinEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error(lang === "ar" ? "يرجى كتابة بريد إلكتروني صالح" : "Please enter a valid email address");
      setJoinLoading(false);
      return;
    }

    // 3. Username validation: unique, English alphanumeric
    const trimmedUsername = joinUsername.trim().toLowerCase();
    const userRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!userRegex.test(trimmedUsername)) {
      toast.error(
        lang === "ar"
          ? "اسم المستخدم يجب أن يتكون من 3-30 حرفاً إنجليزياً أو رقماً بدون مسافات"
          : "Username must be 3-30 English alphanumeric characters with no spaces"
      );
      setJoinLoading(false);
      return;
    }

    // Check if username already exists in users
    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", trimmedUsername)
        .maybeSingle();

      if (existingUser) {
        toast.error(
          lang === "ar"
            ? "اسم المستخدم هذا مسجل بالفعل، يرجى اختيار اسم مستخدم آخر."
            : "This username is already taken. Please choose another."
        );
        setJoinLoading(false);
        return;
      }
    } catch {
      // Continue if table doesn't have username check or network error
    }

    // 4. Password validation
    if (!joinPassword || joinPassword.length < 6) {
      toast.error(lang === "ar" ? "كلمة المرور يجب ألا تقل عن 6 أحرف" : "Password must be at least 6 characters");
      setJoinLoading(false);
      return;
    }
    if (joinPassword !== confirmPassword) {
      toast.error(lang === "ar" ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      setJoinLoading(false);
      return;
    }

    // 5. Department validation
    if (!department) {
      toast.error(lang === "ar" ? "يرجى اختيار القسم" : "Please select your department");
      setJoinLoading(false);
      return;
    }

    // 6. Student specific validation
    if (joinRole === "student") {
      if (!academicYear) {
        toast.error(lang === "ar" ? "يرجى اختيار الفرقة الدراسية" : "Please select your academic year");
        setJoinLoading(false);
        return;
      }
      if (!sectionNumber || isNaN(parseInt(sectionNumber))) {
        toast.error(lang === "ar" ? "يرجى إدخال رقم السكشن" : "Please enter section number");
        setJoinLoading(false);
        return;
      }
    }

    const { error } = await supabase.from("join_requests").insert({
      full_name: trimmedName,
      email: trimmedEmail,
      username: trimmedUsername,
      password: joinPassword,
      role: joinRole,
      department: department,
      academic_year: joinRole === "student" ? academicYear : null,
      section_number: joinRole === "student" && sectionNumber ? parseInt(sectionNumber) : null,
    });

    if (error) {
      toast.error(lang === "ar" ? `فشل إرسال الطلب: ${error.message}` : "Failed to submit request.");
      setJoinLoading(false);
      return;
    }

    await recordAuditLog({
      action: "join_request",
      identifier: `${trimmedUsername} | ${trimmedEmail}`,
      role: joinRole,
    });

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
      className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.985] cursor-pointer"
      style={{
        height: "46px",
        background: "linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.25) inset, 0 4px 18px rgba(79,70,229,0.5), 0 2px 4px rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "linear-gradient(180deg, #6E72FF 0%, #5548ED 100%)")}
      onMouseLeave={e => (e.currentTarget.style.background = "linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)")}>
      {ld ? <><Loader2 className="w-4 h-4 animate-spin"/><span>{t.auth.signingIn}</span></> : children}
    </button>
  );

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-x-hidden overflow-y-auto px-4 py-10"
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

      {/* ── Brand Wordmark as the Logo ─────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center mb-7 select-none text-center"
        style={{ animation: "rise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}>

        {/* Hero Wordmark */}
        <div className="flex items-center justify-center gap-2.5" dir="ltr">
          <span
            className="font-black text-white text-[28px] md:text-[34px] tracking-[0.14em]"
            style={{
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "0.14em",
              textShadow: "0 2px 24px rgba(255,255,255,0.22)",
            }}>
            CYBER
          </span>
          <span
            className="font-black text-[28px] md:text-[34px] tracking-[0.14em]"
            style={{
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "0.14em",
              background: "linear-gradient(135deg, #C7D2FE 0%, #818CF8 50%, #6366F1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 20px rgba(99,102,241,0.5))",
            }}>
            TMSAH
          </span>
        </div>

        {/* System Descriptor Pill */}
        <div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1 rounded-full"
          style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.22)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11.5px] font-semibold tracking-wider text-slate-300">
            {lang === "ar" ? "المنظومة الأكاديمية الذكية للتحقق والحضور" : "Academic Attendance & Verification System"}
          </span>
        </div>
      </div>

      {/* ── Card Container with Ambient Depth ─────────────────────────── */}
      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Soft radial spotlight behind card */}
        <div
          className="absolute pointer-events-none -z-10"
          style={{
            width: "560px",
            height: "560px",
            background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(79,70,229,0.04) 45%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            filter: "blur(50px)",
          }}
        />

        {/* ── Card ─────────────────────────────────────────────────────── */}
        <div
          className="w-full relative"
          style={{
            maxWidth: 460,
            borderRadius: 22,
            background: "rgba(10, 15, 29, 0.90)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.04),
              0 25px 60px -15px rgba(0,0,0,0.85),
              0 10px 25px -5px rgba(0,0,0,0.5),
              inset 0 1px 0 rgba(255,255,255,0.08)
            `,
            backdropFilter: "blur(24px)",
            animation: "rise 0.55s cubic-bezier(0.22,1,0.36,1) 0.05s both",
          }}>

          {/* Card top accent line */}
          <div style={{
            height: 1,
            background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.7) 50%, transparent 100%)",
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
          }}/>

          <div className="px-8 pt-7 pb-8">

            {/* ── Card header ─────────────────────────────────────────── */}
            <div className="mb-6">
              <h1 className="font-bold text-white text-[22px] tracking-tight">
                {tab === "login"
                  ? (lang === "ar" ? "تسجيل الدخول" : "Sign in")
                  : (lang === "ar" ? "طلب الانضمام" : "Request Access")}
              </h1>
              <p className="mt-1 text-[13px] text-slate-400 font-normal">
                {tab === "login"
                  ? (lang === "ar" ? "أدخل بيانات حسابك الأكاديمي للمتابعة" : "Enter your academic credentials to continue")
                  : (lang === "ar" ? "أرسل بياناتك لاعتماد حسابك في المنصة" : "Submit your information to join the platform")}
              </p>
            </div>

            {/* ── Tabs — underline style ──────────────────────────────── */}
            <div className="relative flex mb-6 border-b border-white/10">
              {(["login", "join"] as Tab[]).map(tb => (
                <button key={tb} onClick={() => setTab(tb)}
                  className="flex items-center gap-1.5 pb-3.5 me-6 text-[13.5px] font-semibold cursor-pointer transition-colors duration-150 relative"
                  style={{ color: tab === tb ? "#FFFFFF" : "#94A3B8" }}>
                  {tb === "login"
                    ? <><Icon.LogIn/>{t.auth.signIn}</>
                    : <><Icon.UserPlus/>{t.auth.joinTitle}</>}
                  {tab === tb && (
                    <span className="absolute bottom-[-1px] start-0 end-0 h-[2.5px] rounded-full"
                      style={{ background: "#6366F1", boxShadow: "0 0 10px rgba(99,102,241,0.8)" }}/>
                  )}
                </button>
              ))}
            </div>

            {/* ══════ LOGIN ══════ */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">

                {lockRemaining > 0 && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl text-[13px]"
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#FCD34D" }}>
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
                      className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer transition-colors text-slate-400 hover:text-white">
                      <Icon.Eye off={showPass}/>
                    </button>
                  }/>

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "#6366F1" }}/>
                    <span className="text-[12.5px] font-medium text-slate-300 group-hover:text-white transition-colors">
                      {lang === "ar" ? "تذكرني" : "Remember me"}
                    </span>
                  </label>
                  <button type="button" onClick={() => setShowForgotModal(true)}
                    className="text-[12.5px] font-semibold text-purple-400 hover:text-purple-300 cursor-pointer transition-colors">
                    {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                  </button>
                </div>

                {/* Error */}
                {loginError && (
                  <div role="alert"
                    className="flex items-start gap-2.5 p-3.5 rounded-xl text-[13px] font-medium"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
                    <span className="shrink-0 mt-[1px]"><Icon.AlertTriangle/></span>
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="pt-1.5">
                  <PrimaryBtn loading={loginLoading} disabled={lockRemaining > 0}>
                    <Icon.LogIn/><span>{t.auth.signIn}</span>
                  </PrimaryBtn>
                </div>

                <p className="text-center text-[12.5px] pt-1.5 text-slate-400">
                  {lang === "ar" ? "ليس لديك حساب؟" : "No account?"}{" "}
                  <button type="button" onClick={() => setTab("join")}
                    className="font-semibold text-purple-400 hover:text-purple-300 cursor-pointer transition-colors">
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
                    style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)" }}>
                    <span style={{ color: "#818CF8" }}><Icon.Check/></span>
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">{lang === "ar" ? "تم إرسال طلبك بنجاح!" : "Request Sent!"}</p>
                    <p className="text-[13px] mt-1 text-slate-400">{t.auth.requestSent}</p>
                  </div>
                  <button onClick={() => { setJoinSuccess(false); setTab("login"); }}
                    className="h-11 px-7 rounded-xl text-sm font-semibold text-white cursor-pointer active:scale-[0.98] transition-all"
                    style={{
                      background: "linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)",
                      boxShadow: "0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 18px rgba(79,70,229,0.45)",
                    }}>
                    {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoin} className="space-y-3.5">
                  {/* English 3-part Full Name */}
                  <Field
                    id="j-name"
                    label={lang === "ar" ? "الاسم ثلاثي بالإنجليزية" : "Full Name (English - 3 parts)"}
                    value={fullName}
                    onChange={setFullName}
                    placeholder={lang === "ar" ? "مثال: Ahmed Mohamed Ali" : "e.g. John David Smith"}
                    required
                    dir="ltr"
                    icon={<Icon.User/>}
                  />

                  {/* Real Email */}
                  <Field
                    id="j-email"
                    type="email"
                    label={lang === "ar" ? "البريد الإلكتروني" : "Email Address"}
                    value={joinEmail}
                    onChange={setJoinEmail}
                    placeholder="name@gmail.com"
                    required
                    dir="ltr"
                    icon={<Icon.Mail/>}
                  />

                  {/* Unique Username */}
                  <Field
                    id="j-user"
                    label={lang === "ar" ? "اسم المستخدم (فريد)" : "Unique Username"}
                    value={joinUsername}
                    onChange={setJoinUsername}
                    placeholder={lang === "ar" ? "مثال: ahmed_ali" : "e.g. ahmed_ali"}
                    required
                    dir="ltr"
                    autoComplete="username"
                    icon={<Icon.User/>}
                  />

                  {/* Password & Confirm Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Field
                        id="j-pass"
                        label={t.auth.password}
                        type={showJoinPass ? "text" : "password"}
                        value={joinPassword}
                        onChange={setJoinPassword}
                        placeholder="••••••••"
                        required
                        dir="ltr"
                        autoComplete="new-password"
                        icon={<Icon.Lock/>}
                        suffix={
                          <button type="button" onClick={() => setShowJoinPass(v => !v)}
                            className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer transition-colors text-slate-400 hover:text-white">
                            <Icon.Eye off={showJoinPass}/>
                          </button>
                        }
                      />
                    </div>
                    <div>
                      <Field
                        id="j-confirm-pass"
                        label={lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
                        type={showConfirmPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="••••••••"
                        required
                        dir="ltr"
                        autoComplete="new-password"
                        icon={<Icon.Lock/>}
                        suffix={
                          <button type="button" onClick={() => setShowConfirmPass(v => !v)}
                            className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer transition-colors text-slate-400 hover:text-white">
                            <Icon.Eye off={showConfirmPass}/>
                          </button>
                        }
                      />
                    </div>
                  </div>
                  <PasswordStrengthMeter password={joinPassword} lang={lang}/>

                  {/* Choose Role */}
                  <CustomRoleSelect
                    id="j-role"
                    label={t.auth.chooseRole}
                    value={joinRole}
                    onChange={v => setJoinRole(v as JoinRole)}
                    icon={<Icon.Tag/>}
                    options={[
                      { value: "coordinator", label: lang === "ar" ? "منسق البرنامج (رئيس قسم)" : "Program Coordinator / Dept Head" },
                      { value: "doctor",      label: lang === "ar" ? "دكتور مادة" : "Doctor / Professor" },
                      { value: "ta",          label: lang === "ar" ? "معيد" : "Teaching Assistant (TA)" },
                      { value: "student",     label: lang === "ar" ? "طالب" : "Student" },
                    ]}
                    labelColor="#CBD5E1"
                    fieldBg="rgba(255,255,255,0.045)"
                    fieldBorder="rgba(255,255,255,0.12)"
                    fieldFocus="rgba(99,102,241,0.08)"
                    fieldGlow="0 0 0 3px rgba(99,102,241,0.2)"
                    textColor="#FFFFFF"
                    faintColor="#94A3B8"
                    isRTL={isRTL}
                  />

                  {/* Department (The 7 departments for all roles) */}
                  <CustomRoleSelect
                    id="j-dept"
                    label={lang === "ar" ? "القسم التابع له (7 أقسام)" : "Department (7 Disciplines)"}
                    value={department}
                    onChange={setDepartment}
                    icon={<Icon.Dept/>}
                    options={DEPARTMENTS.map(d => ({
                      value: d.id,
                      label: lang === "ar" ? d.nameAr : d.nameEn,
                    }))}
                    labelColor="#CBD5E1"
                    fieldBg="rgba(255,255,255,0.045)"
                    fieldBorder="rgba(255,255,255,0.12)"
                    fieldFocus="rgba(99,102,241,0.08)"
                    fieldGlow="0 0 0 3px rgba(99,102,241,0.2)"
                    textColor="#FFFFFF"
                    faintColor="#94A3B8"
                    isRTL={isRTL}
                  />

                  {/* Student Specific Fields: Academic Year & Section Number */}
                  {isStudent && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <CustomRoleSelect
                        id="j-year"
                        label={lang === "ar" ? "الفرقة الدراسية" : "Academic Year"}
                        value={academicYear}
                        onChange={setAcademicYear}
                        icon={<Icon.Year/>}
                        options={ACADEMIC_YEARS.map(y => ({
                          value: y.id,
                          label: lang === "ar" ? y.nameAr : y.nameEn,
                        }))}
                        labelColor="#CBD5E1"
                        fieldBg="rgba(255,255,255,0.045)"
                        fieldBorder="rgba(255,255,255,0.12)"
                        fieldFocus="rgba(99,102,241,0.08)"
                        fieldGlow="0 0 0 3px rgba(99,102,241,0.2)"
                        textColor="#FFFFFF"
                        faintColor="#94A3B8"
                        isRTL={isRTL}
                      />

                      <Field
                        id="j-sec"
                        label={lang === "ar" ? "رقم السكشن" : "Section Number"}
                        type="number"
                        value={sectionNumber}
                        onChange={setSectionNumber}
                        placeholder={lang === "ar" ? "مثال: 1" : "e.g. 1"}
                        required
                        icon={<Icon.Hash/>}
                      />
                    </div>
                  )}

                  <div className="pt-1.5">
                    <PrimaryBtn loading={joinLoading}>
                      <Icon.UserPlus/><span>{t.auth.submitRequest}</span>
                    </PrimaryBtn>
                  </div>

                  <p className="text-center text-[12.5px] pt-1.5 text-slate-400">
                    {lang === "ar" ? "لديك حساب؟" : "Have an account?"}{" "}
                    <button type="button" onClick={() => setTab("login")}
                      className="font-semibold text-purple-400 hover:text-purple-300 cursor-pointer transition-colors">
                      {t.auth.signIn}
                    </button>
                  </p>
                </form>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Page footer ──────────────────────────────────────────────── */}
      <div className="relative z-10 mt-8 text-center"
        style={{ animation: "rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both" }}>
        <p className="text-[12px] font-medium text-slate-400">
          © 2026 CYBER TMSAH ·{" "}
          {lang === "ar" ? "جامعة حلوان التكنولوجية الدولية" : "Helwan International Technological University"}
        </p>
      </div>

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
        input::placeholder { color: #64748B !important; }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { opacity: 0; }
      `}</style>
    </div>
  );
};

export default LoginPage;
