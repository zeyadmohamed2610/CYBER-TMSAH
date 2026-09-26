// src/features/auth/components/ForgotPasswordModal.tsx
import { useState } from "react";
import { X, KeyRound, Mail, Send, CheckCircle2, MessageCircle, Copy, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { recordAuditLog } from "../services/auditService";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
  isRTL: boolean;
}

const SUPPORT_WHATSAPP = "01553450232";
const WHATSAPP_LINK = "https://wa.me/201553450232";

export function ForgotPasswordModal({ isOpen, onClose, lang, isRTL }: ForgotPasswordModalProps) {
  const [emailInput, setEmailInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim().toLowerCase();

    // Strict validation: must be a valid Gmail address ending in @gmail.com
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(trimmed)) {
      toast.error(
        lang === "ar"
          ? "شرط الاستعادة: يجب كتابة بريد Gmail صالح ينتهي بـ @gmail.com"
          : "A valid Gmail address ending with @gmail.com is strictly required."
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert into password_reset_requests so admin receives it in the dashboard
      const { error: dbError } = await supabase.from("password_reset_requests").insert({
        email: trimmed,
        status: "pending",
      });

      if (dbError) throw dbError;

      // 2. Trigger Supabase auth reset email if user exists in auth
      try {
        await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      } catch {
        // Continue even if standard auth reset email encounters an issue
      }

      // 3. Record audit log
      await recordAuditLog({
        action: "password_reset_request",
        identifier: trimmed,
      });

      setSentSuccess(true);
      toast.success(
        lang === "ar"
          ? "تم إرسال طلب استعادة كلمة المرور للمشرفين بنجاح."
          : "Password reset request submitted successfully."
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Error";
      toast.error(lang === "ar" ? "تعذر إرسال الطلب، تأكد من الاتصال وحاول مجدداً." : errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyWhatsApp = () => {
    navigator.clipboard.writeText(SUPPORT_WHATSAPP);
    toast.success(lang === "ar" ? "تم نسخ رقم الواتساب: " + SUPPORT_WHATSAPP : "WhatsApp number copied: " + SUPPORT_WHATSAPP);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-up"
      dir={isRTL ? "rtl" : "ltr"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-indigo-500/30 bg-[#0A0F1D]/95 backdrop-blur-2xl p-6 sm:p-7 space-y-5 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(99,102,241,0.2)]"
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
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              {lang === "ar" ? "استعادة كلمة المرور" : "Reset Password"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === "ar"
                ? "أدخل بريدك الـ Gmail المسجل لإرسال طلب الاستعادة"
                : "Enter your registered Gmail to request password reset"}
            </p>
          </div>
        </div>

        {sentSuccess ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3 text-center animate-fade-up">
            <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-black text-emerald-400">
              {lang === "ar" ? "تم تسجيل طلبك بنجاح" : "Request Submitted"}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === "ar"
                ? "تم تسجيل طلبك ووصل إلى لوحة المشرفين في قسم طلبات استعادة كلمة المرور للمراجعة والتفعيل."
                : "Your request has been logged and sent to administrators in the reset requests tab."}
            </p>

            {/* Quick WhatsApp followup */}
            <div className="pt-2">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition-all cursor-pointer border border-emerald-500/30"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>{lang === "ar" ? "متابعة فورية عبر واتساب" : "Follow up via WhatsApp"}</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-1 w-full h-9 rounded-xl bg-white/5 text-slate-400 text-xs font-semibold hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              {lang === "ar" ? "إغلاق" : "Close"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11.5px] font-semibold text-slate-300 tracking-wide">
                  {lang === "ar" ? "بريد Gmail المسجل (شرط الاستعادة)" : "Registered Gmail (Required)"}
                </label>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  @gmail.com
                </span>
              </div>
              <div className="relative">
                <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="example@gmail.com"
                  dir="ltr"
                  className="w-full h-11 ps-10 pe-3.5 rounded-xl text-sm font-medium bg-white/[0.045] border border-white/12 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white active:scale-[0.985] transition-all disabled:opacity-50 cursor-pointer shadow-[0_4px_20px_rgba(79,70,229,0.45)]"
              style={{
                background: "linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
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

            {/* Support Box with WhatsApp */}
            <div className="p-3.5 rounded-2xl bg-white/[0.035] border border-white/10 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>{lang === "ar" ? "هل تحتاج لمساعدة فورية؟" : "Need Instant Help?"}</span>
              </div>
              <p className="text-[11.5px] text-slate-400 leading-relaxed">
                {lang === "ar"
                  ? "يمكنك التواصل مباشرة مع الدعم الفني عبر واتساب لمتابعة حسابك واستعادة كلمة المرور فوراً:"
                  : "You can reach out directly to technical support via WhatsApp for immediate recovery:"}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 hover:text-emerald-300 transition-all cursor-pointer shadow-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{lang === "ar" ? "تواصل عبر واتساب" : "Chat on WhatsApp"}</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
                <button
                  type="button"
                  onClick={copyWhatsApp}
                  className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title={SUPPORT_WHATSAPP}
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  <span dir="ltr">{SUPPORT_WHATSAPP}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
