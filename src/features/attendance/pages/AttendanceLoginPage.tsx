import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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

// ── Custom SVG Icons ──────────────────────────────────────────────────────────
function IconCyberShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4L8 11V22C8 31.5 15.2 40.4 24 43C32.8 40.4 40 31.5 40 22V11L24 4Z" fill="currentColor" opacity="0.15"/>
      <path d="M24 4L8 11V22C8 31.5 15.2 40.4 24 43C32.8 40.4 40 31.5 40 22V11L24 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M17 23L21.5 27.5L31 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="24" cy="14" r="2" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 17C3 13.686 6.134 11 10 11s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="13.5" r="1.2" fill="currentColor"/>
    </svg>
  );
}

function IconEye({ className, off }: { className?: string; off?: boolean }) {
  if (off) return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M3 3l14 14M8.5 8.7A3 3 0 0111.3 11.5M6.4 6.5C4.7 7.7 3.5 9 3.5 10c0 2 3 5 6.5 5 1.3 0 2.5-.4 3.5-1M10 5c3.5 0 6.5 3 6.5 5 0 .7-.3 1.5-.9 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M1.5 10C1.5 10 4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6S1.5 10 1.5 10z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconLogin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4M9 14l4-4-4-4M13 10H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 17c0-3.314 2.686-6 6-6M15 10v6M12 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconWarning({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M8.69 3.41L1.84 15.5A1.5 1.5 0 003.14 17.5h13.7a1.5 1.5 0 001.3-2.24L11.3 3.41a1.5 1.5 0 00-2.6 0z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6.5 10l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2c-2 2.5-3 5-3 8s1 5.5 3 8M10 2c2 2.5 3 5 3 8s-1 5.5-3 8M2 10h16" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M17.5 12.5A7.5 7.5 0 017.5 2.5a7.5 7.5 0 100 15 7.5 7.5 0 0010-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
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
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const L = isDark ? 60 : 35;
    const baseAlpha = isDark ? 0.45 : 0.25;
    const lineAlpha = isDark ? 0.1 : 0.14;

    const COUNT = 40;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random() * baseAlpha + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x = (p.x + p.vx + canvas.width) % canvas.width;
        p.y = (p.y + p.vy + canvas.height) % canvas.height;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(174,72%,${L}%,${p.a})`;
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `hsla(174,72%,${L - 5}%,${lineAlpha * (1 - d / 110)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => { ro.disconnect(); cancelAnimationFrame(animId); };
  }, [isDark]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({
  id, label, type = "text", value, onChange, placeholder, required,
  autoComplete, dir = "ltr", icon, suffix,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  required?: boolean; autoComplete?: string; dir?: "ltr" | "rtl";
  icon?: React.ReactNode; suffix?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-bold tracking-widest uppercase text-muted-foreground/80">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors duration-200 z-10 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id} type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          autoComplete={autoComplete} dir={dir}
          className="w-full h-11 rounded-xl border border-border bg-muted/30 text-foreground text-sm font-medium placeholder:text-muted-foreground/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 focus:bg-background hover:border-primary/30"
          style={{ paddingLeft: icon ? "2.75rem" : "1rem", paddingRight: suffix ? "3rem" : "1rem" }}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 z-10">{suffix}</span>
        )}
        {/* active underline bar */}
        <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300 origin-center" />
      </div>
    </div>
  );
}

// ── SelectField ───────────────────────────────────────────────────────────────
function SelectField({ id, label, value, onChange, options, icon }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-bold tracking-widest uppercase text-muted-foreground/80">
        {label}
      </label>
      <div className="relative group">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors duration-200 pointer-events-none">
            {icon}
          </span>
        )}
        <select
          id={id} value={value} onChange={e => onChange(e.target.value)}
          className="w-full h-11 rounded-xl border border-border bg-muted/30 text-foreground text-sm font-medium appearance-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 hover:border-primary/30 cursor-pointer"
          style={{ paddingLeft: icon ? "2.75rem" : "1rem", paddingRight: "2.5rem" }}
        >
          {options.map(o => <option key={o.value} value={o.value} className="bg-background">{o.label}</option>)}
        </select>
        <IconChevron className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAttendanceAuth();
  const { t, lang, setLang, isRTL } = useLang();
  const { toggleTheme, isDark } = useTheme();

  const [tab, setTab] = useState<Tab>("login");
  const [lockRemaining, setLockRemaining] = useState(() => getLockoutRemaining());

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

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

  useEffect(() => {
    if (lockRemaining <= 0) return;
    const timer = setInterval(() => {
      const r = getLockoutRemaining();
      setLockRemaining(r);
      if (r <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockRemaining]);

  useEffect(() => {
    if (!loading && user && role) navigate(getAttendanceDashboardRoute(role), { replace: true });
  }, [loading, navigate, role, user]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-muted border-t-primary animate-spin" />
            <IconCyberShield className="absolute inset-2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse font-medium">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!loading && user && role) return <Navigate to={getAttendanceDashboardRoute(role)} replace />;

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
      className="relative min-h-screen w-full overflow-hidden bg-background flex"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ── Left branding panel (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Particle BG */}
        <ParticleCanvas isDark={isDark} />

        {/* Background layers */}
        <div className={`absolute inset-0 ${isDark
          ? "bg-gradient-to-br from-[hsl(220,25%,5%)] via-[hsl(220,20%,8%)] to-[hsl(174,30%,6%)]"
          : "bg-gradient-to-br from-[hsl(174,60%,12%)] via-[hsl(174,50%,18%)] to-[hsl(200,40%,15%)]"
        }`} />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(hsl(174 72% 50%/0.08) 1px, transparent 1px), linear-gradient(90deg, hsl(174 72% 50%/0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Glow orbs */}
        <div className="absolute top-[-15%] left-[-10%] w-80 h-80 rounded-full bg-primary/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 rounded-full bg-cyan-500/15 blur-[80px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center gap-8">
          {/* Big shield logo */}
          <div className="relative">
            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary/20 to-cyan-500/10 border border-primary/30 flex items-center justify-center shadow-[0_0_60px_hsl(174_72%_50%/0.2)]">
              <IconCyberShield className="w-14 h-14 text-primary drop-shadow-[0_0_12px_hsl(174_72%_50%/0.6)]" />
            </div>
            {/* Animated ring */}
            <div className="absolute inset-[-6px] rounded-[22px] border border-primary/20 animate-pulse" />
            <div className="absolute inset-[-12px] rounded-[28px] border border-primary/10" />
          </div>

          <div>
            <h1 className="text-4xl xl:text-5xl font-black tracking-wider text-white leading-tight" dir="ltr">
              CYBER
              <span className="block bg-gradient-to-r from-primary via-cyan-300 to-primary bg-clip-text text-transparent drop-shadow-[0_0_20px_hsl(174_72%_50%/0.5)]">
                TMSAH
              </span>
            </h1>
            <p className="mt-3 text-sm text-white/50 font-medium tracking-wide">
              {lang === "ar" ? "منصة الأمن السيبراني الأكاديمية" : "Cybersecurity Academic Platform"}
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {[
              { icon: "🗓️", text: lang === "ar" ? "جدول أسبوعي لكل المجموعات" : "Weekly schedule for all groups" },
              { icon: "📍", text: lang === "ar" ? "حضور بالموقع الجغرافي" : "GPS-verified attendance" },
              { icon: "⚡", text: lang === "ar" ? "لوحة تحكم لحظية" : "Real-time admin dashboard" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-left">
                <span className="text-lg shrink-0">{f.icon}</span>
                <span className="text-xs text-white/70 font-medium">{f.text}</span>
              </div>
            ))}
          </div>

          {/* University badge */}
          <div className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/15 text-xs text-white/50 font-medium">
            {lang === "ar" ? "جامعة حلوان التكنولوجية الدولية" : "Helwan International Technological University"}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">
        {/* Mobile particle bg */}
        <div className="absolute inset-0 lg:hidden pointer-events-none overflow-hidden">
          <ParticleCanvas isDark={isDark} />
          <div className={`absolute inset-0 ${isDark ? "" : "bg-background/80"}`} />
        </div>

        {/* Top bar */}
        <div className="relative z-20 flex items-center justify-between px-6 pt-5">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "bg-primary/15 border border-primary/30" : "bg-primary text-primary-foreground"}`}>
              <IconCyberShield className={`w-5 h-5 ${isDark ? "text-primary" : "text-white"}`} />
            </div>
            <span className={`text-sm font-black tracking-wider ${isDark ? "text-foreground" : "text-foreground"}`} dir="ltr">
              CYBER TMSAH
            </span>
          </div>
          <div className="hidden lg:block" />

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-muted/70 border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <IconGlobe className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "عربي" : "EN"}</span>
            </button>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted/70 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              aria-label={isDark ? t.common.lightMode : t.common.darkMode}
            >
              {isDark ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Form area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px] animate-fade-up">

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-black text-foreground">
                {tab === "login"
                  ? (lang === "ar" ? "مرحباً بعودتك" : "Welcome back")
                  : (lang === "ar" ? "انضم للمنصة" : "Join the platform")
                }
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                {tab === "login" ? t.auth.subtitle : t.auth.joinSubtitle}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="relative flex gap-1 p-1 rounded-xl bg-muted/50 border border-border mb-7">
              {(["login", "join"] as Tab[]).map(tb => (
                <button
                  key={tb}
                  onClick={() => setTab(tb)}
                  className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                    tab === tb
                      ? "bg-background text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tb === "login"
                    ? <><IconLogin className="w-4 h-4" />{t.auth.signIn}</>
                    : <><IconUserPlus className="w-4 h-4" />{t.auth.joinTitle}</>
                  }
                </button>
              ))}
            </div>

            {/* ══ LOGIN FORM ══ */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Lockout banner */}
                {lockRemaining > 0 && (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <IconWarning className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{t.auth.lockedOut}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{interpolate(t.auth.lockedOutTimer, { minutes: lockMinutes })}</p>
                    </div>
                  </div>
                )}

                <Field
                  id="login-username" label={t.auth.username}
                  value={username} onChange={setUsername}
                  placeholder={t.auth.usernamePlaceholder}
                  required autoComplete="username"
                  icon={<IconUser className="w-4 h-4" />}
                />

                <Field
                  id="login-password" label={t.auth.password}
                  type={showPass ? "text" : "password"}
                  value={password} onChange={setPassword}
                  placeholder={t.auth.passwordPlaceholder}
                  required autoComplete="current-password"
                  icon={<IconLock className="w-4 h-4" />}
                  suffix={
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="text-muted-foreground/60 hover:text-primary transition-colors"
                    >
                      <IconEye className="w-4 h-4" off={showPass} />
                    </button>
                  }
                />

                {loginError && (
                  <div role="alert" className="flex items-center gap-2.5 p-3 rounded-xl border border-destructive/30 bg-destructive/8 text-sm text-destructive font-medium">
                    <IconWarning className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading || lockRemaining > 0}
                  className="w-full h-11 mt-2 rounded-xl font-bold text-sm tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
                >
                  {loginLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t.auth.signingIn}</span></>
                    : <><IconLogin className="w-4 h-4" /><span>{t.auth.signIn}</ span></>
                  }
                </button>

                <p className="text-center text-xs text-muted-foreground pt-1">
                  {lang === "ar" ? "ليس لديك حساب؟" : "Don't have an account?"}{" "}
                  <button type="button" onClick={() => setTab("join")}
                    className="text-primary hover:underline font-bold"
                  >{t.auth.joinTitle}</button>
                </p>
              </form>
            )}

            {/* ══ JOIN FORM ══ */}
            {tab === "join" && (
              joinSuccess ? (
                <div className="flex flex-col items-center gap-5 py-8 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <IconCheck className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{lang === "ar" ? "تم الإرسال!" : "Request Sent!"}</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">{t.auth.requestSent}</p>
                  </div>
                  <button
                    onClick={() => { setJoinSuccess(false); setTab("login"); }}
                    className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all"
                  >
                    {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <Field
                    id="join-fullname" label={t.auth.fullName}
                    value={fullName} onChange={setFullName}
                    placeholder={t.auth.fullNamePlaceholder}
                    required dir={isRTL ? "rtl" : "ltr"}
                    icon={<IconUser className="w-4 h-4" />}
                  />
                  <Field
                    id="join-username" label={t.auth.username}
                    value={joinUsername} onChange={setJoinUsername}
                    placeholder={t.auth.usernamePlaceholder}
                    required autoComplete="username"
                    icon={<IconUser className="w-4 h-4" />}
                  />
                  <Field
                    id="join-password" label={t.auth.password}
                    type={showJoinPass ? "text" : "password"}
                    value={joinPassword} onChange={setJoinPassword}
                    placeholder={t.auth.passwordPlaceholder}
                    required autoComplete="new-password"
                    icon={<IconLock className="w-4 h-4" />}
                    suffix={
                      <button type="button" onClick={() => setShowJoinPass(v => !v)}
                        className="text-muted-foreground/60 hover:text-primary transition-colors"
                      >
                        <IconEye className="w-4 h-4" off={showJoinPass} />
                      </button>
                    }
                  />
                  <SelectField
                    id="join-role" label={t.auth.chooseRole}
                    value={joinRole} onChange={v => setJoinRole(v as JoinRole)}
                    icon={<IconUser className="w-4 h-4" />}
                    options={[
                      { value: "student", label: t.auth.student },
                      { value: "doctor", label: t.auth.doctor },
                      { value: "ta", label: t.auth.ta },
                    ]}
                  />
                  {isStudent && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field id="join-seat" label={t.auth.seatNumber} value={seatNumber} onChange={setSeatNumber} placeholder={t.auth.seatNumberPlaceholder} />
                      <Field id="join-section" label={t.auth.sectionNumber} type="number" value={sectionNumber} onChange={setSectionNumber} placeholder={t.auth.sectionPlaceholder} />
                    </div>
                  )}
                  {isStudent && (
                    <Field id="join-rank" label={t.auth.rankInList} type="number" value={rankInList} onChange={setRankInList} placeholder={t.auth.rankPlaceholder} />
                  )}
                  <button
                    type="submit" disabled={joinLoading}
                    className="w-full h-11 mt-2 rounded-xl font-bold text-sm tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
                  >
                    {joinLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t.auth.submitting}</span></>
                      : <><IconUserPlus className="w-4 h-4" /><span>{t.auth.submitRequest}</span></>
                    }
                  </button>
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    {lang === "ar" ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
                    <button type="button" onClick={() => setTab("login")}
                      className="text-primary hover:underline font-bold"
                    >{t.auth.signIn}</button>
                  </p>
                </form>
              )
            )}

            {/* Footer */}
            <p className="text-center text-[11px] text-muted-foreground/50 mt-8">
              © 2026 CYBER TMSAH · {lang === "ar" ? "جامعة حلوان التكنولوجية الدولية" : "Helwan International Technological University"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
