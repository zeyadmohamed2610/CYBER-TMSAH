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
import { generateTOTPCode } from "../utils/rotatingSession";

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
  const [totpCode, setTotpCode]     = useState<string>("------");
  const [refreshIn, setRefreshIn]   = useState<number>(10);
  const prevCodeRef = useRef<string>("------");

  const { secondsUntilExpiry } = useRotatingHash({
    rotatingHash: session.rotating_hash,
    expiresAt: session.expires_at,
  });
  const countdown = secondsUntilExpiry ?? session.expires_in_seconds;

  useEffect(() => {
    setNewMinutes(session.duration_minutes);
  }, [session.duration_minutes]);

  // Generate TOTP code every second — only update state when code actually changes
  useEffect(() => {
    let mounted = true;
    const updateCode = async () => {
      const code = await generateTOTPCode(session.rotating_hash);
      const seconds = Math.floor(Date.now() / 1000);
      const remaining = 10 - (seconds % 10);
      
      if (mounted) {
        setRefreshIn(remaining);
        if (code !== prevCodeRef.current) {
          prevCodeRef.current = code;
          setTotpCode(code);
        }
      }
    };
    
    updateCode();
    const interval = window.setInterval(updateCode, 1000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [session.rotating_hash]);

  // Generate QR code from TOTP code
  useEffect(() => {
    if (!totpCode || totpCode === "------" || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, totpCode, {
      width: 220,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(console.error);
  }, [totpCode]);

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
    if (totpCode && totpCode !== "------") {
      navigator.clipboard.writeText(totpCode).then(() => {
        toast({ title: "تم نسخ الكود", description: totpCode });
      });
    }
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="glass-panel border-primary/30 relative overflow-hidden" dir="rtl">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      
      <CardHeader className="pb-4 sm:pb-6 relative z-10 border-b border-primary/10">
        <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="text-center sm:text-right w-full sm:w-auto">
            <CardTitle className="text-xl sm:text-2xl font-black text-primary drop-shadow-md">{session.subject_name}</CardTitle>
            <p className="text-sm sm:text-base text-muted-foreground font-medium mt-1">{session.doctor_name}</p>
          </div>
          <Badge variant={session.is_active ? "default" : "secondary"} className="text-sm px-4 py-1 shadow-lg">
            {session.is_active ? "جلسة نشطة الآن" : "مغلقة"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6 relative z-10">
        {/* SHORT CODE - big and prominent for projector display */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
          {/* TOTP Code Block */}
          <div className="flex-1 w-full rounded-3xl border-2 border-primary/30 bg-background/50 backdrop-blur-xl px-4 sm:px-8 py-8 text-center shadow-[0_0_30px_rgba(0,180,216,0.15)] flex flex-col justify-center">
            <p className="mb-3 text-xs sm:text-sm font-bold text-primary tracking-widest uppercase opacity-80">كود الحضور المباشر</p>
            <p
              className="font-mono text-5xl sm:text-7xl lg:text-8xl font-black tracking-[0.2em] sm:tracking-[0.3em] text-foreground select-all break-all"
              style={{ textShadow: "0 0 25px hsl(var(--primary)/0.4)" }}
            >
              {totpCode}
            </p>
            <Button variant="ghost" size="sm" className="mt-4 gap-2 mx-auto text-muted-foreground hover:text-primary transition-colors" onClick={handleCopyCode} aria-label="نسخ كود الحضور">
              <Copy className="h-4 w-4" />
              نسخ الكود
            </Button>
          </div>

          {/* QR Code Block */}
          <div className="flex flex-col items-center gap-3 shrink-0 bg-white/5 p-4 rounded-3xl border border-white/10">
            <canvas ref={canvasRef} className="rounded-2xl border-none shadow-xl scale-110 sm:scale-100" />
            <div className={`flex items-center gap-2 text-sm font-bold px-4 py-1.5 rounded-full ${refreshIn <= 3 ? "bg-destructive/20 text-destructive animate-pulse" : "bg-primary/20 text-primary"}`}>
              <RefreshCw className={`h-4 w-4 ${refreshIn <= 3 ? "animate-spin" : ""}`} />
              يتجدد بعد {refreshIn} ثانية
            </div>
          </div>
        </div>

        {/* GPS info */}
        {session.latitude && session.longitude && (
          <div className="flex flex-col sm:flex-row items-center gap-3 rounded-xl border border-white/5 bg-background/50 px-5 py-4 text-sm text-muted-foreground shadow-inner">
            <MapPin className="h-5 w-5 text-primary" />
            <span dir="ltr" className="font-mono bg-black/20 px-2 py-1 rounded">{session.latitude.toFixed(4)}, {session.longitude.toFixed(4)}</span>
            <span className="sm:mr-auto font-bold text-foreground">نطاق {session.radius_meters} متر</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Session timer */}
          <div className="flex flex-col justify-center rounded-2xl border border-white/5 bg-background/50 px-5 py-4 shadow-inner">
            <span className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              الوقت المتبقي للجلسة
            </span>
            <span className={`font-mono text-3xl font-black ${countdown < 60 ? "text-destructive animate-pulse" : "text-primary tracking-widest"}`}>
              {formatCountdown(countdown)}
            </span>
          </div>

          {/* Duration editor */}
          <div className="flex flex-col justify-center rounded-2xl border border-white/5 bg-background/50 px-5 py-4 shadow-inner">
            <p className="text-sm font-medium mb-3 text-muted-foreground">تعديل المدة (بالدقائق)</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={180}
                value={newMinutes}
                onChange={(e) => setNewMinutes(Number(e.target.value))}
                className="w-20 text-center text-lg font-bold h-11 bg-background/80"
                dir="ltr"
                aria-label="مدة الجلسة بالدقائق"
              />
              <Button
                variant="secondary"
                onClick={handleUpdateDuration}
                disabled={updating || newMinutes === session.duration_minutes}
                className="gap-2 h-11 flex-1 font-bold"
              >
                <TimerReset className="h-4 w-4" />
                تطبيق
              </Button>
            </div>
            {durationError && (
              <p className="text-xs text-destructive mt-2">{durationError}</p>
            )}
          </div>
        </div>

        {/* Stop button */}
        <Button
          variant="destructive"
          className="w-full gap-2 h-14 rounded-2xl text-lg font-bold shadow-lg shadow-destructive/20 transition-all hover:bg-destructive/90 hover:scale-[1.01]"
          onClick={handleStop}
          disabled={stopping}
        >
          <Square className="h-5 w-5" />
          {stopping ? "جاري الإيقاف..." : "إيقاف الجلسة فوراً"}
        </Button>
      </CardContent>
    </Card>
  );
}
