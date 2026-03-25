import { useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { attendanceService } from "../services/attendanceService";
import type { SessionSummary } from "../types";

interface Props {
  sessions: SessionSummary[];
  onSubmitSuccess?: () => void;
}

export const AttendanceSubmissionForm = ({ sessions, onSubmitSuccess }: Props) => {
  const { toast }       = useToast();
  const [hash, setHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanning, setScanning]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeSessions = sessions.filter((s) => s.isActive);

  /** Decode QR from a photo taken by the camera */
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
        setHash(qr.data);
        toast({ title: "تم مسح الـ QR", description: "الكود جاهز — اضغط تسجيل الحضور." });
      } else {
        toast({ variant: "destructive", title: "لم يُكتشف QR", description: "تأكد من وضوح الصورة وأن QR ظاهر كاملاً." });
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
    const trimmedHash = hash.trim();
    if (!trimmedHash) {
      toast({ variant: "destructive", title: "مطلوب", description: "أدخل الكود أو امسح الـ QR." });
      return;
    }
    setIsSubmitting(true);
    const result = await attendanceService.submitAttendance(trimmedHash);
    if (result.error) {
      toast({ variant: "destructive", title: "فشل تسجيل الحضور", description: result.error });
    } else {
      toast({ title: "تم تسجيل الحضور ✓", description: "تم تسجيل حضورك بنجاح." });
      setHash("");
      onSubmitSuccess?.();
    }
    setIsSubmitting(false);
  };

  return (
    <Card className="bg-card/80" dir="rtl">
      <CardHeader>
        <CardTitle className="text-lg">تسجيل الحضور</CardTitle>
        <CardDescription>امسح الـ QR الخاص بالمحاضر أو اكتب الكود يدوياً.</CardDescription>
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

          {/* QR Camera button */}
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

          <div className="grid gap-2">
            <Label htmlFor="attendance-hash">أو أدخل الكود يدوياً</Label>
            <Input
              id="attendance-hash"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="الكود المكون من 64 حرفاً"
              dir="ltr"
              className="font-mono text-xs"
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || !hash.trim()}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            تسجيل الحضور
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
