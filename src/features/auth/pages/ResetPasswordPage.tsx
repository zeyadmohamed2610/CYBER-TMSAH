// src/features/auth/pages/ResetPasswordPage.tsx
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useLang } from "@/i18n";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";

export default function ResetPasswordPage() {
  const { lang, isRTL } = useLang();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if the user arrived via a valid recovery token/session from Supabase
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Supabase parses hash fragments like #access_token=... into an active session
      if (session) {
        setValidSession(true);
      } else {
        // Listen to auth state change in case hash is still processing
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
          if (event === "PASSWORD_RECOVERY" || s) {
            setValidSession(true);
          }
        });
        // Give 1.5s grace period before showing expired/missing warning
        const timer = setTimeout(() => {
          setValidSession((prev) => (prev === null ? false : prev));
        }, 1500);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      }
    };

    void checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      toast.error(
        lang === "ar"
          ? "يجب أن لا تقل كلمة المرور عن 6 خانات"
          : "Password must be at least 6 characters"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        lang === "ar"
          ? "كلمتا المرور غير متطابقتين"
          : "Passwords do not match"
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);
      toast.success(
        lang === "ar"
          ? "تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول."
          : "Password updated successfully! You can now log in."
      );

      // Auto redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      toast.error(
        lang === "ar"
          ? `فشل تعيين كلمة المرور: ${msg}`
          : `Failed to update password: ${msg}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 bg-[#07090E] relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Background ambient mesh */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/10 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-violet-600/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        <div className="rounded-3xl border border-indigo-500/20 bg-[#0B0F19]/90 backdrop-blur-2xl p-7 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_30px_rgba(99,102,241,0.15)] space-y-6">
          {/* Brand header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {lang === "ar" ? "تعيين كلمة مرور جديدة" : "Set New Password"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {lang === "ar"
                ? "أدخل كلمة المرور الجديدة لحسابك لتسجيل الدخول بأمان"
                : "Enter your new account password to regain secure access"}
            </p>
          </div>

          {success ? (
            <div className="text-center py-6 space-y-4 animate-fade-up">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-emerald-400">
                  {lang === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Password Changed"}
                </h3>
                <p className="text-xs text-slate-300">
                  {lang === "ar"
                    ? "جارٍ تحويلك تلقائياً لصفحة تسجيل الدخول..."
                    : "Redirecting you to the login page..."}
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 transition-all shadow-[0_4px_16px_rgba(79,70,229,0.35)]"
              >
                <span>{lang === "ar" ? "تسجيل الدخول الآن" : "Go to Login"}</span>
                <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
              </Link>
            </div>
          ) : validSession === false ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">
                  {lang === "ar" ? "رابط الاستعادة غير متوفر أو منتهي الصلاحية" : "Reset Link Expired or Invalid"}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {lang === "ar"
                    ? "إذا انتهت صلاحية الرابط، يمكنك طلب رابط جديد من صفحة تسجيل الدخول أو مراسلة المشرف عبر واتساب."
                    : "The reset link has expired. Request a new link or contact your admin via WhatsApp."}
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-white/10 text-white font-semibold text-xs hover:bg-white/15 transition-all"
              >
                <span>{lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Login"}</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === "ar" ? "كلمة المرور الجديدة" : "New Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full h-11 ps-10 pe-11 rounded-xl text-sm font-medium bg-white/[0.045] border border-white/12 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={newPassword} lang={lang} />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === "ar" ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full h-11 ps-10 pe-3.5 rounded-xl text-sm font-medium bg-white/[0.045] border border-white/12 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white active:scale-[0.985] transition-all disabled:opacity-50 cursor-pointer shadow-[0_4px_20px_rgba(79,70,229,0.45)] mt-2"
                style={{
                  background: "linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{lang === "ar" ? "حفظ كلمة المرور الجديدة" : "Save New Password"}</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {lang === "ar" ? "العودة لصفحة تسجيل الدخول" : "Return to login"}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
