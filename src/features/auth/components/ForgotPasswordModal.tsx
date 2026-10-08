import { supabase } from "@/shared/api/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  readRecoveryCooldown,
  recoveryEmailError,
  startRecoveryCooldown,
} from "@/shared/lib/recoveryEmail";
import { CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Field } from "./AuthFormControls";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [retryAt, setRetryAt] = useState(readRecoveryCooldown);
  const [now, setNow] = useState(Date.now);
  const pending = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));

  useEffect(() => {
    if (!isOpen) return;
    setNow(Date.now());
    setRetryAt(readRecoveryCooldown());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const requestLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    const deadline = Math.max(retryAt, readRecoveryCooldown());
    if (Date.now() < deadline) {
      setRetryAt(deadline);
      setNow(Date.now());
      return;
    }
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("أدخل البريد الإلكتروني المسجل في حسابك.");
      setEmailError(true);
      emailRef.current?.focus();
      return;
    }
    if (!navigator.onLine) {
      setError("الاتصال بالإنترنت مقطوع. اتصل ثم أعد المحاولة.");
      setEmailError(false);
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setAccepted(false);
    setError(null);
    setEmailError(false);
    setRetryAt(startRecoveryCooldown());
    setNow(Date.now());
    try {
      const { error: requestError } = await supabase.functions.invoke("account-recovery", {
        body: { email: address },
      });
      if (requestError) throw requestError;
      setAccepted(true);
    } catch (requestError) {
      setError(
        recoveryEmailError(requestError) ??
          "تعذر طلب رابط الاستعادة. احتفظنا ببريدك؛ تحقق من الاتصال ثم أعد المحاولة.",
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
            الاستعادة متاحة للحسابات المسجلة التي تمت الموافقة عليها بالفعل.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={requestLink} aria-busy={submitting} className="space-y-3">
          <Field
            id="reset-email"
            name="email"
            label="البريد الإلكتروني المسجل"
            type="email"
            value={email}
            onChange={(value) => {
              setEmail(value);
              setError(null);
              setEmailError(false);
              setAccepted(false);
            }}
            placeholder="example@gmail.com"
            autoComplete="email"
            enterKeyHint="send"
            readOnly={submitting}
            inputRef={emailRef}
            error={emailError ? error : null}
            icon={<Mail className="h-4 w-4" />}
          />
          {accepted && (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200"
            >
              <CheckCircle2 className="mb-1 h-4 w-4" />
              إذا كان البريد مرتبطًا بحساب معتمد في المنصة، ستصلك رسالة برابط الاستعادة. راجع البريد
              الوارد والرسائل غير المرغوب فيها، ثم افتح الرابط لتعيين كلمة المرور.
            </div>
          )}
          {error && !emailError && (
            <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-xs leading-5 text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || remaining > 0}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 text-sm font-bold disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-purple-300"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري طلب الرابط...
              </>
            ) : remaining > 0 ? (
              `أعد المحاولة بعد ${remaining} ثانية`
            ) : accepted ? (
              "إعادة إرسال رابط الاستعادة"
            ) : (
              "إرسال رابط الاستعادة"
            )}
          </button>
          <p className="text-xs leading-5 text-slate-400">
            لا تشارك الرابط مع أحد. إذا لم تطلب تغيير كلمة المرور، تجاهل الرسالة.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
