import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useToast } from "@/shared/hooks/use-toast";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import jsQR from "jsqr";
import { Camera, KeyRound, Loader2, QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { offlineAttendanceService } from "../services/offlineAttendanceService";
import { type SessionSummary } from "../types";
import { attendanceSessionFromHash, readAttendanceLink } from "../utils/attendanceLink";
import { generateTOTPCode } from "../utils/rotatingSession";
import { AttendanceBiometricGate } from "./AttendanceBiometricGate";
interface Props {
  sessions: SessionSummary[];
  onSubmitSuccess?: () => void;
}
export const AttendanceSubmissionForm = ({ sessions, onSubmitSuccess }: Props) => {
  const { toast } = useToast();
  const { hash } = useLocation();
  const linkedSession = attendanceSessionFromHash(hash);
  const [method, setMethod] = useState<"passkey" | "qr">(linkedSession ? "qr" : "passkey");
  const [selectedId, setSelectedId] = useState(linkedSession ?? "");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  useEffect(() => {
    if (linkedSession) {
      setSelectedId(linkedSession);
      setMethod("qr");
    }
  }, [linkedSession]);
  const active = sessions.filter(
    (s) => s.isActive && s.expiresAt && new Date(s.expiresAt).getTime() > Date.now(),
  );
  const selected = active.find((s) => s.id === selectedId);
  const select = (id: string) => {
    if (busy) return;
    setSelectedId(id);
    setMessage("");
    setFailure("");
    setAttempt((n) => n + 1);
  };
  const capture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanning(true);
    let imageUrl: string | undefined;
    try {
      if (file.size > 10_000_000) throw new Error("الصورة كبيرة. اختر صورة أصغر من 10 ميجابايت.");
      const image = new Image();
      imageUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("تعذر قراءة الصورة."));
        image.src = imageUrl!;
      });
      const scale = Math.min(1, 2400 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("تعذر قراءة الصورة.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const value = jsQR(pixels.data, pixels.width, pixels.height)?.data;
      const id = value ? readAttendanceLink(value) : null;
      if (!id) throw new Error("لم يظهر رابط حضور صالح للمنصة. امسح QR المعروض في الجلسة.");
      if (!active.some((s) => s.id === id)) throw new Error("الجلسة منتهية أو غير متاحة لحسابك.");
      select(id);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "تعذر قراءة QR.");
    } finally {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const submitVerified = async (receipt: string, verifiedHash: string) => {
    if (!selected || selectedRef.current !== selected.id) return;
    setBusy(true);
    setFailure("");
    try {
      const result = await offlineAttendanceService.queueSubmission(verifiedHash, receipt);
      if (!result.success)
        throw new Error(getFriendlyErrorMessage(result.error ?? "تعذر تسجيل الحضور."));
      setMessage("تم تسجيل حضورك بنجاح.");
      toast({ title: "تم تسجيل الحضور", description: "أُكد مفتاح حسابك وموقعك لهذه الجلسة." });
      onSubmitSuccess?.();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "تعذر تسجيل الحضور. أعد المحاولة.");
      setAttempt((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="glass-card" dir="rtl">
      <CardHeader>
        <CardTitle>تسجيل الحضور</CardTitle>
        <CardDescription>
          اختر مفتاح المرور أو رابط QR. كلاهما يتطلب مفتاح حسابك المعتمد وموقعك داخل نطاق الجلسة.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2" aria-label="طريقة الوصول لجلسة الحضور">
          <Button
            type="button"
            variant={method === "passkey" ? "default" : "outline"}
            aria-pressed={method === "passkey"}
            disabled={busy}
            onClick={() => setMethod("passkey")}
          >
            <KeyRound className="h-4 w-4" />
            مفتاح المرور
          </Button>
          <Button
            type="button"
            variant={method === "qr" ? "default" : "outline"}
            aria-pressed={method === "qr"}
            disabled={busy}
            onClick={() => setMethod("qr")}
          >
            <QrCode className="h-4 w-4" />
            رابط QR
          </Button>
        </div>
        {method === "passkey" ? (
          <div className="space-y-2">
            <label htmlFor="attendance-session" className="text-sm font-medium">
              الجلسة النشطة
            </label>
            <select
              id="attendance-session"
              className="w-full rounded-xl border bg-background p-3"
              value={selectedId}
              disabled={busy}
              onChange={(e) => select(e.target.value)}
            >
              <option value="">اختر المحاضرة أو السكشن</option>
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subjectName}
                  {s.section ? ` · سكشن ${s.section}` : " · محاضرة"}
                </option>
              ))}
            </select>
            {!active.length && (
              <p className="text-sm text-muted-foreground">لا توجد جلسات نشطة في نطاق حسابك.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              امسح QR بكاميرا هاتفك لفتح هذه الصفحة مباشرة، أو اقرأ صورته هنا. سجّل الدخول بالحساب
              نفسه ثم أكّد مفتاح المرور.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label="صورة رابط حضور QR"
              onChange={capture}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy || scanning}
              onClick={() => fileRef.current?.click()}
            >
              {scanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              قراءة رابط QR بالكاميرا
            </Button>
          </div>
        )}
        {selectedId && !selected && (
          <p role="alert" className="text-sm text-destructive">
            الجلسة منتهية أو غير متاحة لحسابك. امسح رابط جلسة نشطة أو اختر جلسة أخرى.
          </p>
        )}
        {selected && (
          <div className="rounded-xl border p-3">
            <p className="font-bold">{selected.subjectName}</p>
            <p className="text-sm text-muted-foreground">
              {selected.section ? `سكشن ${selected.section}` : "محاضرة"} · نطاق حضور{" "}
              {selected.radiusMeters} متر
            </p>
          </div>
        )}
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        {message ? (
          <p role="status" className="text-sm text-emerald-500">
            {message}
          </p>
        ) : (
          selected && (
            <AttendanceBiometricGate
              key={`${selected.id}:${attempt}`}
              attendanceHash={async () => {
                if (
                  !selected.rotatingHash ||
                  !selected.expiresAt ||
                  new Date(selected.expiresAt).getTime() <= Date.now()
                )
                  throw new Error("انتهت الجلسة. اختر جلسة نشطة.");
                return generateTOTPCode(selected.rotatingHash);
              }}
              onVerified={submitVerified}
              onBusyChange={setBusy}
            />
          )
        )}
      </CardContent>
    </Card>
  );
};
