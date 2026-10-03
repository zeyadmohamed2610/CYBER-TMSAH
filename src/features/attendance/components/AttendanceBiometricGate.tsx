import { isWebAuthnSupported, verifyPasskeyForCurrentUser } from "@/features/auth/passkeys";
import { Button } from "@/shared/components/ui/button";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import {
  AlertTriangle,
  ArrowRight,
  Fingerprint,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface AttendanceBiometricGateProps {
  /** Called when biometric verification succeeds */
  onVerified: (credentialId: string) => void;
  attendanceHash: string;
  // NO onBypass — biometric is MANDATORY
}

type GateState = "idle" | "loading" | "verified" | "error" | "no_passkey" | "unsupported";

/** Server-verified attendance gate. The returned receipt is bound to this code,
 * account and device, and is consumed once by the attendance procedure.
 * Device verification may use a fingerprint, face or device PIN.
 */
export const AttendanceBiometricGate = ({
  onVerified,
  attendanceHash,
}: AttendanceBiometricGateProps) => {
  const navigate = useNavigate();
  const [state, setState] = useState<GateState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const isSupported = isWebAuthnSupported();

  const handleVerify = async () => {
    if (!isSupported) {
      setState("unsupported");
      return;
    }
    setState("loading");
    setErrorMsg("");

    const result = await verifyPasskeyForCurrentUser(attendanceHash);

    if (result.success && result.credentialId) {
      setState("verified");
      onVerified(result.credentialId);
      return;
    }

    if (result.noPasskeyRegistered) {
      setState("no_passkey");
      setErrorMsg(getFriendlyErrorMessage(result.error ?? ""));
      return;
    }

    if (result.cancelled) {
      setState("idle");
      setErrorMsg("تم إلغاء التحقق بالبصمة. يجب الموافقة على البصمة لتسجيل الحضور.");
      return;
    }

    setState("error");
    setErrorMsg(getFriendlyErrorMessage(result.error ?? "فشل التحقق بالبصمة."));
  };

  // ── Verified ──────────────────────────────────────────────────────────────
  if (state === "verified") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center animate-fade-up" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center ring-2 ring-emerald-500/30">
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
        </div>
        <p className="text-emerald-400 font-bold text-base">تم التحقق بالبصمة بنجاح!</p>
        <p className="text-xs text-muted-foreground">يمكنك الآن تسجيل حضورك.</p>
      </div>
    );
  }

  // ── No passkey — MUST register (MANDATORY — no bypass) ───────────────────
  if (state === "no_passkey") {
    return (
      <div
        className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 space-y-4"
        dir="rtl"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-destructive/15 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="font-bold text-destructive text-sm">تسجيل البصمة إلزامي لتسجيل الحضور</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              لم تقم بتسجيل بصمة على حسابك. يجب تسجيل البصمة أولاً — لا يمكن تخطي هذه الخطوة.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/20 bg-background/50 p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">لتسجيل بصمتك:</p>
          <ol className="list-decimal list-inside space-y-1 marker:text-destructive">
            <li>
              اذهب إلى <strong className="text-foreground">الملف الشخصي</strong>
            </li>
            <li>
              افتح قسم <strong className="text-foreground">الدخول بالبصمة</strong>
            </li>
            <li>اضغط "إضافة جهاز للدخول بالبصمة"</li>
            <li>اتبع التعليمات على جهازك</li>
            <li>عد هنا وسجل حضورك</li>
          </ol>
        </div>

        <Button
          type="button"
          className="w-full gap-2 bg-primary/90 hover:bg-primary"
          onClick={() => navigate("/profile?section=passkeys")}
        >
          <ArrowRight className="h-4 w-4" />
          اذهب إلى الملف الشخصي لتسجيل البصمة
        </Button>
      </div>
    );
  }

  // ── Browser doesn't support WebAuthn ─────────────────────────────────────
  if (state === "unsupported" || !isSupported) {
    return (
      <div
        className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-3"
        dir="rtl"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-400 text-sm">المتصفح لا يدعم التحقق بالبصمة</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              يجب استخدام Chrome أو Safari أو Edge لتسجيل الحضور عبر البصمة. جرّب جهازاً أو متصفحاً
              يدعم الدخول بالبصمة لتسجيل حضورك.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main gate UI ──────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6 space-y-5"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 ring-1 ring-primary/30 shadow-lg shadow-primary/10">
          <Fingerprint className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-bold text-base text-foreground flex items-center gap-2">
            التحقق بالبصمة الإلزامي
            <span className="text-[10px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full font-bold">
              مطلوب
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            يجب التحقق من هويتك بالبصمة أو الوجه أو رمز الجهاز — لا يمكن تخطي هذه الخطوة.
          </p>
        </div>
      </div>

      {/* Security badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { icon: "🔐", label: "تأكيد الهوية" },
          { icon: "🛡️", label: "حضور موثّق" },
          { icon: "📋", label: "مسجل للمراقب" },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-background/40 px-2 py-2.5"
          >
            <div className="text-lg mb-1">{icon}</div>
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Error message */}
      {errorMsg && (
        <div
          className={`rounded-xl border px-3 py-2.5 flex items-start gap-2 ${
            state === "error"
              ? "border-destructive/30 bg-destructive/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          <ShieldAlert
            className={`h-4 w-4 shrink-0 mt-0.5 ${state === "error" ? "text-destructive" : "text-amber-400"}`}
          />
          <p
            className={`text-xs leading-relaxed ${state === "error" ? "text-destructive" : "text-amber-300"}`}
          >
            {getFriendlyErrorMessage(errorMsg)}
          </p>
        </div>
      )}

      {/* CTA */}
      <Button
        type="button"
        onClick={handleVerify}
        disabled={state === "loading" || !/^[0-9]{6}$/.test(attendanceHash)}
        className="w-full h-13 rounded-xl text-base font-bold btn-cyber shadow-lg gap-2"
        size="lg"
      >
        {state === "loading" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            جارٍ التحقق من البصمة...
          </>
        ) : (
          <>
            <Fingerprint className="h-5 w-5" />
            تحقق بالبصمة / الوجه / رمز قفل الجهاز
          </>
        )}
      </Button>

      {state === "error" && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => {
            setState("idle");
            setErrorMsg("");
          }}
        >
          إعادة المحاولة
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground leading-relaxed">
        كل محاولة تحقق مسجلة في سجل النشاط ويراها المراقب
      </p>
    </div>
  );
};
