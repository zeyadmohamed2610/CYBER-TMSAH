import { Loader2 } from "lucide-react";
import type { useLoginForm } from "../hooks/useLoginForm";
import { Field, IdentifierBadge, PrimaryButton as PrimaryBtn } from "./AuthFormControls";
import { AuthIcons as Icon } from "./AuthIcons";

export function SignInForm({ model }: { model: ReturnType<typeof useLoginForm> }) {
  const {
    t,
    lang,
    interpolate,
    lockRemaining,
    passRef,
    username,
    setUsername,
    password,
    setPassword,
    showPass,
    setShowPass,
    rememberMe,
    setRememberMe,
    setShowForgotModal,
    loginError,
    loginLoading,
    passkeyLoading,
    isCapsLockOn,
    setIsCapsLockOn,
    handleTabChange,
    handleLogin,
    handlePasskeyLogin,
    lockMins,
  } = model;
  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {lockRemaining > 0 && (
        <div
          className="flex items-start gap-2.5 p-3.5 rounded-xl text-[13px]"
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
            color: "#FCD34D",
          }}
        >
          <span className="shrink-0 mt-[1px]">
            <Icon.AlertTriangle />
          </span>
          <span>{interpolate(t.auth.lockedOutTimer, { minutes: lockMins })}</span>
        </div>
      )}

      <Field
        id="l-user"
        name="identifier"
        label={
          lang === "ar"
            ? "اسم المستخدم / البريد الإلكتروني / الرقم القومي"
            : "Username / Email / National ID"
        }
        value={username}
        onChange={setUsername}
        placeholder={
          lang === "ar"
            ? "أدخل اسم المستخدم، البريد، أو الرقم القومي (14 رقم)"
            : "Enter username, email, or 14-digit National ID"
        }
        required
        autoComplete="username"
        autoFocus={typeof window !== "undefined" && window.innerWidth >= 768}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            passRef.current?.focus();
          }
        }}
        badge={<IdentifierBadge identifier={username} />}
        icon={<Icon.User />}
      />

      <div className="relative">
        <Field
          id="l-pass"
          name="password"
          label={t.auth.password}
          type={showPass ? "text" : "password"}
          value={password}
          onChange={setPassword}
          placeholder={t.auth.passwordPlaceholder}
          required
          autoComplete="current-password"
          inputRef={passRef}
          icon={<Icon.Lock />}
          onKeyDown={(e) => {
            if (e.getModifierState) setIsCapsLockOn(e.getModifierState("CapsLock"));
          }}
          onKeyUp={(e) => {
            if (e.getModifierState) setIsCapsLockOn(e.getModifierState("CapsLock"));
          }}
          suffix={
            <button
              type="button"
              aria-label={
                showPass
                  ? lang === "ar"
                    ? "إخفاء كلمة المرور"
                    : "Hide password"
                  : lang === "ar"
                    ? "إظهار كلمة المرور"
                    : "Show password"
              }
              aria-pressed={showPass}
              onClick={() => setShowPass((v) => !v)}
              className="flex items-center justify-center w-11 h-11 rounded-md cursor-pointer transition-colors text-slate-400 hover:text-white"
            >
              <Icon.Eye off={showPass} />
            </button>
          }
        />
        {isCapsLockOn && (
          <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-amber-400 px-1 animate-pulse">
            <span>⚠️</span>
            <span>{lang === "ar" ? "زر الحروف الكبيرة (Caps Lock) مفعّل" : "Caps Lock is on"}</span>
          </div>
        )}
      </div>

      {/* Remember + Forgot */}
      <div className="flex items-center justify-between pt-0.5">
        <label className="flex items-center gap-2 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: "#9333EA" }}
          />
          <span className="text-[12.5px] font-medium text-slate-300 group-hover:text-white transition-colors">
            {lang === "ar" ? "تذكرني" : "Remember me"}
          </span>
        </label>
        <button
          type="button"
          onClick={() => setShowForgotModal(true)}
          className="text-[12.5px] font-semibold text-purple-400 hover:text-purple-300 cursor-pointer transition-colors"
        >
          {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
        </button>
      </div>

      {/* Error */}
      {loginError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-xl text-[13px] font-medium"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#FCA5A5",
          }}
        >
          <span className="shrink-0 mt-[1px]">
            <Icon.AlertTriangle />
          </span>
          <span>{loginError}</span>
        </div>
      )}

      <div className="pt-1.5">
        <PrimaryBtn loading={loginLoading} disabled={lockRemaining > 0}>
          <Icon.LogIn />
          <span>{t.auth.signIn}</span>
        </PrimaryBtn>
      </div>

      {/* Or Divider */}
      <div className="relative flex items-center justify-center my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <span className="relative px-3 text-[11px] font-semibold text-slate-400 bg-[#090D21] uppercase tracking-wider">
          {lang === "ar" ? "أو الدخول السريع" : "Or quick sign in"}
        </span>
      </div>

      {/* Biometric / Passkey Login Button */}
      <button
        type="button"
        onClick={handlePasskeyLogin}
        disabled={passkeyLoading || lockRemaining > 0}
        className="w-full h-11 sm:h-12 rounded-2xl flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold text-white transition-all cursor-pointer relative overflow-hidden group border border-purple-500/40 hover:border-cyan-400 bg-gradient-to-r from-purple-950/40 via-[#0B0E28] to-cyan-950/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] active:scale-[0.98]"
      >
        {passkeyLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
        ) : (
          <span className="text-cyan-400 group-hover:scale-110 transition-transform">
            <Icon.Fingerprint />
          </span>
        )}
        <span className="bg-gradient-to-r from-purple-200 via-white to-cyan-200 bg-clip-text text-transparent group-hover:to-cyan-300">
          {passkeyLoading
            ? lang === "ar"
              ? "جاري فحص البصمة..."
              : "Checking your fingerprint..."
            : lang === "ar"
              ? "تسجيل الدخول بالبصمة"
              : "Sign in with your fingerprint"}
        </span>
      </button>

      <p className="text-center text-[12.5px] pt-1.5 text-slate-400">
        {lang === "ar" ? "ليس لديك حساب؟" : "No account?"}{" "}
        <button
          type="button"
          onClick={() => handleTabChange("join")}
          className="font-semibold text-purple-400 hover:text-purple-300 cursor-pointer transition-colors"
        >
          {t.auth.joinTitle}
        </button>
      </p>
    </form>
  );
}
