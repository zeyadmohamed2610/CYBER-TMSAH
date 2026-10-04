import { ForgotPasswordModal } from "@/features/auth/components/ForgotPasswordModal";
import { LoadingScreen } from "@/shared/components/Loading";
import { Link } from "react-router-dom";
import { AuthIcons as Icon } from "../components/AuthIcons";

import { JoinRequestForm } from "../components/JoinRequestForm";
import { SignInForm } from "../components/SignInForm";
import { useLoginForm } from "../hooks/useLoginForm";
type Tab = "login" | "join";
const LoginPage = ({ initialTab }: { initialTab?: Tab }) => {
  const model = useLoginForm(initialTab);
  const {
    loading,
    t,
    lang,
    isRTL,
    tab,
    showForgotModal,
    setShowForgotModal,
    joinSuccess,
    setJoinSuccess,
    handleTabChange,
    hasSavedSession,
    authBusy,
  } = model;
  if (loading && hasSavedSession) {
    return (
      <LoadingScreen
        message={
          lang === "ar"
            ? "جاري استعادة الجلسة والتحقق من الصلاحيات..."
            : "Restoring session & verifying access..."
        }
        submessage="نظام CYBER-TMSAH"
      />
    );
  }
  return (
    <main
      className="auth-entry min-h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-x-hidden overflow-y-auto px-4 py-5 sm:py-8"
      dir={isRTL ? "rtl" : "ltr"}
      style={{ background: "#02060F" }}
    >
      {/* ── Background: layered gradients ───────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {/* Deep purple blob — top */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "10%",
            width: "70vw",
            height: "70vh",
            background:
              "radial-gradient(ellipse at center, rgba(79,70,229,0.13) 0%, transparent 65%)",
            filter: "blur(40px)",
          }}
        />
        {/* Blue blob — bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: "-15%",
            right: "5%",
            width: "50vw",
            height: "55vh",
            background:
              "radial-gradient(ellipse at center, rgba(59,130,246,0.09) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
        {/* Noise texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.025,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
        {/* Subtle grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 1,
            backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Brand Wordmark as the Logo ─────────────────────────────────── */}
      <div
        className="relative z-10 flex flex-col items-center mb-4 select-none text-center"
        style={{ animation: "rise 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Hero Wordmark */}
        <Link
          to="/"
          aria-label="الصفحة الرئيسية — سايبر تمساح"
          className="flex items-center justify-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-purple-300"
          dir="ltr"
        >
          <img
            src="/brand/logo-small.webp"
            alt=""
            width="44"
            height="44"
            className="h-9 w-9 md:h-11 md:w-11 shrink-0 object-contain"
          />
          <span
            className="font-black text-white text-[23px] md:text-[30px] tracking-[0.14em]"
            style={{
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "0.14em",
              textShadow: "0 2px 24px rgba(255,255,255,0.22)",
            }}
          >
            CYBER
          </span>
          <span
            className="font-black text-[23px] md:text-[30px] tracking-[0.14em]"
            style={{
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "0.14em",
              background: "linear-gradient(135deg, #E9D5FF 0%, #C084FC 50%, #9333EA 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 20px rgba(147,51,234,0.5))",
            }}
          >
            TMSAH
          </span>
        </Link>

        {/* System Descriptor Pill */}
        <div
          className="inline-flex items-center gap-2 mt-2 px-3.5 py-1 rounded-full"
          style={{
            background: "rgba(147,51,234,0.08)",
            border: "1px solid rgba(147,51,234,0.25)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11.5px] font-semibold tracking-wider text-slate-300">
            {lang === "ar" ? "منصتك لمتابعة الدراسة والحضور" : "Your academic attendance platform"}
          </span>
        </div>
      </div>

      {/* ── Card Container with Ambient Depth ─────────────────────────── */}
      <div className="relative z-30 w-full flex flex-col items-center">
        {/* Soft radial spotlight behind card */}
        <div
          className="absolute pointer-events-none -z-10"
          style={{
            width: "560px",
            height: "560px",
            background:
              "radial-gradient(circle, rgba(147,51,234,0.18) 0%, rgba(126,34,206,0.06) 45%, transparent 70%)",
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
          }}
        >
          {/* Card top accent line */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.7) 50%, transparent 100%)",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
            }}
          />

          <div className="px-4 sm:px-7 py-5 sm:py-6">
            {/* ── Card header ─────────────────────────────────────────── */}
            <div className="mb-4">
              <h1 className="font-bold text-white text-[22px] tracking-tight">
                {tab === "login"
                  ? lang === "ar"
                    ? "تسجيل الدخول"
                    : "Sign in"
                  : lang === "ar"
                    ? "طلب الانضمام"
                    : "Request Access"}
              </h1>
              <p className="mt-1 text-[13px] text-slate-400 font-normal">
                {tab === "login"
                  ? lang === "ar"
                    ? "أدخل بيانات حسابك الأكاديمي للمتابعة"
                    : "Enter your academic credentials to continue"
                  : lang === "ar"
                    ? "أرسل بياناتك لاعتماد حسابك في المنصة"
                    : "Submit your information to join the platform"}
              </p>
            </div>

            {/* ── Modern Premium Segmented Pill Tabs ─────────────────────── */}
            <div
              role="tablist"
              aria-label="الدخول وطلب الانضمام"
              className="relative p-1 mb-4 rounded-xl bg-white/[0.04] border border-white/[0.08] grid grid-cols-2 gap-1 shadow-inner"
            >
              {(["login", "join"] as Tab[]).map((tb) => {
                const isActive = tab === tb;
                return (
                  <button
                    key={tb}
                    type="button"
                    role="tab"
                    id={`auth-tab-${tb}`}
                    aria-controls={`auth-panel-${tb}`}
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    disabled={authBusy}
                    onKeyDown={(event) => {
                      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                      event.preventDefault();
                      const next: Tab =
                        event.key === "Home"
                          ? "login"
                          : event.key === "End"
                            ? "join"
                            : tb === "login"
                              ? "join"
                              : "login";
                      handleTabChange(next);
                      document.getElementById(`auth-tab-${next}`)?.focus();
                    }}
                    onClick={() => handleTabChange(tb)}
                    className="relative min-h-11 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-purple-300 flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{
                      background: isActive
                        ? "linear-gradient(135deg, rgba(147, 51, 234, 0.35) 0%, rgba(126, 34, 206, 0.2) 100%)"
                        : "transparent",
                      border: isActive
                        ? "1px solid rgba(168, 85, 247, 0.55)"
                        : "1px solid transparent",
                      color: isActive ? "#FFFFFF" : "#94A3B8",
                      boxShadow: isActive
                        ? "0 4px 18px rgba(147, 51, 234, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                        : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = "#FFFFFF";
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = "#94A3B8";
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {isActive && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"
                        style={{ boxShadow: "0 0 8px #C084FC" }}
                      />
                    )}
                    <span className="tracking-wide">
                      {tb === "login" ? t.auth.signIn : t.auth.joinTitle}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ══════ LOGIN ══════ */}
            <div role="tabpanel" id={`auth-panel-${tab}`} aria-labelledby={`auth-tab-${tab}`}>
              {tab === "login" && <SignInForm model={model} />}

              {/* ══════ JOIN ══════ */}
              {tab === "join" &&
                (joinSuccess ? (
                  <div className="flex flex-col items-center gap-5 py-6 text-center">
                    <div
                      className="flex items-center justify-center w-16 h-16 rounded-2xl"
                      style={{
                        background: "rgba(147,51,234,0.15)",
                        border: "1px solid rgba(147,51,234,0.35)",
                      }}
                    >
                      <span style={{ color: "#C084FC" }}>
                        <Icon.Check />
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">
                        {lang === "ar" ? "تم إرسال طلبك بنجاح!" : "Request Sent!"}
                      </p>
                      <p className="text-[13px] mt-1 text-slate-400">{t.auth.requestSent}</p>
                    </div>
                    <button
                      onClick={() => {
                        setJoinSuccess(false);
                        handleTabChange("login");
                      }}
                      className="h-11 px-7 rounded-xl text-sm font-semibold text-white cursor-pointer active:scale-[0.98] transition-all"
                      style={{
                        background: "linear-gradient(180deg, #9333EA 0%, #7E22CE 100%)",
                        boxShadow:
                          "0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 18px rgba(147,51,234,0.45)",
                      }}
                    >
                      {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                    </button>
                  </div>
                ) : (
                  <JoinRequestForm model={model} />
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Page footer ──────────────────────────────────────────────── */}
      <div
        className="relative z-0 mt-4 text-center"
        style={{ animation: "rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both" }}
      >
        <p className="text-[12px] font-medium text-slate-400">
          © 2026 CYBER TMSAH ·{" "}
          {lang === "ar"
            ? "جامعة حلوان التكنولوجية الدولية"
            : "Helwan International Technological University"}
        </p>
      </div>

      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />

      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .auth-entry input::placeholder { color: #94A3B8; }
        @media (prefers-reduced-motion: reduce) {
          .auth-entry *, .auth-entry *::before, .auth-entry *::after { animation: none !important; transition: none !important; }
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { opacity: 0; }
      `}</style>
    </main>
  );
};
export default LoginPage;
