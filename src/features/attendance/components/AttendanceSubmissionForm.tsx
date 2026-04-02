import { useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, Clipboard, Loader2, Lock, MapPin, Send, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { offlineAttendanceService } from "../services/offlineAttendanceService";
import { useGps } from "../context/GpsContext";
import type { SessionSummary } from "../types";

interface Props {
  sessions: SessionSummary[];
  onSubmitSuccess?: () => void;
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const AttendanceSubmissionForm = ({ sessions, onSubmitSuccess }: Props) => {
  const { toast } = useToast();
  const { coords } = useGps();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const activeSessions = sessions.filter((s) => s.isActive);

  const handleQrCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);

    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });

      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(imageData.data, imageData.width, imageData.height);

      if (qr?.data) {
        const digits = qr.data.trim().replace(/\D/g, "").slice(0, 6);
        setCode(digits);
        toast({ title: "تم مسح الـ QR", description: "الكود جاهز — اضغط تسجيل الحضور." });
      } else {
        toast({ variant: "destructive", title: "لم يُكتشف QR", description: "تأكد من وضوح الصورة." });
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
        toast({ title: "تم اللصق", description: "تم لصق الكود بنجاح." });
      } else {
        toast({ variant: "destructive", title: "خطأ", description: "لا يوجد كود صالح في الحافظة." });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل القراءة من الحافظة." });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length !== 6) {
      toast({ variant: "destructive", title: "مطلوب", description: "أدخل كود مكون من 6 أرقام." });
      return;
    }

    setIsSubmitting(true);

    // GPS check - use cached coords from GpsContext
    if (coords) {
      const nearbySession = activeSessions.find((s) => s.latitude && s.longitude);
      if (nearbySession && nearbySession.latitude && nearbySession.longitude) {
        const distance = getDistanceMeters(
          coords.lat, coords.lng,
          nearbySession.latitude, nearbySession.longitude
        );
        if (distance > (nearbySession.radiusMeters ?? 50)) {
          toast({
            variant: "destructive",
            title: "خارج النطاق الجغرافي",
            description: `أنت على بُعد ${Math.round(distance)} متر من القاعة. يجب أن تكون ضمن نطاق ${nearbySession.radiusMeters ?? 50} متر.`,
          });
          setIsSubmitting(false);
          return;
        }
        setGpsStatus("موقعك ضمن النطاق المطلوب");
      }
    }

    // Submit via offlineAttendanceService (handles direct DB insert)
    const result = await offlineAttendanceService.queueSubmission(trimmedCode);

    if (result.success) {
      toast({ title: result.offline ? "تم حفظ الحضور" : "تم تسجيل الحضور", description: result.offline ? "سيتم مزامنة التسجيل عند عودة الاتصال." : "تم تسجيل حضورك بنجاح." });
      setCode("");
      setGpsStatus("");
      onSubmitSuccess?.();
    } else {
      toast({ variant: "destructive", title: "فشل تسجيل الحضور", description: result.error ?? "حدث خطأ." });
    }

    setIsSubmitting(false);
  };

  return (
    <Card className="glass-card" dir="rtl">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          تسجيل الحضور
        </CardTitle>
        <CardDescription>انسخ الكود من الجلسة النشطة أو امسح QR أو الصق الكود</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {activeSessions.length > 0 ? (
            <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium">الجلسات النشطة الآن:</p>
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {activeSessions.map((s) => <li key={s.id}>{s.subjectName}</li>)}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد جلسات نشطة حالياً في نطاقك.</p>
          )}

          {/* QR Camera */}
          <div>
            <input
              ref={fileRef}
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
              aria-label="مسح رمز QR بالكاميرا"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {scanning ? "جاري القراءة..." : "مسح QR بالكاميرا"}
            </Button>
          </div>

          {/* Code input with paste */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="attendance-code">أو الصق الكود (6 أرقام)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={handlePaste}
                disabled={isSubmitting}
                aria-label="لصق الكود من الحافظة"
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

          {/* GPS status */}
          {gpsStatus && (
            <div className={`flex items-center gap-2 text-xs ${gpsStatus.includes("النطاق") ? "text-green-600" : "text-destructive"}`}>
              {gpsStatus.includes("النطاق") ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
              {gpsStatus}
            </div>
          )}

          {/* GPS indicator */}
          {coords && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 text-green-500" />
              الموقع محدد ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
            </div>
          )}

          <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold btn-cyber shadow-lg" disabled={isSubmitting || !code.trim()}>
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            تسجيل الحضور الآن
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
