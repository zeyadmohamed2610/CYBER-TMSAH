import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, Loader2, ShieldAlert, UserPlus, LogIn,
  Shield, ChevronDown, CheckCircle2, X
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "../utils/dashboardRoutes";
import { useLang, interpolate } from "@/i18n";
import { useTheme } from "@/context/ThemeContext";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "login" | "join";
type JoinRole = "student" | "doctor" | "ta";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 3 * 60 * 1000;
const STORAGE_KEY = "cyber_login_attempts";

// ── Rate-limit helpers ────────────────────────────────────────────────────────
function getLockoutRemaining(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const { count, firstAttempt } = JSON.parse(raw) as { count: number; firstAttempt: number };
    if (count < MAX_ATTEMPTS) return 0;
    const remaining = LOCKOUT_MS - (Date.now() - firstAttempt);
    return remaining > 0 ? remaining : 0;
  } catch { return 0; }
}

function recordAttempt(success: boolean): void {
  if (success) { localStorage.removeItem(STORAGE_KEY); return; }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev = raw ? JSON.parse(raw) as { count: number; firstAttempt: number } : { count: 0, firstAttempt: Date.now() };
    const nowExpired = Date.now() - prev.firstAttempt > LOCKOUT_MS;
    const entry = nowExpired ? { count: 1, firstAttempt: Date.now() } : { count: prev.count + 1, firstAttempt: prev.firstAttempt };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch { /* ignore */ }
}

