// src/features/auth/components/ForgotPasswordModal.tsx
import { useState } from "react";
import { X, KeyRound, Mail, Phone, Send, CheckCircle2, MessageCircle, Copy, Loader2, ExternalLink } from "lucide-react";
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
  const [phoneInput, setPhoneInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = emailInput.trim().toLowerCase();
    const trimmedPhone = phoneInput.trim();

    // 1. Strict validation: must be a valid Gmail address ending in @gmail.com
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(trimmedEmail)) {
      toast.error(
        lang === "ar"
          ? "شرط الاستعادة: يجب كتابة بريد Gmail صالح ينتهي بـ @gmail.com"
          : "A valid Gmail address ending with @gmail.com is strictly required."
      );
      return;
    }

    // 2. Phone validation (WhatsApp)
    if (!trimmedPhone || trimmedPhone.length < 8) {
      toast.error(
        lang === "ar"
          ? "يرجى كتابة رقم الواتساب الخاص بك لاستلام البيانات الجديدة"
          : "Please enter your WhatsApp phone number to receive your new credentials."
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert into password_reset_requests with both email and phone
      const { error: dbError } = await supabase.from("password_reset_requests").insert({
        email: trimmedEmail,
        phone: trimmedPhone,
        status: "pending",
      });

      if (dbError) throw dbError;

      // 2. Trigger Supabase auth reset email if user exists in auth (Option B self-service)
      try {
        await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      } catch {
        // Continue even if standard auth reset email encounters an issue
      }

      // 3. Record audit log
      await recordAuditLog({
        action: "password_reset_request",
        identifier: `${trimmedEmail} | ${trimmedPhone}`,
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
        className="relative w-full max-w-md rounded-3xl border border-purple-500/30 bg-[#0A0F1D]/95 backdrop-blur-2xl p-6 sm:p-7 space-y-5 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(147,51,234,0.2)]"
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
          <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.25)]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              {lang === "ar" ? "استعادة كلمة المرور" : "Reset Password"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === "ar"
                ? "أدخل بريدك الـ Gmail ورقم واتسابك لاستلام بيانات الدخول الجديدة"
                : "Enter your Gmail and WhatsApp number to receive recovery details"}
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
                ? "وصل طلبك إلى المشرف متضمناً بريدك ورقم واتسابك. سيقوم المشرف بتعيين كلمة مرور جديدة وإرسالها لك مباشرة على الواتساب."
                : "Your request with email and WhatsApp number reached the administrator. You will receive your credentials shortly."}
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
                <span>{lang === "ar" ? "متابعة فورية مع الإدارة عبر واتساب" : "Follow up via WhatsApp"}</span>
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
          <form onSubmit={handleResetRequest} className="space-y-3.5">
            {/* Gmail Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11.5px] font-semibold text-slate-300 tracking-wide">
                  {lang === "ar" ? "بريد Gmail المسجل (شرط الاستعادة)" : "Registered Gmail (Required)"}
                </label>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
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
                  className="w-full h-11 ps-10 pe-3.5 rounded-xl text-sm font-medium bg-white/[0.045] border border-white/12 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25 transition-all"
                />
              </div>
            </div>

            {/* WhatsApp Phone Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11.5px] font-semibold text-slate-300 tracking-wide">
                  {lang === "ar" ? "رقم الواتساب (لاستلام كلمة المرور الجديدة)" : "WhatsApp Number (To receive credentials)"}
                </label>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  WhatsApp
                </span>
              </div>
              <div className="relative">
                <Phone className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder={lang === "ar" ? "01xxxxxxxxx" : "WhatsApp Number"}
                  dir="ltr"
                  className="w-full h-11 ps-10 pe-3.5 rounded-xl text-sm font-medium bg-white/[0.045] border border-white/12 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white active:scale-[0.985] transition-all disabled:opacity-50 cursor-pointer shadow-[0_4px_20px_rgba(147,51,234,0.45)] mt-1"
              style={{
                background: "linear-gradient(180deg, #a855f7 0%, #9333ea 100%)",
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
            <div className="p-3.5 rounded-2xl bg-white/[0.035] border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>{lang === "ar" ? "هل تحتاج لمساعدة فورية؟" : "Need Instant Help?"}</span>
              </div>
              <p className="text-[11.5px] text-slate-400 leading-relaxed">
                {lang === "ar"
                  ? "يمكنك أيضاً التواصل مباشرة مع الدعم الفني عبر واتساب لمتابعة حسابك:"
                  : "You can reach out directly to technical support via WhatsApp:"}
              </p>
              <div className="flex items-center gap-2 pt-0.5">
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
                  <Copy className="w-3.5 h-3.5 text-purple-400" />
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
