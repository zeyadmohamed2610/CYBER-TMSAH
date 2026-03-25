import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ActiveSession {
  id: string;
  subject_id: string;
  subject_name: string;
  doctor_name: string;
  duration_minutes: number;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  rotating_hash: string;
  expires_in_seconds: number;
}

interface UseSessionManagerReturn {
  activeSession: ActiveSession | null;
  loading: boolean;
  error: string | null;
  creating: boolean;
  createSession: (subjectId: string, durationMinutes: number) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  updateDuration: (sessionId: string, newMinutes: number) => Promise<{ error?: string }>;
  refreshHash: () => Promise<void>;
}

export function useSessionManager(): UseSessionManagerReturn {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const hashRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Fetch HMAC rotating hash from edge function */
  const refreshHash = useCallback(async () => {
    if (!activeSession?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/generateRotatingHash`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: activeSession.id }),
      });
      const data = await resp.json() as {
        rotating_hash: string;
        expires_in_seconds: number;
        session_expires_at: string;
      };
      if (data.rotating_hash) {
        setActiveSession((prev) =>
          prev ? { ...prev, rotating_hash: data.rotating_hash, expires_in_seconds: data.expires_in_seconds } : prev
        );
      }
    } catch {
      // silent — will retry next cycle
    }
  }, [activeSession?.id]);

  /** Start auto-refresh every 60 seconds */
  useEffect(() => {
    if (hashRefreshTimer.current) clearInterval(hashRefreshTimer.current);
    if (activeSession?.is_active) {
      refreshHash(); // immediate first fetch
      hashRefreshTimer.current = setInterval(refreshHash, 60_000);
    }
    return () => {
      if (hashRefreshTimer.current) clearInterval(hashRefreshTimer.current);
    };
  }, [activeSession?.id, activeSession?.is_active, refreshHash]);

  const createSession = useCallback(async (subjectId: string, durationMinutes: number) => {
    setCreating(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("create_session", {
      p_subject_id:       subjectId,
      p_duration_minutes: durationMinutes,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setCreating(false);
      return;
    }
    // Fetch subject info
    const { data: subject } = await supabase
      .from("subjects")
      .select("name, doctor_name")
      .eq("id", subjectId)
      .maybeSingle();

    setActiveSession({
      ...(data as ActiveSession),
      subject_name: subject?.name ?? "",
      doctor_name:  subject?.doctor_name ?? "",
      rotating_hash: "",
      expires_in_seconds: durationMinutes * 60,
    });
    setCreating(false);
  }, []);

  const stopSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    const { error: rpcErr } = await supabase.rpc("stop_session", { p_session_id: sessionId });
    if (rpcErr) setError(rpcErr.message);
    else setActiveSession(null);
    setLoading(false);
  }, []);

  const updateDuration = useCallback(async (sessionId: string, newMinutes: number) => {
    const { data, error: rpcErr } = await supabase.rpc("update_session_duration", {
      p_session_id:          sessionId,
      p_new_duration_minutes: newMinutes,
    });
    if (rpcErr) return { error: rpcErr.message };
    setActiveSession((prev) => prev ? { ...prev, ...(data as ActiveSession) } : prev);
    return {};
  }, []);

  return { activeSession, loading, error, creating, createSession, stopSession, updateDuration, refreshHash };
}
