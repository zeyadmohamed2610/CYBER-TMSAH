import { supabase } from "@/lib/supabaseClient";

interface PendingSubmission {
  id: string;
  hash: string;
  deviceFingerprint: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  retries: number;
}

const STORAGE_KEY = "cyber_tmsah_pending_attendance";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function computeFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("cyber-tmsah", 2, 15);
    const canvasFingerprint = canvas.toDataURL();

    const raw = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      String(screen.width),
      String(screen.height),
      String(screen.colorDepth ?? 0),
      String(navigator.hardwareConcurrency ?? 0),
      String(Intl.DateTimeFormat().resolvedOptions().timeZone),
      navigator.vendor,
      canvasFingerprint,
    ].join("|");
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
    return [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "fingerprint-error";
  }
}

function getPending(): PendingSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePending(items: PendingSubmission[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const offlineAttendanceService = {
  async queueSubmission(hash: string): Promise<{ success: boolean; offline: boolean; error?: string }> {
    const fingerprint = await computeFingerprint();

    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!("geolocation" in navigator)) reject(new Error("no geolocation"));
        else navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* GPS unavailable, continue without it */ }

    if (navigator.onLine) {
      try {
        const { error } = await supabase.rpc("submit_attendance", {
          p_hash: hash,
          p_device_fingerprint: fingerprint,
          p_student_latitude: lat,
          p_student_longitude: lng,
        });
        if (!error) return { success: true, offline: false };
        return { success: false, offline: false, error: error.message };
      } catch {
        // Network failed, queue for later
      }
    }

    const pending = getPending();
    pending.push({
      id: generateId(),
      hash,
      deviceFingerprint: fingerprint,
      latitude: lat,
      longitude: lng,
      timestamp: new Date().toISOString(),
      retries: 0,
    });
    savePending(pending);

    if ("serviceWorker" in navigator && "SyncManager" in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.sync.register("sync-attendance");
      } catch { /* sync not supported */ }
    }

    return { success: true, offline: true };
  },

  async syncPending(): Promise<{ synced: number; failed: number }> {
    const pending = getPending();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    const remaining: PendingSubmission[] = [];

    for (const item of pending) {
      try {
        const { error } = await supabase.rpc("submit_attendance", {
          p_hash: item.hash,
          p_device_fingerprint: item.deviceFingerprint,
          p_student_latitude: item.latitude,
          p_student_longitude: item.longitude,
        });
        if (error) {
          item.retries += 1;
          if (item.retries < 5) remaining.push(item);
          else synced += 1;
        } else {
          synced += 1;
        }
      } catch {
        item.retries += 1;
        if (item.retries < 5) remaining.push(item);
      }
    }

    savePending(remaining);
    return { synced, failed: remaining.length };
  },

  getPendingCount(): number {
    return getPending().length;
  },

  getPendingItems(): PendingSubmission[] {
    return getPending();
  },
};
