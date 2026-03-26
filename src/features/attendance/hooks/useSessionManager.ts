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

interface SessionRow {
  id: string;
  subject_id: string;
  rotating_hash: string | null;
  expires_at: string | null;
  created_at: string;
}

interface UseSessionManagerReturn {
  activeSession: ActiveSession | null;
  loading: boolean;
  error: string | null;
  creating: boolean;
  createSession: (subjectId: string, durationMinutes: number) => Promise<void>;
  stopSession: (sessionId: string) => Promise<void>;
  updateDuration: (sessionId: string, durationMinutes: number) => Promise<{ error?: string }>;
  refreshHash: () => Promise<void>;
}

export function useSessionManager(): UseSessionManagerReturn {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const hashRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Refresh hash on existing session (60-second rotation) */
  const refreshHash = useCallback(async () => {
    if (!activeSession?.id) return;
    const { data, error: rpcErr } = await supabase.rpc("refresh_session_hash", {
      p_session_id: activeSession.id,
    });
    if (rpcErr) return; // silent — will retry next cycle
    const row = data as SessionRow | null;
    if (row?.rotating_hash) {
      setActiveSession((prev) =>
        prev ? { ...prev, rotating_hash: row.rotating_hash! } : prev,
      );
    }
  }, [activeSession?.id]);

  /** Auto-refresh every 60 seconds while session is active */
  useEffect(() => {
    if (hashRefreshTimer.current) clearInterval(hashRefreshTimer.current);
    if (activeSession?.is_active) {
      hashRefreshTimer.current = setInterval(refreshHash, 60_000);
    }
    return () => {
      if (hashRefreshTimer.current) clearInterval(hashRefreshTimer.current);
    };
  }, [activeSession?.id, activeSession?.is_active, refreshHash]);

  /** Create a new session via generate_rotating_hash RPC */
  const createSession = useCallback(async (subjectId: string, durationMinutes: number) => {
    setCreating(true);
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc("generate_rotating_hash", {
      p_subject_id:       subjectId,
      p_duration_minutes: durationMinutes,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      setCreating(false);
      return;
    }

    // Fetch subject details for display
    const { data: subject } = await supabase
      .from("subjects")
      .select("name, doctor_name")
      .eq("id", subjectId)
      .maybeSingle();

    const row = data as SessionRow;
    const expiresAt = row.expires_at ?? new Date(Date.now() + durationMinutes * 60_000).toISOString();
    const expiresInSeconds = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));

    setActiveSession({
      id:               row.id,
      subject_id:       row.subject_id,
      subject_name:     subject?.name ?? "",
      doctor_name:      subject?.doctor_name ?? "",
      duration_minutes: durationMinutes,
      started_at:       row.created_at,
      expires_at:       expiresAt,
      is_active:        new Date(expiresAt).getTime() > Date.now(),
      rotating_hash:    row.rotating_hash ?? "",
      expires_in_seconds: expiresInSeconds,
    });
    setCreating(false);
  }, []);

  /** Stop/expire a session immediately */
  const stopSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    const { error: rpcErr } = await supabase.rpc("stop_session", {
      p_session_id: sessionId,
    });
    if (rpcErr) setError(rpcErr.message);
    else setActiveSession(null);
    setLoading(false);
  }, []);

  /** Reset the remaining session duration from now. */
  const updateDuration = useCallback(async (sessionId: string, durationMinutes: number) => {
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc("set_session_duration", {
      p_session_id: sessionId,
      p_duration_minutes: durationMinutes,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      return { error: rpcErr.message };
    }

    const row = data as SessionRow | null;
    const expiresAt = row?.expires_at ?? new Date(Date.now() + durationMinutes * 60_000).toISOString();
    const expiresInSeconds = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));

    setActiveSession((prev) => (
      prev && prev.id === sessionId
        ? {
            ...prev,
            duration_minutes: durationMinutes,
            expires_at: expiresAt,
            is_active: new Date(expiresAt).getTime() > Date.now(),
            expires_in_seconds: expiresInSeconds,
          }
        : prev
    ));

    return {};
  }, []);

  return { activeSession, loading, error, creating, createSession, stopSession, updateDuration, refreshHash };
}
