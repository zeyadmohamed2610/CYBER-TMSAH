import { supabase } from "@/shared/api/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { CheckCircle2, KeyRound, Loader2, Mail, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { recordAuditLog } from "../services/auditService";
import { normalizeDigits } from "../utils/loginInput";
import { Field } from "./AuthFormControls";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
  isRTL: boolean;
}
const COOLDOWN_KEY = "cyber_reset_retry_at";
function savedCooldown(): number {
  try {
    return Number(sessionStorage.getItem(COOLDOWN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestRegistered, setRequestRegistered] = useState(false);
  const [emailAccepted, setEmailAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"email" | "phone" | null>(null);
  const [retryAt, setRetryAt] = useState(savedCooldown);
  const [now, setNow] = useState(Date.now);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const registeredRequest = useRef<{ email: string; phone: string } | null>(null);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    if (!isOpen) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);
  const fail = (message: string, field: "email" | "phone" | null = null) => {
    setError(message);
    setErrorField(field);
    if (field === "email") emailRef.current?.focus();
    if (field === "phone") phoneRef.current?.focus();
  };
  const handleResetRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current || Date.now() < retryAt || emailAccepted) return;
    const request = registeredRequest.current ?? {
      email: email.trim().toLowerCase(),
      phone: normalizeDigits(phone).replace(/[\s()-]/g, ""),
    };
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(request.email)) {
      fail("أدخل بريد Gmail المسجل في حسابك.", "email");
      return;
    }
    if (!/^\+?\d{8,15}$/.test(request.phone)) {
      fail("أدخل رقم واتساب صحيحًا من 8 إلى 15 رقمًا.", "phone");
      return;
    }
    if (!navigator.onLine) {
      fail("الاتصال بالإنترنت مقطوع. اتصل ثم أعد المحاولة.");
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setError(null);
    setErrorField(null);
    const deadline = Date.now() + 60_000;
    setRetryAt(deadline);
    setNow(Date.now());
    try {
      sessionStorage.setItem(COOLDOWN_KEY, String(deadline));
    } catch {
      /* Storage is optional. */
    }
    try {
      if (!registeredRequest.current) {
        const { error: dbError } = await supabase
          .from("password_reset_requests")
          .insert({ ...request, status: "pending" });
        if (dbError) throw dbError;
        registeredRequest.current = request;
        setRequestRegistered(true);
        void recordAuditLog({
          action: "password_reset_request",
          identifier: `${request.email} | ${request.phone}`,
        });
      }
      // Retrying email must not insert the accepted administrator request again.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(request.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setEmailAccepted(true);
    } catch {
      fail(
        registeredRequest.current
          ? "سُجّل طلب المساعدة، لكن تعذر طلب رسالة الاستعادة. يمكنك إعادة المحاولة بعد انتهاء الانتظار أو التواصل مع الإدارة."
          : "تعذر تسجيل الطلب. احتفظنا ببياناتك؛ تحقق من الاتصال ثم أعد المحاولة.",
      );
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border-purple-500/30 bg-[#0A0F1D] p-5 text-white"
      >
        <DialogHeader className="text-start pr-9">
          <DialogTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5 text-purple-400" />
            استعادة كلمة المرور
          </DialogTitle>
          <DialogDescription className="text-xs leading-5 text-slate-400">
            أدخل بريد حسابك ورقم واتسابك لتسجيل طلب مساعدة وطلب رابط الاستعادة.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleResetRequest} aria-busy={submitting} className="space-y-3">
          {requestRegistered ? (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"
            >
              <p className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                سُجّل طلب المساعدة لدى الإدارة.
              </p>
              {emailAccepted && (
                <p className="mt-2 text-xs leading-5">
                  إذا كان البريد مسجلًا ويدعم الاستعادة، ستصلك رسالة برابط تغيير كلمة المرور. راجع
                  البريد الوارد والرسائل غير المرغوب فيها.
                </p>
              )}
            </div>
          ) : (
            <>
              <Field
                id="reset-email"
                name="email"
                label="بريد Gmail المسجل"
                type="email"
                value={email}
                onChange={(value) => {
                  setEmail(value);
                  setError(null);
                }}
                placeholder="example@gmail.com"
                autoComplete="email"
                enterKeyHint="next"
                readOnly={submitting}
                inputRef={emailRef}
                error={errorField === "email" ? error : null}
                icon={<Mail className="h-4 w-4" />}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    phoneRef.current?.focus();
                  }
                }}
              />
              <Field
                id="reset-phone"
                name="tel"
                label="رقم واتساب للتواصل"
                type="tel"
                value={phone}
                onChange={(value) => {
                  setPhone(value);
                  setError(null);
                }}
                placeholder="01xxxxxxxxx"
                autoComplete="tel"
                enterKeyHint="send"
                readOnly={submitting}
                inputRef={phoneRef}
                error={errorField === "phone" ? error : null}
                icon={<Phone className="h-4 w-4" />}
              />
            </>
          )}
          {error && !errorField && (
            <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-xs leading-5 text-red-300">
              {error}
            </p>
          )}
          {!emailAccepted && (
            <button
              type="submit"
              disabled={submitting || remaining > 0}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 text-sm font-bold disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-purple-300"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري إرسال الطلب...
                </>
              ) : remaining > 0 ? (
                `أعد المحاولة بعد ${remaining} ثانية`
              ) : requestRegistered ? (
                "إعادة طلب رسالة الاستعادة"
              ) : (
                "إرسال طلب الاستعادة"
              )}
            </button>
          )}
          <p className="text-xs leading-5 text-slate-400">
            لم تصلك الرسالة أو لا تستطيع الوصول لبريدك؟ تواصل مع الإدارة لمتابعة الطلب والتحقق من
            ملكية الحساب.
          </p>
          <a
            href="https://wa.me/201553450232"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-500/30 text-sm text-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            التواصل مع الإدارة عبر واتساب
          </a>
        </form>
      </DialogContent>
    </Dialog>
  );
}
