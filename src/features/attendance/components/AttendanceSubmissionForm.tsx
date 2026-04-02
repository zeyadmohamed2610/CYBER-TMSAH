import { useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, Loader2, Lock, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { offlineAttendanceService } from "../services/offlineAttendanceService";
import { useGps } from "../context/GpsContext";
import { supabase } from "@/lib/supabaseClient";
import type { SessionSummary } from "../types";

interface Props {
  sessions: SessionSummary[];
  onSubmitSuccess?: () => void;
}

export const AttendanceSubmissionForm = ({ sessions, onSubmitSuccess }: Props) => {
  const { toast }       = useToast();
  const { requestFresh } = useGps();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanning, setScanning]         = useState(false);
  const [gpsStatus, setGpsStatus]       = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const activeSessions = sessions.filter((s) => s.isActive);



  const handleQrCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);

    try {
      const img  = new Image();
      const url  = URL.createObjectURL(file);
      img.src    = url;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });

      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr        = jsQR(imageData.data, imageData.width, imageData.height);

      if (qr?.data) {
        setCode(qr.data.trim());
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      toast({ variant: "destructive", title: "مطلوب", description: "أدخل الكود أو امسح الـ QR." });
      return;
    }

    setIsSubmitting(true);

    setGpsStatus("جاري تحديد الموقع...");

    try {
      const gps = await requestFresh();
      setGpsStatus("تم تحديد الموقع (" + gps.lat.toFixed(4) + ", " + gps.lng.toFixed(4) + ")");
    } catch {
      setGpsStatus("سيتم تسجيل الحضور بدون موقع GPS");
    }

    try {
      const result = await offlineAttendanceService.queueSubmission(trimmedCode);

      if (result.success && result.offline) {
        toast({ title: "تم حفظ الحضور", description: "سيتم مزامنة التسجيل عند عودة الاتصال." });
        setCode(""); setGpsStatus(""); onSubmitSuccess?.();
      } else if (result.success) {
        toast({ title: "تم تسجيل الحضور", description: "تم تسجيل حضورك بنجاح." });
        setCode(""); setGpsStatus(""); onSubmitSuccess?.();
      } else {
        toast({ variant: "destructive", title: "فشل تسجيل الحضور", description: result.error ?? "حدث خطأ." });
        setGpsStatus("");
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تسجيل الحضور." });
      setGpsStatus("");
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
        <CardDescription>أدخل كود الجلسة (6 أرقام) أو امسح الـ QR بالكاميرا</CardDescription>
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
            <p className="text-sm text-muted-foreground">لا توجد جلسات نشطة حالياً.</p>
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
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {scanning ? "جاري القراءة..." : "مسح QR بالكاميرا"}
            </Button>
          </div>

          {/* Short code input */}
          <div className="grid gap-2">
            <Label htmlFor="attendance-code">أو أدخل الكود (6 أرقام)</Label>
            <Input
              id="attendance-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              dir="ltr"
              className="font-mono text-2xl text-center tracking-[0.5em] h-14"
              disabled={isSubmitting}
              autoComplete="off"
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>

          {/* GPS status */}
          {gpsStatus && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {gpsStatus}
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
