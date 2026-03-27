/**
 * LiveSessionPanel — shown to doctors and owners after a session is created.
 * Displays the rotating short code + QR code, stop button, and duration editor.
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Clock, Copy, MapPin, RefreshCw, Square, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { ActiveSession } from "../hooks/useSessionManager";
import { useRotatingHash } from "../hooks/useRotatingHash";

interface Props {
  session: ActiveSession;
  onStop:         (id: string) => Promise<void>;
  onUpdateDuration: (id: string, min: number) => Promise<{ error?: string }>;
  onRefreshHash:  () => Promise<void>;
}

export function LiveSessionPanel({ session, onStop, onUpdateDuration, onRefreshHash }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const { toast }   = useToast();
  const [newMinutes, setNewMinutes] = useState(session.duration_minutes);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [stopping, setStopping]     = useState(false);
  const [updating, setUpdating]     = useState(false);
  const { secondsUntilExpiry } = useRotatingHash({
    rotatingHash: session.rotating_hash,
    expiresAt: session.expires_at,
  });
  const countdown = secondsUntilExpiry ?? session.expires_in_seconds;

  useEffect(() => {
    setNewMinutes(session.duration_minutes);
  }, [session.duration_minutes]);

  // Generate QR code from short_code (what student actually types)
  useEffect(() => {
    if (!session.short_code || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, session.short_code, {
      width: 220,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(console.error);
  }, [session.short_code]);

  const handleStop = async () => {
    setStopping(true);
    await onStop(session.id);
    setStopping(false);
  };

  const handleUpdateDuration = async () => {
    setDurationError(null);
    setUpdating(true);
    const result = await onUpdateDuration(session.id, newMinutes);
    if (result.error) setDurationError(result.error.replace(/^validation_error: /, ""));
    setUpdating(false);
  };

  const handleCopyCode = () => {
    if (session.short_code) {
      navigator.clipboard.writeText(session.short_code).then(() => {
        toast({ title: "تم نسخ الكود", description: session.short_code ?? "" });
      });
    }
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Hash refresh countdown (60s cycle)
  const hashAge = 60 - (countdown % 60);
  const hashRefreshIn = 60 - hashAge;

  return (
    <Card className="border-primary/40 bg-primary/5" dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg">{session.subject_name}</CardTitle>
            <p className="text-sm text-muted-foreground">{session.doctor_name}</p>
          </div>
          <Badge variant={session.is_active ? "default" : "secondary"}>
            {session.is_active ? "جلسة نشطة" : "مغلقة"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* SHORT CODE - big and prominent for projector display */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-full rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-cyan-500/10 px-6 py-5 text-center">
            <p className="mb-2 text-sm font-medium text-muted-foreground">كود الحضور</p>
            <p
              className="font-mono text-5xl font-black tracking-[0.4em] text-primary select-all"
              style={{ textShadow: "0 0 20px hsl(var(--primary)/0.3)" }}
            >
              {session.short_code || "------"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">أدخل هذا الكود أو امسح QR</p>
          </div>

          <Button variant="outline" size="sm" className="gap-1" onClick={handleCopyCode}>
            <Copy className="h-3 w-3" />
            نسخ الكود
          </Button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-2">
          <canvas ref={canvasRef} className="rounded-xl border shadow-md" />
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              يتجدد بعد {hashRefreshIn}ث
            </span>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onRefreshHash}>
              <RefreshCw className="h-3 w-3 ml-1" /> تحديث الآن
            </Button>
          </div>
        </div>

        {/* GPS info */}
        {session.latitude && session.longitude && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary" />
            <span dir="ltr">{session.latitude.toFixed(4)}, {session.longitude.toFixed(4)}</span>
            <span className="mr-auto">نطاق {session.radius_meters}م</span>
          </div>
        )}

        {/* Session timer */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            الوقت المتبقي للجلسة
          </span>
          <span className={`font-mono text-lg font-bold ${countdown < 60 ? "text-destructive" : "text-primary"}`}>
            {formatCountdown(countdown)}
          </span>
        </div>

        {/* Duration editor */}
        <div className="space-y-2">
          <p className="text-sm font-medium">تعديل المدة (بالدقائق)</p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={180}
              value={newMinutes}
              onChange={(e) => setNewMinutes(Number(e.target.value))}
              className="w-24 text-center"
              dir="ltr"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateDuration}
              disabled={updating}
              className="gap-1"
            >
              <TimerReset className="h-4 w-4" />
              تطبيق
            </Button>
          </div>
          {durationError && (
            <p className="text-xs text-destructive">{durationError}</p>
          )}
        </div>

        {/* Stop button */}
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={handleStop}
          disabled={stopping}
        >
          <Square className="h-4 w-4" />
          إيقاف الجلسة فوراً
        </Button>
      </CardContent>
    </Card>
  );
}
