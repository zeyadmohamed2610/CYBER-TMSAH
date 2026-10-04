import { supabase } from "@/shared/api/supabaseClient";
import { useEffect, useRef } from "react";

export function notifyAcademicChange() {
  window.dispatchEvent(new Event("academic-data-changed"));
}

/** Coalesce live events; refresh again after reconnecting or returning to the page. */
export function useLiveRefresh(refresh: () => Promise<unknown>, tables: readonly string[]) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const tableKey = tables.join(",");
  useEffect(() => {
    let active = true;
    let running = false;
    let queued = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (!active || document.visibilityState !== "visible") return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        await latest.current();
      } catch {
        /* Readers own error feedback and preserve prior data. */
      } finally {
        running = false;
        if (queued && active) {
          queued = false;
          schedule();
        }
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void check(), 300);
    };
    const channel = supabase.channel(`live-view-${crypto.randomUUID()}`);
    for (const table of tableKey.split(",").filter(Boolean)) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") schedule();
    });
    const poll = setInterval(() => void check(), 30000);
    window.addEventListener("focus", schedule);
    window.addEventListener("online", schedule);
    window.addEventListener("academic-data-changed", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("online", schedule);
      window.removeEventListener("academic-data-changed", schedule);
      document.removeEventListener("visibilitychange", schedule);
      void supabase.removeChannel(channel);
    };
  }, [tableKey]);
}
