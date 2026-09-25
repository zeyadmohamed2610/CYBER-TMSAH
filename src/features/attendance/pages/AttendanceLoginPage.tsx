import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { getAttendanceDashboardRoute } from "../utils/dashboardRoutes";
import { useLang, interpolate } from "@/i18n";
import { useTheme } from "@/context/ThemeContext";

type Tab = "login" | "join";
type JoinRole = "student" | "doctor" | "ta";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 3 * 60 * 1000;
const STORAGE_KEY = "cyber_login_attempts";

function getLockoutRemaining(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const { count, firstAttempt } = JSON.parse(raw) as { count: number; firstAttempt: number };
    if (count < MAX_ATTEMPTS) return 0;
    const rem = LOCKOUT_MS - (Date.now() - firstAttempt);
    return rem > 0 ? rem : 0;
  } catch { return 0; }
}

function recordAttempt(success: boolean) {
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

// ── Theme tokens (dark & calm non-glaring light mode) ─────────────────────────
const THEME = {
  dark: {
    bg:          "hsl(222, 32%, 6%)",
    card:        "rgba(15, 23, 42, 0.75)",
    cardBorder:  "rgba(255, 255, 255, 0.08)",
    cardShadow:  "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)",
    fieldBg:     "rgba(255, 255, 255, 0.04)",
    fieldBorder: "rgba(255, 255, 255, 0.08)",
    fieldFocus:  "rgba(255, 255, 255, 0.08)",
    tabBg:       "rgba(255, 255, 255, 0.05)",
    tabBorder:   "rgba(255, 255, 255, 0.08)",
    text:        "#f8fafc",
    textMuted:   "rgba(148, 163, 184, 0.85)",
    textFaint:   "rgba(148, 163, 184, 0.55)",
    label:       "rgba(148, 163, 184, 0.8)",
    btnBg:       "hsl(187, 92%, 46%)",
    btnText:     "hsl(222, 35%, 6%)",
    btnShadow:   "0 4px 24px hsl(187 92% 46% / 0.35)",
    orb1:        "hsl(187, 92%, 46%, 0.09)",
    orb2:        "hsl(210, 80%, 60%, 0.06)",
    orb3:        "hsl(280, 60%, 60%, 0.04)",
    particleL:   58,
    particleA:   0.45,
    dotA:        0.12,
  },
  light: {
    // Soft, eye-friendly off-white / light slate (NOT blinding #fff, matching reference)
    bg:          "hsl(215, 28%, 95%)",
    card:        "rgba(255, 255, 255, 0.98)",
    cardBorder:  "rgba(226, 232, 240, 0.95)",
    cardShadow:  "0 24px 60px -12px rgba(15, 23, 42, 0.09), 0 0 0 1px rgba(0, 0, 0, 0.04)",
    fieldBg:     "#f8fafc",
    fieldBorder: "#cbd5e1",
    fieldFocus:  "#ffffff",
    tabBg:       "#f1f5f9",
    tabBorder:   "#e2e8f0",
    text:        "#0f172a",
    textMuted:   "#475569",
    textFaint:   "#94a3b8",
    label:       "#334155",
    btnBg:       "hsl(187, 92%, 43%)",
    btnText:     "#ffffff",
    btnShadow:   "0 4px 20px hsl(187 92% 43% / 0.35)",
    orb1:        "hsl(187, 85%, 60%, 0.12)",
    orb2:        "hsl(210, 85%, 65%, 0.09)",
    orb3:        "hsl(280, 70%, 70%, 0.05)",
    particleL:   45,
    particleA:   0.25,
    dotA:        0.06,
  },
} as const;

type ThemeKey = "dark" | "light";

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ic = {
  Shield: ({ s }: { s?: number }) => (
    <svg width={s ?? 32} height={s ?? 32} viewBox="0 0 48 48" fill="none">
      <path d="M24 4L8 11v11c0 9.5 7.2 18.4 16 21 8.8-2.6 16-11.5 16-21V11L24 4z"
        fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M16 24l5.5 5.5L32 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="24" cy="14" r="2" fill="currentColor" fillOpacity=".6"/>
    </svg>
  ),
  User: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 17c0-3.314 2.686-6 6-6h2c3.314 0 6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Lock: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="13.5" r="1.2" fill="currentColor"/>
    </svg>
  ),
  Eye: ({ off, s = 16 }: { off?: boolean; s?: number }) => off ? (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M3 3l14 14M8.5 8.7A3 3 0 0111.3 11.5M6.4 6.5C4.7 7.7 3.5 9 3.5 10c0 2 3 5 6.5 5 1.3 0 2.5-.4 3.5-1M10 5c3.5 0 6.5 3 6.5 5 0 .7-.3 1.5-.9 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ) : (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <ellipse cx="10" cy="10" rx="8.5" ry="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  Login: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4M9 14l4-4-4-4M13 10H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  UserPlus: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 17c0-3.314 2.686-6 6-6M15 10v6M12 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Globe: ({ s = 15 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2c-2 2.5-3 5-3 8s1 5.5 3 8M10 2c2 2.5 3 5 3 8s-1 5.5-3 8M2 10h16" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  Sun: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.4 4.4l1.1 1.1M14.5 14.5l1.1 1.1M4.4 15.6l1.1-1.1M14.5 5.5l1.1-1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Moon: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M17 12.5A7.5 7.5 0 017.5 3a7.5 7.5 0 100 14A7.5 7.5 0 0017 12.5z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  Warn: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M8.69 3.41L1.84 15.5A1.5 1.5 0 003.14 17.5h13.7a1.5 1.5 0 001.3-2.24L11.3 3.41a1.5 1.5 0 00-2.6 0z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Check: ({ s = 36 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6.5 10l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Chevron: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Tag: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 3H4a1 1 0 00-1 1v6l7 7 7-7-7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="7" cy="8" r="1" fill="currentColor"/>
    </svg>
  ),
  Hash: ({ s = 16 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M4 8h12M4 12h12M8 4l-1.5 12M11.5 4L10 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

// ── Particles ─────────────────────────────────────────────────────────────────
function Particles({ tk }: { tk: typeof THEME[ThemeKey] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tkRef = useRef(tk);
  tkRef.current = tk;

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let id: number;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);

    const COUNT = Math.min(60, Math.floor(window.innerWidth * window.innerHeight / 18000));
    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: Math.random() * 1.5 + .4,
      a: Math.random() * .4 + .1,
    }));

    const draw = () => {
      const { particleL, particleA } = tkRef.current;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of pts) {
        p.x = (p.x + p.vx + c.width) % c.width;
        p.y = (p.y + p.vy + c.height) % c.height;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(174,72%,${particleL}%,${p.a * (particleA / 0.45)})`;
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `hsla(174,72%,${particleL - 8}%,${0.12 * (particleA / 0.45) * (1 - d / 120)})`;
          ctx.lineWidth = .5; ctx.stroke();
        }
      }
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(id); };
  }, []);

  return <canvas ref={ref} className="fixed inset-0 w-full h-full pointer-events-none z-0" aria-hidden />;
}

// ── Input Field ───────────────────────────────────────────────────────────────
function Field({
  id, label, type = "text", value, onChange, placeholder,
  required, autoComplete, dir = "ltr", icon, suffix, tk,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean;
  autoComplete?: string; dir?: "ltr" | "rtl";
  icon?: React.ReactNode; suffix?: React.ReactNode;
  tk: typeof THEME[ThemeKey];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} style={{ color: tk.label }}
        className="block text-[10.5px] font-bold tracking-[0.12em] uppercase mb-1.5 select-none transition-colors">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 transition-colors duration-200"
            style={{ color: focused ? "hsl(174,72%,50%)" : tk.textFaint }}>
            {icon}
          </span>
        )}
        <input
          id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required} autoComplete={autoComplete} dir={dir}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            paddingInlineStart: icon ? "2.75rem" : "1rem",
            paddingInlineEnd: suffix ? "3rem" : "1rem",
            background: focused ? tk.fieldFocus : tk.fieldBg,
            border: `1px solid ${focused ? "hsl(174,72%,50%,0.5)" : tk.fieldBorder}`,
            color: tk.text,
            boxShadow: focused ? "0 0 0 3px hsl(174 72% 50% / 0.12), inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.03)",
            outline: "none",
          }}
          className="w-full h-11 rounded-xl text-sm font-medium transition-all duration-200 placeholder:opacity-30"
        />
        {/* Cyan underline on focus */}
        <span className="absolute bottom-0 start-5 end-5 h-px rounded-full bg-primary transition-all duration-300"
          style={{ opacity: focused ? 1 : 0, transform: focused ? "scaleX(1)" : "scaleX(0)" }} />
        {suffix && <span className="absolute end-3 top-1/2 -translate-y-1/2 z-10">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectField({ id, label, value, onChange, options, icon, tk }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; icon?: React.ReactNode;
  tk: typeof THEME[ThemeKey];
}) {
  return (
    <div>
      <label htmlFor={id} style={{ color: tk.label }}
        className="block text-[10.5px] font-bold tracking-[0.12em] uppercase mb-1.5 select-none">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"
            style={{ color: tk.textFaint }}>{icon}</span>
        )}
        <select id={id} value={value} onChange={e => onChange(e.target.value)}
          style={{
            paddingInlineStart: icon ? "2.75rem" : "1rem", paddingInlineEnd: "2.5rem",
            background: tk.fieldBg, border: `1px solid ${tk.fieldBorder}`,
            color: tk.text, outline: "none",
          }}
          className="w-full h-11 rounded-xl text-sm font-medium appearance-none cursor-pointer transition-all duration-200
            focus:ring-2 focus:ring-primary/20 focus:border-primary/50">
          {options.map(o => (
            <option key={o.value} value={o.value} style={{ background: "hsl(222,28%,8%)" }}>{o.label}</option>
          ))}
        </select>
        <span className="absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: tk.textFaint }}>
          <Ic.Chevron />
        </span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAttendanceAuth();
  const { t, lang, setLang, isRTL } = useLang();
  const { toggleTheme, isDark } = useTheme();

  // Theme tokens: Dark mode and calm non-glaring light mode
  const tk: typeof THEME[ThemeKey] = isDark ? THEME.dark : THEME.light;

  const [tab, setTab] = useState<Tab>("login");
  const [lockRemaining, setLockRemaining] = useState(getLockoutRemaining);

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
    const timer = setInterval(() => { const r = getLockoutRemaining(); setLockRemaining(r); if (!r) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [lockRemaining]);

  useEffect(() => {
    if (!loading && user && role) navigate(getAttendanceDashboardRoute(role), { replace: true });
  }, [loading, navigate, role, user]);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: tk.bg }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 animate-spin"
            style={{ borderColor: "rgba(255,255,255,0.08)", borderTopColor: "hsl(174,72%,50%)" }} />
          <span className="absolute inset-2 text-primary flex items-center justify-center">
            <Ic.Shield s={28} />
          </span>
        </div>
        <p className="text-sm animate-pulse font-medium" style={{ color: tk.textMuted }}>{t.common.loading}</p>
      </div>
    </div>
  );

  if (!loading && user && role) return <Navigate to={getAttendanceDashboardRoute(role)} replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginError(null);
    const ms = getLockoutRemaining(); if (ms > 0) { setLockRemaining(ms); return; }
    setLoginLoading(true);
    let email = username.trim();
    if (!email.includes("@")) {
      const { data } = await supabase.rpc("resolve_login_identifier", { p_identifier: email });
      email = data || `${email}@cyber.local`;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      recordAttempt(false); setLockRemaining(getLockoutRemaining());
      setLoginError(t.auth.loginFailed); setLoginLoading(false); return;
    }
    recordAttempt(true); navigate("/attendance", { replace: true }); setLoginLoading(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault(); setJoinLoading(true);
    const { error } = await supabase.from("join_requests").insert({
      full_name: fullName.trim(), username: joinUsername.trim(), role: joinRole,
      seat_number: seatNumber.trim() || null,
      section_number: sectionNumber ? parseInt(sectionNumber) : null,
      rank_in_list: rankInList ? parseInt(rankInList) : null,
    });
    if (error) { toast.error(lang === "ar" ? "فشل إرسال الطلب." : "Failed to submit."); setJoinLoading(false); return; }
    setJoinSuccess(true); toast.success(t.auth.requestSent); setJoinLoading(false);
  };

  const lockMinutes = Math.ceil(lockRemaining / 60_000);
  const isStudent = joinRole === "student";
  const fieldProps = { tk };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden py-8 px-4"
      style={{ background: tk.bg }}
      dir={isRTL ? "rtl" : "ltr"}>

      {/* Particles */}
      <Particles tk={tk} />

      {/* Glow orbs */}
      <div className="fixed top-[-18%] end-[-8%] w-[580px] h-[580px] rounded-full pointer-events-none blur-[140px]"
        style={{ background: tk.orb1 }} />
      <div className="fixed bottom-[-15%] start-[-8%] w-[480px] h-[480px] rounded-full pointer-events-none blur-[120px]"
        style={{ background: tk.orb2 }} />
      <div className="fixed top-[50%] start-[40%] w-[320px] h-[320px] rounded-full pointer-events-none blur-[100px]"
        style={{ background: tk.orb3 }} />

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, hsl(174 72% 50% / ${tk.dotA}) 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
      }} />

      {/* ── Top bar ── */}
      <div className="fixed top-4 end-4 flex items-center gap-2 z-50">
        <button onClick={() => setLang(lang === "en" ? "ar" : "en")}
          style={{ background: tk.tabBg, border: `1px solid ${tk.tabBorder}`, color: tk.textMuted }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold backdrop-blur-xl transition-all hover:text-white">
          <Ic.Globe /> <span>{lang === "en" ? "عربي" : "EN"}</span>
        </button>
        <button onClick={toggleTheme}
          style={{ background: tk.tabBg, border: `1px solid ${tk.tabBorder}`, color: tk.textMuted }}
          className="w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur-xl transition-all hover:text-white"
          title={isDark ? "Dim mode" : "Deep dark"}>
          {isDark ? <Ic.Sun /> : <Ic.Moon />}
        </button>
      </div>

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[400px] rounded-2xl overflow-hidden"
        style={{
          background: tk.card,
          border: `1px solid ${tk.cardBorder}`,
          boxShadow: tk.cardShadow,
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          animation: "fadeUp .4s cubic-bezier(.16,1,.3,1) both",
        }}>

        {/* Top gradient accent */}
        <div className="h-px w-full" style={{
          background: "linear-gradient(90deg, transparent, hsl(174,72%,50%,0.7) 40%, hsl(210,80%,70%,0.5) 70%, transparent)"
        }} />

        {/* Shimmer overlay (top-left corner glow) */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
          background: "linear-gradient(135deg, hsl(174 72% 50%/0.07) 0%, transparent 45%)",
        }} />

        <div className="relative px-7 pt-8 pb-7 space-y-6">

          {/* ── Logo ── */}
          <div className="flex flex-col items-center gap-3">
            {/* Shield icon with rings */}
            <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
              {/* outer ring */}
              <div className="absolute inset-0 rounded-[20px] animate-pulse"
                style={{ border: "1px solid hsl(174,72%,50%,0.18)" }} />
              {/* inner card */}
              <div className="absolute inset-[4px] rounded-[16px] flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, hsl(174,72%,50%,0.18), hsl(174,72%,30%,0.08))",
                  border: "1px solid hsl(174,72%,50%,0.28)",
                  boxShadow: "0 0 32px hsl(174 72% 50% / 0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}>
                <span className="text-primary"><Ic.Shield s={30} /></span>
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-[22px] font-black tracking-[0.15em] leading-tight" dir="ltr"
                style={{ color: tk.text }}>
                CYBER{" "}
                <span style={{
                  background: "linear-gradient(90deg, hsl(174,72%,55%), hsl(174,85%,70%), hsl(174,72%,55%))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  filter: "drop-shadow(0 0 12px hsl(174 72% 50% / 0.4))",
                }}>TMSAH</span>
              </h1>
              <p className="text-[11px] mt-1 font-medium tracking-wide" style={{ color: tk.textFaint }}>
                {tab === "login" ? t.auth.subtitle : t.auth.joinSubtitle}
              </p>
            </div>
          </div>

          {/* ── Tab switcher ── */}
          <div className="relative flex p-1 rounded-xl" style={{ background: tk.tabBg, border: `1px solid ${tk.tabBorder}` }}>
            {/* sliding indicator */}
            <div className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out"
              style={{
                [isRTL ? "right" : "left"]: tab === "login" ? "4px" : "calc(50%)",
                background: tk.btnBg,
                boxShadow: tk.btnShadow,
              }} />
            {(["login", "join"] as Tab[]).map(tb => (
              <button key={tb} onClick={() => setTab(tb)}
                className="relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold z-10 transition-colors duration-300 select-none"
                style={{ color: tab === tb ? tk.btnText : tk.textMuted }}>
                {tb === "login"
                  ? <><Ic.Login />{t.auth.signIn}</>
                  : <><Ic.UserPlus />{t.auth.joinTitle}</>}
              </button>
            ))}
          </div>

          {/* ══ LOGIN ══ */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              {lockRemaining > 0 && (
                <div className="flex gap-3 p-3.5 rounded-xl"
                  style={{ background: "hsl(38,95%,55%,0.1)", border: "1px solid hsl(38,95%,55%,0.25)" }}>
                  <span style={{ color: "hsl(38,95%,55%)" }} className="shrink-0 mt-0.5"><Ic.Warn /></span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "hsl(38,95%,60%)" }}>{t.auth.lockedOut}</p>
                    <p className="text-xs mt-0.5" style={{ color: tk.textMuted }}>{interpolate(t.auth.lockedOutTimer, { minutes: lockMinutes })}</p>
                  </div>
                </div>
              )}

              <Field id="l-user" label={t.auth.username} value={username} onChange={setUsername}
                placeholder={t.auth.usernamePlaceholder} required autoComplete="username"
                icon={<Ic.User />} {...fieldProps} />
              <Field id="l-pass" label={t.auth.password} type={showPass ? "text" : "password"}
                value={password} onChange={setPassword}
                placeholder={t.auth.passwordPlaceholder} required autoComplete="current-password"
                icon={<Ic.Lock />}
                suffix={
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ color: tk.textFaint }} className="hover:text-primary transition-colors">
                    <Ic.Eye off={showPass} />
                  </button>
                }
                {...fieldProps} />

              {loginError && (
                <div role="alert" className="flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium"
                  style={{ background: "hsl(0,72%,50%,0.1)", border: "1px solid hsl(0,72%,50%,0.25)", color: "hsl(0,72%,65%)" }}>
                  <Ic.Warn /> <span>{loginError}</span>
                </div>
              )}

              <button type="submit" disabled={loginLoading || lockRemaining > 0}
                className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: tk.btnBg,
                  color: tk.btnText,
                  boxShadow: tk.btnShadow,
                }}>
                {loginLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t.auth.signingIn}</span></>
                  : <><Ic.Login /><span>{t.auth.signIn}</span></>}
              </button>

              <p className="text-center text-xs" style={{ color: tk.textFaint }}>
                {lang === "ar" ? "ليس لديك حساب؟" : "No account?"}{" "}
                <button type="button" onClick={() => setTab("join")}
                  className="font-bold hover:underline" style={{ color: "hsl(174,72%,55%)" }}>
                  {t.auth.joinTitle}
                </button>
              </p>
            </form>
          )}

          {/* ══ JOIN ══ */}
          {tab === "join" && (
            joinSuccess ? (
              <div className="flex flex-col items-center gap-5 py-6 text-center">
                <div className="flex items-center justify-center rounded-2xl"
                  style={{ width: 72, height: 72, background: "hsl(174,72%,50%,0.12)", border: "1px solid hsl(174,72%,50%,0.28)" }}>
                  <span className="text-primary"><Ic.Check s={36} /></span>
                </div>
                <div>
                  <h3 className="text-base font-black" style={{ color: tk.text }}>{lang === "ar" ? "تم الإرسال!" : "Sent!"}</h3>
                  <p className="text-sm mt-1" style={{ color: tk.textMuted }}>{t.auth.requestSent}</p>
                </div>
                <button onClick={() => { setJoinSuccess(false); setTab("login"); }}
                  className="h-10 px-6 rounded-xl text-sm font-bold transition-all"
                  style={{ background: tk.btnBg, color: tk.btnText, boxShadow: tk.btnShadow }}>
                  {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoin} className="space-y-3.5">
                <Field id="j-name" label={t.auth.fullName} value={fullName} onChange={setFullName}
                  placeholder={t.auth.fullNamePlaceholder} required dir={isRTL ? "rtl" : "ltr"}
                  icon={<Ic.User />} {...fieldProps} />
                <Field id="j-user" label={t.auth.username} value={joinUsername} onChange={setJoinUsername}
                  placeholder={t.auth.usernamePlaceholder} required autoComplete="username"
                  icon={<Ic.User />} {...fieldProps} />
                <Field id="j-pass" label={t.auth.password} type={showJoinPass ? "text" : "password"}
                  value={joinPassword} onChange={setJoinPassword}
                  placeholder={t.auth.passwordPlaceholder} required autoComplete="new-password"
                  icon={<Ic.Lock />}
                  suffix={
                    <button type="button" onClick={() => setShowJoinPass(v => !v)}
                      style={{ color: tk.textFaint }} className="hover:text-primary transition-colors">
                      <Ic.Eye off={showJoinPass} />
                    </button>
                  }
                  {...fieldProps} />
                <SelectField id="j-role" label={t.auth.chooseRole} value={joinRole}
                  onChange={v => setJoinRole(v as JoinRole)} icon={<Ic.Tag />}
                  options={[
                    { value: "student", label: t.auth.student },
                    { value: "doctor", label: t.auth.doctor },
                    { value: "ta", label: t.auth.ta },
                  ]}
                  {...fieldProps} />
                {isStudent && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="j-seat" label={t.auth.seatNumber} value={seatNumber} onChange={setSeatNumber}
                      placeholder={t.auth.seatNumberPlaceholder} icon={<Ic.Hash />} {...fieldProps} />
                    <Field id="j-sec" label={t.auth.sectionNumber} type="number" value={sectionNumber}
                      onChange={setSectionNumber} placeholder={t.auth.sectionPlaceholder} icon={<Ic.Hash />} {...fieldProps} />
                  </div>
                )}
                {isStudent && (
                  <Field id="j-rank" label={t.auth.rankInList} type="number" value={rankInList}
                    onChange={setRankInList} placeholder={t.auth.rankPlaceholder} icon={<Ic.Hash />} {...fieldProps} />
                )}
                <button type="submit" disabled={joinLoading}
                  className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: tk.btnBg,
                    color: tk.btnText,
                    boxShadow: tk.btnShadow,
                  }}>
                  {joinLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t.auth.submitting}</span></>
                    : <><Ic.UserPlus /><span>{t.auth.submitRequest}</span></>}
                </button>
                <p className="text-center text-xs" style={{ color: tk.textFaint }}>
                  {lang === "ar" ? "لديك حساب؟" : "Have an account?"}{" "}
                  <button type="button" onClick={() => setTab("login")}
                    className="font-bold hover:underline" style={{ color: "hsl(187,92%,45%)" }}>
                    {t.auth.signIn}
                  </button>
                </p>
              </form>
            )
          )}
        </div>

        {/* Bottom rule + footer */}
        <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${tk.cardBorder}, transparent)` }} />
        <p className="text-center text-[10px] py-3 font-medium" style={{ color: tk.textFaint }}>
          © 2026 CYBER TMSAH · {lang === "ar" ? "جامعة حلوان التكنولوجية الدولية" : "Helwan International Technological University"}
        </p>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        input::placeholder { opacity: 0.45; }
        select option { background: var(--card, #ffffff); color: var(--foreground, #0f172a); }
      `}</style>
    </div>
  );
};

export default LoginPage;
