// src/features/auth/components/ForgotPasswordModal.tsx
import { useState } from "react";
import { X, KeyRound, Mail, Send, CheckCircle2, ShieldAlert, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { recordAuditLog } from "../services/auditService";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
  isRTL: boolean;
}

export function ForgotPasswordModal({ isOpen, onClose, lang, isRTL }: ForgotPasswordModalProps) {
  const [emailOrId, setEmailOrId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = emailOrId.trim();
    if (!identifier) return;

    setSubmitting(true);
    try {
      if (identifier.includes("@")) {
        const { error } = await supabase.auth.resetPasswordForEmail(identifier, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
      }

      await recordAuditLog({
        action: "password_reset_request",
        identifier,
      });

      setSentSuccess(true);
      toast.success(
        lang === "ar"
          ? "تم إرسال طلب إعادة التعيين بنجاح."
          : "Password reset request submitted successfully."
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error";
      toast.error(lang === "ar" ? "تعذر إرسال الطلب، تأكد من البيانات." : errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const copySupportContact = () => {
    navigator.clipboard.writeText("support@cyber-tmsah.edu");
    toast.success(lang === "ar" ? "تم نسخ بريد الدعم الفني!" : "Support email copied!");
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-up"
      dir={isRTL ? "rtl" : "ltr"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-cyan-500/30 bg-slate-950/95 backdrop-blur-2xl p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(6,182,212,0.15)] space-y-5"
        style={{
          boxShadow: "0 25px 70px rgba(0,0,0,0.9), 0 0 35px rgba(6,182,212,0.18)",
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 end-4 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100">
              {lang === "ar" ? "استعادة كلمة المرور" : "Reset Password"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === "ar"
                ? "أدخل بريدك الإلكتروني المسجل أو كود الطالب"
                : "Enter your registered email or student ID"}
            </p>
          </div>
        </div>

        {sentSuccess ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2.5 text-center animate-fade-up">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-black text-emerald-400">
              {lang === "ar" ? "تم تسجيل طلبك بنجاح" : "Request Submitted"}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === "ar"
                ? "إذا كان بريدك مسجلاً بالنظام فستصلك رسالة إعادة التعيين. للطلاب وأصحاب أرقام القيد، سيقوم المشرف بمراجعة طلبك وتحديث الحساب."
                : "If your email is registered, a reset link has been dispatched. For student ID accounts, the coordinator will review your request."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full h-10 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition-all"
            >
              {lang === "ar" ? "إغلاق" : "Close"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                {lang === "ar" ? "البريد الإلكتروني أو كود الطالب" : "Email or Student ID"}
              </label>
              <div className="relative">
                <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                  placeholder={lang === "ar" ? "name@domain.com أو 2024001" : "name@domain.com or ID"}
                  className="w-full h-11 ps-10 pe-3.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-[0_4px_20px_rgba(6,182,212,0.35)]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{lang === "ar" ? "إرسال طلب الاستعادة" : "Send Reset Request"}</span>
                </>
              )}
            </button>

            {/* Support Box */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>{lang === "ar" ? "هل تحتاج لمساعدة فورية؟" : "Need Instant Help?"}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {lang === "ar"
                  ? "يمكن للطلاب مراجعة شؤون الطلاب أو مسؤول الفرقة الميداني، أو التواصل مع مسؤول النظام عبر البريد."
                  : "Students can contact the student affairs coordinator or reach system administrators via email."}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={copySupportContact}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{lang === "ar" ? "نسخ بريد الدعم" : "Copy Support"}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
