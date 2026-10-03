import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import jsQR from "jsqr";
import { Camera, Clipboard, Loader2, Lock, MapPin, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGps } from "../context/GpsContext";
import { offlineAttendanceService } from "../services/offlineAttendanceService";
import { type SessionSummary } from "../types";
import { AttendanceBiometricGate } from "./AttendanceBiometricGate";

interface Props {
  sessions: SessionSummary[];
  onSubmitSuccess?: () => void;
}

export const AttendanceSubmissionForm = ({ sessions, onSubmitSuccess }: Props) => {
  const { toast } = useToast();
  const { coords } = useGps();
  const [code, setCode] = useState("");
  useEffect(() => {
    setVerifiedCredentialId(null);
  }, [code]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [verifiedCredentialId, setVerifiedCredentialId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const latestCode = useRef(code);
  latestCode.current = code;
  useEffect(() => {
    if (!verifiedCredentialId) return;
    const expire = setTimeout(() => setVerifiedCredentialId(null), 110000);
    return () => clearTimeout(expire);
  }, [verifiedCredentialId]);

  const activeSessions = sessions.filter((s) => s.isActive);
  const isBiometricReady = verifiedCredentialId !== null;

  const handleQrCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);

    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(imageData.data, imageData.width, imageData.height);

      if (qr?.data) {
        const digits = qr.data.trim().replace(/\D/g, "").slice(0, 6);
        setCode(digits);
        toast({ title: "تمت قراءة رمز الحضور", description: "الرمز جاهز — اضغط تسجيل الحضور." });
      } else {
        toast({
          variant: "destructive",
          title: "لم يظهر رمز الحضور",
          description: "تأكد من وضوح الصورة.",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل قراءة الصورة." });
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, "").slice(0, 6);
      if (digits) {
        setCode(digits);
        toast({ title: "تم اللصق", description: "تم لصق الرمز بنجاح." });
      } else {
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "لا يوجد رمز صالح في الحافظة.",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل القراءة من الحافظة." });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length !== 6) {
      toast({ variant: "destructive", title: "مطلوب", description: "أدخل رمز مكون من 6 أرقام." });
      return;
    }

    if (!verifiedCredentialId) {
      toast({
        variant: "destructive",
        title: "أكمل التحقق أولًا",
        description: "تحقق بالبصمة لهذا الرمز قبل تسجيل الحضور.",
      });
      return;
    }
    setIsSubmitting(true);
    // The server validates fresh coordinates against the session belonging to the entered code.
    try {
      // Submit the one-use receipt returned by server verification.
      const result = await offlineAttendanceService.queueSubmission(
        trimmedCode,
        verifiedCredentialId ?? undefined,
      );

      if (result.success) {
        toast({
          title: result.offline ? "تم حفظ الحضور" : "تم تسجيل الحضور",
          description: result.offline
            ? "التسجيل قيد الإرسال ويحتاج تأكيدًا عند عودة الاتصال."
            : "تم تسجيل حضورك بنجاح.",
        });
        setCode("");
        // Reset biometric gate after successful submission (require re-verify for next session)
        setVerifiedCredentialId(null);
        onSubmitSuccess?.();
      } else {
        toast({
          variant: "destructive",
          title: "فشل تسجيل الحضور",
          description: getFriendlyErrorMessage(result.error ?? "حدث خطأ."),
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "تعذر تسجيل الحضور",
        description: "تحقق من الاتصال ثم أعد المحاولة.",
      });
    } finally {
      setVerifiedCredentialId(null);
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass-card" dir="rtl">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          تسجيل الحضور
        </CardTitle>
        <CardDescription>أدخل رمز المحاضرة أو اقرأ صورة الرمز بالكاميرا</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Active sessions info */}
        {activeSessions.length > 0 ? (
          <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
            <p className="font-medium">الجلسات النشطة الآن:</p>
            <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
              {activeSessions.map((s) => (
                <li key={s.id}>
                  {s.subjectName} {s.section ? `(${s.section})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">لا توجد جلسات نشطة حالياً في نطاقك.</p>
        )}

        {/* QR Camera */}
        <div>
          <input
            ref={fileRef}
            id="qr-camera-input"
            name="qr-camera"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleQrCapture}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => fileRef.current?.click()}
            disabled={scanning || isSubmitting}
            aria-label="قراءة رمز الحضور بالكاميرا"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {scanning ? "جاري القراءة..." : "قراءة الرمز بالكاميرا"}
          </Button>
        </div>

        {/* Code input with paste */}
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="attendance-code">أو الصق الرمز (6 أرقام)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={handlePaste}
                disabled={isSubmitting}
                aria-label="لصق الرمز من الحافظة"
              >
                <Clipboard className="h-3 w-3" />
                لصق
              </Button>
            </div>
            <Input
              id="attendance-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onPaste={(e) => {
                e.preventDefault();
                const pastedText = e.clipboardData.getData("text");
                const digits = pastedText.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
              }}
              placeholder="000000"
              dir="ltr"
              className="font-mono text-2xl text-center tracking-[0.5em] h-14"
              disabled={isSubmitting}
              autoComplete="off"
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>

          {/* GPS indicator */}
          {coords && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 text-green-500" />
              تم تحديد موقعك
            </div>
          )}

          {!isBiometricReady && (
            <AttendanceBiometricGate
              key={code}
              attendanceHash={code.trim()}
              onVerified={(receipt) => {
                if (latestCode.current === code) setVerifiedCredentialId(receipt);
              }}
            />
          )}
          <Button
            type="submit"
            className="w-full h-12 rounded-xl text-base font-semibold btn-cyber shadow-lg"
            disabled={isSubmitting || !code.trim() || !isBiometricReady}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            تسجيل الحضور الآن
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
