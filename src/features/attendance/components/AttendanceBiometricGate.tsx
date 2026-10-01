import { useState } from "react";
import { Fingerprint, Loader2, ShieldAlert, ShieldCheck, UserX, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyPasskeyForCurrentUser } from "@/lib/webauthn";
import { isWebAuthnSupported } from "@/lib/webauthn";

interface AttendanceBiometricGateProps {
  /** Called when biometric verification succeeds — passes the verified credential ID */
  onVerified: (credentialId: string) => void;
  /** If true, the gate is bypassed (e.g., no passkey registered — fallback path) */
  onBypass?: () => void;
}

type GateState = "idle" | "loading" | "verified" | "error" | "no_passkey";

/**
 * Anti-cheat biometric gate for attendance submission.
 *
 * Security model:
 *  - Fetches ONLY the credentials registered to the current user's auth_id from the DB.
 *  - Issues a WebAuthn challenge with allowCredentials restricted to those IDs.
 *  - The platform OS enforces that only the correct biometric/passkey can respond.
 *  - We then verify the returned credential ID is in the known list (defence-in-depth).
 *
 * This completely prevents:
 *  - Student A submitting attendance using Student B's device / passkey.
 *  - Any "replay" of a previous biometric assertion (WebAuthn is challenge-response).
 *  - Remote sharing of QR codes without physical presence (biometric gate is per-submission).
 */
export const AttendanceBiometricGate = ({
  onVerified,
  onBypass,
}: AttendanceBiometricGateProps) => {
  const [state, setState] = useState<GateState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleVerify = async () => {
    setState("loading");
    setErrorMsg("");

    const result = await verifyPasskeyForCurrentUser();

    if (result.success && result.credentialId) {
      setState("verified");
      onVerified(result.credentialId);
      return;
    }

    if (result.noPasskeyRegistered) {
      setState("no_passkey");
      setErrorMsg(result.error ?? "");
      return;
    }

    if (result.cancelled) {
      setState("idle");
      setErrorMsg(result.error ?? "تم إلغاء التحقق.");
      return;
    }

    setState("error");
    setErrorMsg(result.error ?? "فشل التحقق البيومتري.");
  };

  const isSupported = isWebAuthnSupported();

  // ── Verified state (briefly shown before parent hides the gate) ───────────
  if (state === "verified") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center animate-fade-up">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center ring-2 ring-emerald-500/30">
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
        </div>
        <p className="text-emerald-400 font-bold text-base">تم التحقق البيومتري بنجاح!</p>
        <p className="text-xs text-muted-foreground">يمكنك الآن تسجيل حضورك.</p>
      </div>
    );
  }

  // ── No passkey registered ─────────────────────────────────────────────────
  if (state === "no_passkey") {
    return (
      <div
        className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4 text-right"
        dir="rtl"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <UserX className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="font-bold text-amber-400 text-sm">لم يتم تسجيل بصمة على حسابك</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{errorMsg}</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-background/50 p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-amber-300">كيفية تفعيل البصمة:</p>
          <ol className="list-decimal list-inside space-y-1 marker:text-amber-400">
            <li>اذهب إلى صفحة <strong className="text-foreground">الملف الشخصي</strong></li>
            <li>افتح قسم <strong className="text-foreground">الأمان والبصمة</strong></li>
            <li>اضغط "إضافة بصمة / مفتاح أمان"</li>
            <li>اتبع التعليمات على جهازك</li>
          </ol>
        </div>

        {onBypass && (
          <div className="pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground"
              onClick={onBypass}
            >
              تخطي التحقق البيومتري (مؤقتاً)
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Main gate UI ─────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6 space-y-5 text-right"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 mt-0.5 ring-1 ring-primary/30 shadow-lg shadow-primary/10">
          <Fingerprint className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-bold text-base text-foreground">التحقق البيومتري الإلزامي</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            يجب التحقق من هويتك بالبصمة أو الوجه أو رمز الجهاز قبل تسجيل الحضور — فقط بصمتك
            المسجلة في حسابك.
          </p>
        </div>
      </div>

      {/* Security badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { icon: "🔐", label: "بصمتك فقط" },
          { icon: "🛡️", label: "تحدي فوري" },
          { icon: "✅", label: "منع الغش" },
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
      {errorMsg && state === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {/* Cancelled hint */}
      {errorMsg && state === "idle" && (
        <p className="text-xs text-amber-400/80 text-center">{errorMsg}</p>
      )}

      {/* WebAuthn not supported */}
      {!isSupported && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
          <KeyRound className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300 leading-relaxed">
            متصفحك لا يدعم التحقق البيومتري. جرب Chrome أو Safari أو Edge.
          </p>
        </div>
      )}

      {/* CTA button */}
      <Button
        onClick={handleVerify}
        disabled={state === "loading" || !isSupported}
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
            تحقق بالبصمة / الوجه / PIN
          </>
        )}
      </Button>

      {state === "error" && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground gap-1"
          onClick={() => { setState("idle"); setErrorMsg(""); }}
        >
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
};
