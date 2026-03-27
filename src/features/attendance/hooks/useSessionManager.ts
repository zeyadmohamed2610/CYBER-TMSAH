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
  short_code: string;
  expires_in_seconds: number;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
}

interface SessionRow {
  id: string;
  subject_id: string;
  rotating_hash: string | null;
  short_code: string | null;
  expires_at: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
}

interface UseSessionManagerReturn {
  activeSession: ActiveSession | null;
  loading: boolean;
  error: string | null;
  creating: boolean;
  createSession: (
    subjectId: string,
    durationMinutes: number,
    latitude?: number | null,
    longitude?: number | null,
    radiusMeters?: number,
  ) => Promise<void>;
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
    if (rpcErr) return;
    const row = data as SessionRow | null;
    if (row) {
      setActiveSession((prev) =>
        prev ? {
          ...prev,
          rotating_hash: row.rotating_hash ?? prev.rotating_hash,
          short_code: row.short_code ?? prev.short_code,
        } : prev,
      );
    }
  }, [activeSession?.id]);

  /** Auto-refresh every 60 seconds while session is active + handle tab visibility */
  useEffect(() => {
    if (hashRefreshTimer.current) clearInterval(hashRefreshTimer.current);
    if (!activeSession?.is_active) return;

    const tick = () => {
      // Only refresh when tab is visible to save resources
      if (document.visibilityState === "visible") {
        void refreshHash();
      }
    };

    hashRefreshTimer.current = setInterval(tick, 60_000);

    // Immediately refresh when tab becomes visible again (hash may have expired)
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshHash();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (hashRefreshTimer.current) clearInterval(hashRefreshTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeSession?.id, activeSession?.is_active, refreshHash]);

  /** Cleanup: stop session when page is unloaded (browser close / navigate away) */
  useEffect(() => {
    if (!activeSession?.id) return;

    const handleUnload = () => {
      // Use sendBeacon for reliable delivery on page unload
      const url = `${supabase.supabaseUrl}/rest/v1/rpc/stop_session`;
      const body = JSON.stringify({ p_session_id: activeSession.id });
      navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }));
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [activeSession?.id]);

  /** Create a new session via generate_rotating_hash RPC with GPS */
  const createSession = useCallback(async (
    subjectId: string,
    durationMinutes: number,
    latitude?: number | null,
    longitude?: number | null,
    radiusMeters?: number,
  ) => {
    setCreating(true);
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc("generate_rotating_hash", {
      p_subject_id: subjectId,
      p_duration_minutes: durationMinutes,
      p_latitude: latitude ?? null,
      p_longitude: longitude ?? null,
      p_radius_meters: radiusMeters ?? 50,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      setCreating(false);
      return;
    }

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
      short_code:       row.short_code ?? "",
      expires_in_seconds: expiresInSeconds,
      latitude:         row.latitude ?? latitude ?? null,
      longitude:        row.longitude ?? longitude ?? null,
      radius_meters:    row.radius_meters ?? radiusMeters ?? 50,
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