// ── Canvas Particle Background ────────────────────────────────────────────────
function ParticleCanvas({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Adapt particle color to theme
    const hue = 174;
    const particleLightness = isDark ? 60 : 35;
    const lineAlphaBase = isDark ? 0.12 : 0.18;

    const COUNT = Math.min(60, Math.floor((window.innerWidth * window.innerHeight) / 18000));
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
      alpha: isDark ? Math.random() * 0.5 + 0.2 : Math.random() * 0.35 + 0.15,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 72%, ${particleLightness}%, ${p.alpha})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `hsla(${hue}, 72%, ${particleLightness - 5}%, ${lineAlphaBase * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

// ── Input component ───────────────────────────────────────────────────────────
function FloatingInput({
  id, label, type = "text", value, onChange, placeholder, required, autoComplete, dir = "ltr",
  rightSlot,
}: {
  id: string; label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; autoComplete?: string; dir?: "ltr" | "rtl";
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <label
        htmlFor={id}
        className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1.5 transition-colors group-focus-within:text-primary"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          dir={dir}
          className="
            w-full h-12 px-4 rounded-xl
            bg-muted/40 border border-border
            text-foreground placeholder:text-muted-foreground/60
            text-sm font-medium
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/60 focus:bg-muted/60
            hover:border-primary/30
          "
          style={rightSlot ? { paddingRight: "3rem" } : undefined}
        />
        {rightSlot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
    </div>
  );
}

// ── Select component ──────────────────────────────────────────────────────────
function FloatingSelect({
  id, label, value, onChange, options,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1.5">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="
            w-full h-12 px-4 rounded-xl appearance-none
            bg-muted/40 border border-border
            text-foreground text-sm font-medium
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/60
            hover:border-primary/30 cursor-pointer
          "
        >
          {options.map(o => <option key={o.value} value={o.value} className="bg-background">{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAttendanceAuth();
  const { t, lang, setLang, isRTL } = useLang();
  const { theme, toggleTheme, isDark } = useTheme();

  const [tab, setTab] = useState<Tab>("login");
  const [lockRemaining, setLockRemaining] = useState(() => getLockoutRemaining());

  // ── Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Join state
  const [joinRole, setJoinRole] = useState<JoinRole>("student");
  const [fullName, setFullName] = useState("");
  const [joinUsername, setJoinUsername] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPass, setShowJoinPass] = useState(false);
  const [seatNumber, setSeatNumber] = useState("");
  const [sectionNumber, setSectionNumber] = useState("");
  const [rankInList, setRankInList] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  // ── Lockout timer
  useEffect(() => {
    if (lockRemaining <= 0) return;
    const timer = setInterval(() => {
      const r = getLockoutRemaining();
      setLockRemaining(r);
      if (r <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockRemaining]);

  // ── Redirect if already logged in
  useEffect(() => {
    if (!loading && user && role) navigate(getAttendanceDashboardRoute(role), { replace: true });
  }, [loading, navigate, role, user]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!loading && user && role) return <Navigate to={getAttendanceDashboardRoute(role)} replace />;

  // ── Login submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const lockMs = getLockoutRemaining();
    if (lockMs > 0) { setLockRemaining(lockMs); return; }

    setLoginLoading(true);
    let authEmail = username.trim();
    if (!authEmail.includes("@")) {
      const { data: resolved } = await supabase.rpc("resolve_login_identifier", { p_identifier: authEmail });
      authEmail = resolved || `${authEmail}@cyber.local`;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });

    if (error) {
      recordAttempt(false);
      setLockRemaining(getLockoutRemaining());
      setLoginError(t.auth.loginFailed);
      setLoginLoading(false);
      return;
    }

    recordAttempt(true);
    navigate("/attendance", { replace: true });
    setLoginLoading(false);
  };

  // ── Join submit
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinLoading(true);

    const { error } = await supabase.from("join_requests").insert({
      full_name: fullName.trim(),
      username: joinUsername.trim(),
      role: joinRole,
      seat_number: seatNumber.trim() || null,
      section_number: sectionNumber ? parseInt(sectionNumber) : null,
      rank_in_list: rankInList ? parseInt(rankInList) : null,
    });

    if (error) {
      toast.error(lang === "ar" ? "فشل إرسال الطلب. حاول مجدداً." : "Failed to submit request.");
      setJoinLoading(false);
      return;
    }

    setJoinSuccess(true);
    toast.success(t.auth.requestSent);
    setJoinLoading(false);
  };

  const lockMinutes = Math.ceil(lockRemaining / 60_000);
  const isStudent = joinRole === "student";

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-background flex items-center justify-center"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ── Particle Background */}
      <ParticleCanvas isDark={isDark} />

      {/* ── Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(hsl(174 72% ${isDark ? '50' : '38'}%/0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(174 72% ${isDark ? '50' : '38'}%/0.5) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          opacity: isDark ? 0.03 : 0.06,
        }}
      />

      {/* ── Glow orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-cyan-500/8 blur-[100px] pointer-events-none" />
      <div className="absolute top-[60%] right-[20%] w-[300px] h-[300px] rounded-full bg-purple-500/5 blur-[80px] pointer-events-none" />

      {/* ── Top bar: Lang + Theme */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          aria-label="Toggle language"
        >
          <span className="text-base">{lang === "en" ? "🇦🇪" : "🇺🇸"}</span>
          <span>{lang === "en" ? "العربية" : "English"}</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-muted/60 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          aria-label={isDark ? t.common.lightMode : t.common.darkMode}
        >
          {isDark ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Main card */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-8 animate-fade-up">

        {/* Logo & title */}
        <div className="text-center mb-8">
          {/* Adaptive logo: dark mode = glowing cyan shield, light mode = solid teal on white card */}
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5 shadow-2xl transition-all duration-300 ${
            isDark
              ? "bg-primary/10 border border-primary/30 cyber-glow"
              : "bg-white border-2 border-primary/40 shadow-[0_4px_24px_hsl(174_72%_38%/0.18)]"
          }`}>
            {isDark ? (
              /* Dark mode: hollow glowing shield */
              <Shield className="w-10 h-10 text-primary drop-shadow-[0_0_8px_hsl(174_72%_50%/0.8)]" strokeWidth={1.5} />
            ) : (
              /* Light mode: filled solid shield with gradient */
              <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="shield-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(174,72%,38%)" />
                    <stop offset="100%" stopColor="hsl(174,72%,28%)" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 2L3 6.5V12c0 5.25 3.75 10.15 9 11.5 5.25-1.35 9-6.25 9-11.5V6.5L12 2z"
                  fill="url(#shield-grad)"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <h1 className={`text-3xl font-black tracking-tight leading-tight ${
            isDark
              ? "bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent"
              : "text-primary"
          }`}>
            CYBER TMSAH
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium">
            {tab === "login" ? t.auth.subtitle : t.auth.joinSubtitle}
          </p>
        </div>

        {/* Card */}
        <div className={`relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
          isDark
            ? "border border-white/10 backdrop-blur-xl bg-white/[0.04]"
            : "border border-border bg-card"
        }`}>

          {/* Shimmer border — dark mode only */}
          {isDark && (
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              background: "linear-gradient(135deg, hsl(174 72% 50%/0.15) 0%, transparent 50%, hsl(174 72% 50%/0.08) 100%)",
            }} />
          )}

          {/* Tabs */}
          <div className="flex border-b border-border relative">
            {(["login", "join"] as Tab[]).map(t2 => (
              <button
                key={t2}
                onClick={() => setTab(t2)}
                className={`
                  flex-1 py-3.5 text-sm font-semibold tracking-wide transition-all relative
                  ${tab === t2
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <span className="flex items-center justify-center gap-2">
                  {t2 === "login"
                    ? <><LogIn className="w-4 h-4" /> {t.auth.signIn}</>
                    : <><UserPlus className="w-4 h-4" /> {t.auth.joinTitle}</>
                  }
                </span>
                {tab === t2 && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">

            {/* ══ LOGIN PANEL ══ */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-5">

                {/* Lockout */}
                {lockRemaining > 0 && (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-500">{t.auth.lockedOut}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {interpolate(t.auth.lockedOutTimer, { minutes: lockMinutes })}
                      </p>
                    </div>
                  </div>
                )}

                <FloatingInput
                  id="login-username"
                  label={t.auth.username}
                  value={username}
                  onChange={setUsername}
                  placeholder={t.auth.usernamePlaceholder}
                  required
                  autoComplete="username"
                />

                <FloatingInput
                  id="login-password"
                  label={t.auth.password}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder={t.auth.passwordPlaceholder}
                  required
                  autoComplete="current-password"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                {loginError && (
                  <div role="alert" className="flex items-start gap-2.5 p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-sm text-destructive">
                    <X className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading || lockRemaining > 0}
                  className="
                    w-full h-12 rounded-xl font-bold text-sm tracking-wide
                    bg-primary text-primary-foreground
                    hover:bg-primary/90 active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200 shadow-lg shadow-primary/25
                    flex items-center justify-center gap-2
                  "
                >
                  {loginLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t.auth.signingIn}</span></>
                    : <><LogIn className="w-4 h-4" /><span>{t.auth.signIn}</span></>
                  }
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  {lang === "ar" ? "ليس لديك حساب؟" : "Don't have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setTab("join")}
                    className="text-primary hover:underline font-semibold"
                  >
                    {t.auth.joinTitle}
                  </button>
                </p>
              </form>
            )}

            {/* ══ JOIN PANEL ══ */}
            {tab === "join" && (
              joinSuccess ? (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold">{lang === "ar" ? "تم الإرسال!" : "Request Sent!"}</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">{t.auth.requestSent}</p>
                  <button
                    onClick={() => { setJoinSuccess(false); setTab("login"); }}
                    className="mt-2 text-sm text-primary hover:underline font-semibold"
                  >
                    {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">

                  <FloatingInput
                    id="join-fullname"
                    label={t.auth.fullName}
                    value={fullName}
                    onChange={setFullName}
                    placeholder={t.auth.fullNamePlaceholder}
                    required
                    dir={isRTL ? "rtl" : "ltr"}
                  />

                  <FloatingInput
                    id="join-username"
                    label={t.auth.username}
                    value={joinUsername}
                    onChange={setJoinUsername}
                    placeholder={t.auth.usernamePlaceholder}
                    required
                    autoComplete="username"
                  />

                  <FloatingInput
                    id="join-password"
                    label={t.auth.password}
                    type={showJoinPass ? "text" : "password"}
                    value={joinPassword}
                    onChange={setJoinPassword}
                    placeholder={t.auth.passwordPlaceholder}
                    required
                    autoComplete="new-password"
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowJoinPass(v => !v)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showJoinPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />

                  <FloatingSelect
                    id="join-role"
                    label={t.auth.chooseRole}
                    value={joinRole}
                    onChange={v => setJoinRole(v as JoinRole)}
                    options={[
                      { value: "student", label: t.auth.student },
                      { value: "doctor", label: t.auth.doctor },
                      { value: "ta", label: t.auth.ta },
                    ]}
                  />

                  {/* Student-only fields */}
                  {isStudent && (
                    <div className="grid grid-cols-2 gap-3">
                      <FloatingInput
                        id="join-seat"
                        label={t.auth.seatNumber}
                        value={seatNumber}
                        onChange={setSeatNumber}
                        placeholder={t.auth.seatNumberPlaceholder}
                      />
                      <FloatingInput
                        id="join-section"
                        label={t.auth.sectionNumber}
                        type="number"
                        value={sectionNumber}
                        onChange={setSectionNumber}
                        placeholder={t.auth.sectionPlaceholder}
                      />
                    </div>
                  )}

                  {isStudent && (
                    <FloatingInput
                      id="join-rank"
                      label={t.auth.rankInList}
                      type="number"
                      value={rankInList}
                      onChange={setRankInList}
                      placeholder={t.auth.rankPlaceholder}
                    />
                  )}

                  <button
                    type="submit"
                    disabled={joinLoading}
                    className="
                      w-full h-12 rounded-xl font-bold text-sm tracking-wide mt-2
                      bg-primary text-primary-foreground
                      hover:bg-primary/90 active:scale-[0.98]
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200 shadow-lg shadow-primary/25
                      flex items-center justify-center gap-2
                    "
                  >
                    {joinLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t.auth.submitting}</span></>
                      : <><UserPlus className="w-4 h-4" /><span>{t.auth.submitRequest}</span></>
                    }
                  </button>

                  <p className="text-center text-xs text-muted-foreground">
                    {lang === "ar" ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => setTab("login")}
                      className="text-primary hover:underline font-semibold"
                    >
                      {t.auth.signIn}
                    </button>
                  </p>
                </form>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          © 2026 CYBER TMSAH · {lang === "ar" ? "جامعة حلوان التكنولوجية الدولية" : "Helwan International Technological University"}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
