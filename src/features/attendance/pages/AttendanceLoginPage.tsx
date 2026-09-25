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

// ─── Custom Icons ─────────────────────────────────────────────────────────────
const IC = {
  Shield: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 48 48" fill="none">
      <path d="M24 4L8 11v11c0 9.5 7.2 18.4 16 21 8.8-2.6 16-11.5 16-21V11L24 4z" fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M16 24l5.5 5.5L32 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="24" cy="14" r="2" fill="currentColor" fillOpacity=".5"/>
    </svg>
  ),
  User: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 17c0-3.314 2.686-6 6-6h2c3.314 0 6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Lock: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="13.5" r="1.2" fill="currentColor"/>
    </svg>
  ),
  EyeOn: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <ellipse cx="10" cy="10" rx="8.5" ry="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  EyeOff: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <path d="M3 3l14 14M8.5 8.7A3 3 0 0111.3 11.5M6.4 6.5C4.7 7.7 3.5 9 3.5 10c0 2 3 5 6.5 5 1.3 0 2.5-.4 3.5-1M10 5c3.5 0 6.5 3 6.5 5 0 .7-.3 1.5-.9 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  ArrowIn: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4M9 14l4-4-4-4M13 10H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Plus: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 17c0-3.314 2.686-6 6-6M15 10v6M12 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Globe: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2c-2 2.5-3 5-3 8s1 5.5 3 8M10 2c2 2.5 3 5 3 8s-1 5.5-3 8M2 10h16" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  Sun: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.4 4.4l1 1M14.6 14.6l1 1M4.4 15.6l1-1M14.6 5.4l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Moon: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <path d="M17 12.5A7.5 7.5 0 017.5 3a7.5 7.5 0 100 14A7.5 7.5 0 0017 12.5z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  Warn: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <path d="M8.69 3.41L1.84 15.5A1.5 1.5 0 003.14 17.5h13.7a1.5 1.5 0 001.3-2.24L11.3 3.41a1.5 1.5 0 00-2.6 0z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Check: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6.5 10l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Chevron: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Tag: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <path d="M10 3H4a1 1 0 00-1 1v6l7 7 7-7-7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="7" cy="8" r="1" fill="currentColor"/>
    </svg>
  ),
  Hash: ({ cls = "" }) => (
    <svg className={cls} viewBox="0 0 20 20" fill="none">
      <path d="M4 8h12M4 12h12M8 4l-1.5 12M11.5 4L10 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

// ─── Particle canvas ──────────────────────────────────────────────────────────
function Particles({ isDark }: { isDark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let id: number;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const L = isDark ? 58 : 32;
    const COUNT = Math.min(55, Math.floor(window.innerWidth * window.innerHeight / 20000));
    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - .5) * .38, vy: (Math.random() - .5) * .38,
      r: Math.random() * 1.4 + .5,
      a: isDark ? Math.random() * .45 + .15 : Math.random() * .28 + .1,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of pts) {
        p.x = (p.x + p.vx + c.width) % c.width;
        p.y = (p.y + p.vy + c.height) % c.height;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(174,72%,${L}%,${p.a})`; ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 115) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `hsla(174,72%,${L - 5}%,${(isDark ? .1 : .15) * (1 - d / 115)})`;
          ctx.lineWidth = .5; ctx.stroke();
        }
      }
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(id); };
  }, [isDark]);
  return <canvas ref={ref} className="fixed inset-0 w-full h-full pointer-events-none z-0" aria-hidden />;
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ id, label, type = "text", value, onChange, placeholder, required, autoComplete, dir = "ltr", icon, suffix }: {
  id: string; label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; autoComplete?: string; dir?: "ltr" | "rtl";
  icon?: React.ReactNode; suffix?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-bold tracking-widest uppercase text-muted-foreground/60 select-none">
        {label}
      </label>
      <div className="relative group/f">
        {icon && (
          <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within/f:text-primary transition-colors duration-200 pointer-events-none z-10">
            {icon}
          </span>
        )}
        <input
          id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required} autoComplete={autoComplete} dir={dir}
          className="w-full h-11 rounded-xl border border-border/50 bg-muted/25 text-foreground text-sm font-medium
            placeholder:text-muted-foreground/30 transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-muted/40
            hover:border-border"
          style={{ paddingInlineStart: icon ? "2.75rem" : "1rem", paddingInlineEnd: suffix ? "3rem" : "1rem" }}
        />
        {suffix && <span className="absolute end-3 top-1/2 -translate-y-1/2 z-10">{suffix}</span>}
        <span className="absolute bottom-0 start-6 end-6 h-px rounded-full bg-primary scale-x-0 group-focus-within/f:scale-x-100 transition-transform duration-300 origin-center" />
      </div>
    </div>
  );
}

function SelectField({ id, label, value, onChange, options, icon }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-bold tracking-widest uppercase text-muted-foreground/60 select-none">{label}</label>
      <div className="relative">
        {icon && <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none z-10">{icon}</span>}
        <select id={id} value={value} onChange={e => onChange(e.target.value)}
          className="w-full h-11 rounded-xl border border-border/50 bg-muted/25 text-foreground text-sm font-medium
            appearance-none transition-all duration-200 cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
          style={{ paddingInlineStart: icon ? "2.75rem" : "1rem", paddingInlineEnd: "2.5rem" }}>
          {options.map(o => <option key={o.value} value={o.value} className="bg-background">{o.label}</option>)}
        </select>
        <IC.Chevron cls="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAttendanceAuth();
  const { t, lang, setLang, isRTL } = useLang();
  const { toggleTheme, isDark } = useTheme();

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
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <IC.Shield cls="absolute inset-2 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse font-medium">{t.common.loading}</p>
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

  const cardCls = isDark
    ? "bg-[hsl(220,22%,9%)]/90 border border-white/[0.07] shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
    : "bg-white/92 border border-border/60 shadow-[0_24px_64px_rgba(0,0,0,0.1)] backdrop-blur-xl";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background py-8 px-4" dir={isRTL ? "rtl" : "ltr"}>
      <Particles isDark={isDark} />

      {/* Ambient glow */}
      <div className="fixed top-[-20%] end-[-10%] w-[600px] h-[600px] rounded-full bg-primary/[0.08] blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-20%] start-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.06] blur-[120px] pointer-events-none" />

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, hsl(174 72% ${isDark ? 50 : 35}% / ${isDark ? .14 : .2}) 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        opacity: isDark ? .5 : .7,
      }} />

      {/* Controls top-right */}
      <div className="fixed top-4 end-4 flex items-center gap-2 z-50">
        <button onClick={() => setLang(lang === "en" ? "ar" : "en")}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition-all ${cardCls} text-muted-foreground hover:text-foreground`}>
          <IC.Globe cls="w-3.5 h-3.5" />
          <span>{lang === "en" ? "عربي" : "EN"}</span>
        </button>
        <button onClick={toggleTheme}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${cardCls} text-muted-foreground hover:text-foreground`}>
          {isDark ? <IC.Sun cls="w-4 h-4" /> : <IC.Moon cls="w-4 h-4" />}
        </button>
      </div>

      {/* ── Main Card ── */}
      <div className={`relative z-10 w-full max-w-[400px] rounded-2xl ${cardCls} animate-fade-up overflow-hidden`}>

        {/* Top gradient bar */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="px-7 pt-8 pb-7">

          {/* Logo + title */}
          <div className="flex flex-col items-center gap-3 mb-7">
            <div className={`relative flex items-center justify-center w-[66px] h-[66px] rounded-[18px] transition-all duration-300 ${
              isDark
                ? "bg-gradient-to-br from-primary/20 to-cyan-500/10 border border-primary/25 shadow-[0_0_36px_hsl(174_72%_50%/0.2)]"
                : "bg-gradient-to-br from-primary to-[hsl(174,72%,26%)] shadow-[0_8px_28px_hsl(174_72%_38%/0.35)]"
            }`}>
              <IC.Shield cls={`w-8 h-8 ${isDark ? "text-primary" : "text-white"}`} />
              {isDark && <div className="absolute inset-[-5px] rounded-[22px] border border-primary/15 animate-pulse" />}
            </div>

            <div className="text-center">
              <h1 className={`text-[22px] font-black tracking-widest ${
                isDark ? "bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent" : "text-foreground"
              }`} dir="ltr">
                CYBER{" "}
                <span className={isDark ? "bg-gradient-to-r from-primary to-cyan-300 bg-clip-text text-transparent" : "text-primary"}>
                  TMSAH
                </span>
              </h1>
              <p className="text-[11px] text-muted-foreground/55 mt-0.5 font-medium">
                {tab === "login" ? t.auth.subtitle : t.auth.joinSubtitle}
              </p>
            </div>
          </div>

          {/* ── Sliding pill tab switcher ── */}
          <div className={`relative flex p-1 rounded-xl mb-6 ${isDark ? "bg-white/[0.05] border border-white/[0.06]" : "bg-muted/60 border border-border/40"}`}>
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-primary transition-all duration-300 ease-out shadow-[0_2px_16px_hsl(174_72%_50%/0.35)]"
              style={{ [isRTL ? "right" : "left"]: tab === "login" ? "4px" : "calc(50%)" }}
            />
            {(["login", "join"] as Tab[]).map(tb => (
              <button key={tb} onClick={() => setTab(tb)}
                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold z-10 transition-colors duration-300 select-none ${
                  tab === tb ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {tb === "login"
                  ? <><IC.ArrowIn cls="w-4 h-4" />{t.auth.signIn}</>
                  : <><IC.Plus cls="w-4 h-4" />{t.auth.joinTitle}</>}
              </button>
            ))}
          </div>

          {/* ══ LOGIN ══ */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              {lockRemaining > 0 && (
                <div className="flex gap-3 p-3.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.08]">
                  <IC.Warn cls="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-500">{t.auth.lockedOut}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{interpolate(t.auth.lockedOutTimer, { minutes: lockMinutes })}</p>
                  </div>
                </div>
              )}
              <Field id="l-user" label={t.auth.username} value={username} onChange={setUsername}
                placeholder={t.auth.usernamePlaceholder} required autoComplete="username"
                icon={<IC.User cls="w-4 h-4" />} />
              <Field id="l-pass" label={t.auth.password} type={showPass ? "text" : "password"}
                value={password} onChange={setPassword}
                placeholder={t.auth.passwordPlaceholder} required autoComplete="current-password"
                icon={<IC.Lock cls="w-4 h-4" />}
                suffix={
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="text-muted-foreground/50 hover:text-primary transition-colors">
                    {showPass ? <IC.EyeOff cls="w-4 h-4" /> : <IC.EyeOn cls="w-4 h-4" />}
                  </button>
                }
              />
              {loginError && (
                <div role="alert" className="flex items-center gap-2.5 p-3 rounded-xl border border-destructive/25 bg-destructive/[0.08] text-sm text-destructive font-medium">
                  <IC.Warn cls="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
              <button type="submit" disabled={loginLoading || lockRemaining > 0}
                className="w-full h-11 mt-1 rounded-xl font-bold text-sm flex items-center justify-center gap-2
                  bg-primary text-primary-foreground
                  hover:bg-primary/90 active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                  shadow-[0_4px_20px_hsl(174_72%_50%/0.3)] hover:shadow-[0_4px_28px_hsl(174_72%_50%/0.45)]">
                {loginLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t.auth.signingIn}</span></>
                  : <><IC.ArrowIn cls="w-4 h-4" /><span>{t.auth.signIn}</span></>}
              </button>
              <p className="text-center text-xs text-muted-foreground/60 pt-0.5">
                {lang === "ar" ? "ليس لديك حساب؟" : "No account?"}{" "}
                <button type="button" onClick={() => setTab("join")} className="text-primary hover:underline font-bold">
                  {t.auth.joinTitle}
                </button>
              </p>
            </form>
          )}

          {/* ══ JOIN ══ */}
          {tab === "join" && (
            joinSuccess ? (
              <div className="flex flex-col items-center gap-5 py-6 text-center">
                <div className={`flex items-center justify-center rounded-2xl ${
                  isDark ? "bg-primary/15 border border-primary/25" : "bg-primary/10 border border-primary/20"
                }`} style={{ width: 72, height: 72 }}>
                  <IC.Check cls="w-9 h-9 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-black">{lang === "ar" ? "تم الإرسال!" : "Sent!"}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t.auth.requestSent}</p>
                </div>
                <button onClick={() => { setJoinSuccess(false); setTab("login"); }}
                  className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-[0_4px_16px_hsl(174_72%_50%/0.3)]">
                  {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoin} className="space-y-3.5">
                <Field id="j-name" label={t.auth.fullName} value={fullName} onChange={setFullName}
                  placeholder={t.auth.fullNamePlaceholder} required dir={isRTL ? "rtl" : "ltr"}
                  icon={<IC.User cls="w-4 h-4" />} />
                <Field id="j-user" label={t.auth.username} value={joinUsername} onChange={setJoinUsername}
                  placeholder={t.auth.usernamePlaceholder} required autoComplete="username"
                  icon={<IC.User cls="w-4 h-4" />} />
                <Field id="j-pass" label={t.auth.password} type={showJoinPass ? "text" : "password"}
                  value={joinPassword} onChange={setJoinPassword}
                  placeholder={t.auth.passwordPlaceholder} required autoComplete="new-password"
                  icon={<IC.Lock cls="w-4 h-4" />}
                  suffix={
                    <button type="button" onClick={() => setShowJoinPass(v => !v)}
                      className="text-muted-foreground/50 hover:text-primary transition-colors">
                      {showJoinPass ? <IC.EyeOff cls="w-4 h-4" /> : <IC.EyeOn cls="w-4 h-4" />}
                    </button>
                  }
                />
                <SelectField id="j-role" label={t.auth.chooseRole} value={joinRole}
                  onChange={v => setJoinRole(v as JoinRole)} icon={<IC.Tag cls="w-4 h-4" />}
                  options={[
                    { value: "student", label: t.auth.student },
                    { value: "doctor", label: t.auth.doctor },
                    { value: "ta", label: t.auth.ta },
                  ]}
                />
                {isStudent && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="j-seat" label={t.auth.seatNumber} value={seatNumber} onChange={setSeatNumber}
                      placeholder={t.auth.seatNumberPlaceholder} icon={<IC.Hash cls="w-4 h-4" />} />
                    <Field id="j-sec" label={t.auth.sectionNumber} type="number" value={sectionNumber}
                      onChange={setSectionNumber} placeholder={t.auth.sectionPlaceholder} icon={<IC.Hash cls="w-4 h-4" />} />
                  </div>
                )}
                {isStudent && (
                  <Field id="j-rank" label={t.auth.rankInList} type="number" value={rankInList}
                    onChange={setRankInList} placeholder={t.auth.rankPlaceholder} icon={<IC.Hash cls="w-4 h-4" />} />
                )}
                <button type="submit" disabled={joinLoading}
                  className="w-full h-11 mt-1 rounded-xl font-bold text-sm flex items-center justify-center gap-2
                    bg-primary text-primary-foreground
                    hover:bg-primary/90 active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                    shadow-[0_4px_20px_hsl(174_72%_50%/0.3)] hover:shadow-[0_4px_28px_hsl(174_72%_50%/0.45)]">
                  {joinLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t.auth.submitting}</span></>
                    : <><IC.Plus cls="w-4 h-4" /><span>{t.auth.submitRequest}</span></>}
                </button>
                <p className="text-center text-xs text-muted-foreground/60 pt-0.5">
                  {lang === "ar" ? "لديك حساب؟" : "Have an account?"}{" "}
                  <button type="button" onClick={() => setTab("login")} className="text-primary hover:underline font-bold">
                    {t.auth.signIn}
                  </button>
                </p>
              </form>
            )
          )}
        </div>

        {/* Bottom rule + footer */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <p className="text-center text-[10px] text-muted-foreground/35 py-3 font-medium">
          © 2026 CYBER TMSAH · {lang === "ar" ? "جامعة حلوان التكنولوجية الدولية" : "Helwan International Technological University"}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
