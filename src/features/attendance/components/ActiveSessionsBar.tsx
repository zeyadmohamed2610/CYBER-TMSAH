import { useEffect, useState } from "react";
import { Clock, Copy, Check } from "lucide-react";
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
}

export function ActiveSessionsBar() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    try {
      const { data } = await supabase
        .from("sessions")
        .select(`id, short_code, rotating_hash, expires_at, latitude, longitude, radius_meters, subject_id, subjects(name, doctor_name)`)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      const mapped: ActiveSession[] = (data ?? []).map((row: Record<string, unknown>) => {
        const subj = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
        return {
          session_id: row.id as string,
          subject_name: (subj as Record<string, unknown>)?.name as string ?? "—",
          doctor_name: (subj as Record<string, unknown>)?.doctor_name as string ?? "",
          short_code: (row.short_code as string) ?? "",
          rotating_hash: (row.rotating_hash as string) ?? "",
          expires_at: row.expires_at as string,
          latitude: (row.latitude as number) ?? null,
          longitude: (row.longitude as number) ?? null,
          radius_meters: (row.radius_meters as number) ?? 50,
        };
      });
      setSessions(mapped);
    } catch { /* silently fail */ }
  };

  // Load on mount + refresh every 10 seconds
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, []);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = (sessionId: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(sessionId);
      toast.success("تم نسخ الكود!");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const getRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "منتهي";
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
        <p className="text-xs text-muted-foreground/60">سيظهر كود الحضور تلقائياً عند بدء الجلسة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <div
          key={s.session_id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/60 p-4 hover:border-primary/30 transition-colors"
        >
          {/* Session info */}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-foreground truncate">{s.subject_name}</p>
            {s.doctor_name && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{s.doctor_name}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs text-green-500 font-mono font-bold">{getRemaining(s.expires_at)}</span>
            </div>
          </div>

          {/* Code + Copy */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-background/80 border border-primary/20 rounded-xl px-4 py-2 text-center">
              <p className="font-mono text-xl font-black text-foreground tracking-[0.3em] select-all"
                style={{ textShadow: "0 0 15px hsl(var(--primary)/0.3)" }}>
                {s.short_code}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => handleCopy(s.session_id, s.short_code)}
              aria-label={`نسخ كود ${s.subject_name}`}
            >
              {copiedId === s.session_id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
