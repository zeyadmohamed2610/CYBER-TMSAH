import { supabase } from "@/shared/api/supabaseClient";
import { useEffect, useRef, useState } from "react";

/** Advance server time using a monotonic clock; resync after sleep or returning to the page. */
export function useAcademicClock() {
  const [now, setNow] = useState(() => new Date());
  const [synced, setSynced] = useState(false);
  const anchor = useRef({ time: Date.now(), elapsed: performance.now() });
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const sync = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const started = performance.now();
        const result = await supabase.rpc("academic_clock");
        const elapsed = performance.now();
        const time = typeof result.data === "string" ? Date.parse(result.data) : NaN;
        if (active && !result.error && Number.isFinite(time)) {
          anchor.current = { time: time + (elapsed - started) / 2, elapsed };
          setNow(new Date(anchor.current.time));
          setSynced(true);
        }
      } catch {
        /* Keep the last synchronized time during a temporary connection failure. */
      } finally {
        inFlight = false;
      }
    };
    const tick = setInterval(
      () => setNow(new Date(anchor.current.time + performance.now() - anchor.current.elapsed)),
      1000,
    );
    const resync = setInterval(() => {
      void sync();
    }, 60000);
    const visible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", visible);
    void sync();
    return () => {
      active = false;
      clearInterval(tick);
      clearInterval(resync);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return { now, synced };
}
