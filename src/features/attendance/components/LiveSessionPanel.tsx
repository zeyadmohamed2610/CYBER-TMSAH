/**
 * LiveSessionPanel — shown to doctors and owners after a session is created.
 * Displays the rotating 60-second hash + QR code, stop button, and duration editor.
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Clock, RefreshCw, Square, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  // Generate QR code whenever hash changes
  useEffect(() => {
    if (!session.rotating_hash || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, session.rotating_hash, {
      width: 220,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(console.error);
  }, [session.rotating_hash]);

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
        {/* QR Code + Hash */}
        <div className="flex flex-col items-center gap-3">
          <canvas ref={canvasRef} className="rounded-xl border shadow-md" />
          <div className="w-full rounded-lg border border-primary/30 bg-background px-4 py-3 text-center">
            <p className="mb-1 text-xs text-muted-foreground">الكود (يمكن كتابته أو مسح QR)</p>
            <p className="font-mono text-sm font-bold tracking-widest text-primary break-all">
              {session.rotating_hash || "جاري التحميل..."}
            </p>
          </div>
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
