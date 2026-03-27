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

    // Auto-select first if none selected and sessions exist
    if (!selectedSession && data && data.length > 0) {
      setSelectedSession(data[0] as ActiveSession);
    }
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
  }, [sessions]);

  // Render QR code on canvas when session changes
  useEffect(() => {
    if (selectedSession?.short_code && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, selectedSession.short_code, {
        width: 160,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      }).catch(console.error);
    }
  }, [selectedSession?.short_code]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("Code copied!");
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
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No active sessions right now.</p>
        <p className="text-xs mt-1">Wait for your doctor to start a session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session selector bar */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {sessions.map((s) => (
          <button
            key={s.session_id}
            onClick={() => {
              setSelectedSession(s);
              onSessionSelect?.(s);
            }}
            className={`shrink-0 rounded-xl border px-4 py-3 text-left transition-all ${
              selectedSession?.session_id === s.session_id
                ? "border-primary bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <p className="font-bold text-sm">{s.subject_name}</p>
            <p className="text-xs text-muted-foreground">{s.doctor_name}</p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-500 font-mono">{getRemaining(s.expires_at)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Selected session details */}
      {selectedSession && (
        <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center space-y-4">
          <div>
            <p className="text-lg font-bold">{selectedSession.subject_name}</p>
            <p className="text-sm text-muted-foreground">
              {selectedSession.doctor_name} · {selectedSession.lecture_title}
            </p>
          </div>

          {/* Code display */}
          <div className="rounded-xl bg-primary/10 border border-primary/30 p-6 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Session Code</p>
            <p className="text-5xl font-bold font-mono tracking-[0.5em] text-primary">
              {selectedSession.short_code}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="text-green-500 font-mono font-bold">
                {getRemaining(selectedSession.expires_at)}
              </span>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="rounded-xl bg-white p-3">
              <canvas ref={canvasRef} />
            </div>
          </div>

          {/* GPS info */}
          {selectedSession.latitude && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>GPS required · {selectedSession.radius_meters}m radius</span>
            </div>
          )}

          {/* Copy button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy(selectedSession.short_code)}
            className="gap-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Code"}
          </Button>
        </div>
      )}
    </div>
  );
}
