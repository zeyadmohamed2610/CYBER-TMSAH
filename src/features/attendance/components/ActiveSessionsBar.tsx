import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Clock, Copy, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

interface ActiveSession {
  session_id: string;
  subject_name: string;
  doctor_name: string;
  short_code: string;
  rotating_hash: string;
  expires_at: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  lecture_id: string | null;
  lecture_title: string;
}

interface Props {
  onSessionSelect?: (session: ActiveSession) => void;
}

export function ActiveSessionsBar({ onSessionSelect }: Props) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = async () => {
    const { data } = await supabase.rpc("get_active_sessions");
    setSessions((data ?? []) as ActiveSession[]);
  };

  // Load on mount + refresh every 5 seconds for live code updates
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5_000);
    return () => clearInterval(timer);
  }, []);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  // Auto-select first session on load
  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0]);
      onSessionSelect?.(sessions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  // Render QR code on canvas when session changes
  useEffect(() => {
    if (selectedSession?.short_code && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, selectedSession.short_code, {
        width: 180,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      }).catch(console.error);
    }
  }, [selectedSession?.short_code]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("تم نسخ الكود!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "Expired";
    const min = Math.floor(diff / 60_000);
    const sec = Math.floor((diff % 60_000) / 1000);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
          <Clock className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">لا توجد جلسات نشطة حالياً.</p>
        <p className="text-xs text-muted-foreground/60">سيظهر كود الحضور تلقائياً عند بدء الدكتور للجلسة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session selector pills — horizontally scrollable with iOS momentum */}
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scroll-touch" role="tablist" aria-label="الجلسات النشطة">
        {sessions.map((s) => (
          <button
            key={s.session_id}
            role="tab"
            aria-selected={selectedSession?.session_id === s.session_id}
            aria-label={`${s.subject_name} - ${s.doctor_name}`}
            onClick={() => {
              setSelectedSession(s);
              onSessionSelect?.(s);
            }}
            className={`snap-start shrink-0 rounded-2xl border px-4 py-3 text-right transition-all duration-300 min-w-[160px] ${
              selectedSession?.session_id === s.session_id
                ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.25)] text-primary"
                : "border-border/50 bg-card/40 hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <p className="font-bold text-sm truncate">{s.subject_name}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{s.doctor_name}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.6)]"></span>
              <span className="text-xs text-green-500 font-mono font-bold">{getRemaining(s.expires_at)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Selected session details */}
      {selectedSession && (
        <div className="rounded-3xl border border-primary/20 glass-panel p-5 sm:p-6 space-y-5 overflow-hidden relative">
          {/* Ambient gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5 pointer-events-none" />
          
          <div className="relative z-10 text-center space-y-1">
            <p className="text-lg sm:text-xl font-extrabold text-foreground">{selectedSession.subject_name}</p>
            <p className="text-sm text-muted-foreground">{selectedSession.doctor_name} · {selectedSession.lecture_title}</p>
          </div>

          {/* Code + QR layout */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5 sm:gap-6 justify-center">
            {/* TOTP Code */}
            <div className="w-full sm:w-auto flex-1 rounded-2xl bg-background/60 border border-primary/20 px-4 py-5 text-center space-y-3 backdrop-blur-sm shadow-inner">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-primary opacity-70">كود الجلسة</p>
              <p className="font-mono text-4xl sm:text-5xl font-black text-foreground tracking-[0.3em] select-all"
                style={{ textShadow: '0 0 20px hsl(var(--primary)/0.35)' }}>
                {selectedSession.short_code}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.7)]"></span>
                <span className="text-green-500 font-mono font-bold text-base">{getRemaining(selectedSession.expires_at)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(selectedSession.short_code)}
                className="w-full gap-2 rounded-xl text-xs font-bold h-9 hover:bg-primary/10 hover:text-primary transition-colors"
                aria-label="نسخ كود الجلسة"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "تم النسخ!" : "نسخ الكود"}
              </Button>
            </div>

            {/* QR Code — responsive: fills available width on mobile */}
            <div className="shrink-0 rounded-2xl bg-white p-3 shadow-xl border border-white/20 w-full sm:w-auto">
              <canvas
                ref={canvasRef}
                className="block w-full sm:w-[160px] aspect-square"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>

          {/* GPS badge */}
          {selectedSession.latitude && (
            <div className="relative z-10 flex items-center justify-center gap-2 text-xs text-muted-foreground bg-background/50 rounded-xl px-4 py-2.5 border border-white/5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">مطلوب GPS · نطاق {selectedSession.radius_meters} متر</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
