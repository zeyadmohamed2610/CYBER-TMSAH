import { attendanceRecordService } from "@/features/attendance/services/attendanceRecordService";

import { supabase } from "@/shared/api/supabaseClient";

interface PendingSubmission {
  authId?: string;
  id: string;
  hash: string;
  latitude: number | null;
  longitude: number | null;
  biometricCredentialId: string | undefined;
  timestamp: string;
  retries: number;
}

const STORAGE_KEY = "cyber_tmsah_pending_attendance";

function getPending(): PendingSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingSubmission[];
    if (!Array.isArray(parsed)) return [];
    // Keep only current submission fields when reading an older browser queue.
    const items = parsed.map(
      ({ authId, id, hash, latitude, longitude, biometricCredentialId, timestamp, retries }) => ({
        ...(authId ? { authId } : {}),
        id,
        hash,
        latitude,
        longitude,
        biometricCredentialId,
        timestamp,
        retries,
      }),
    );
    const normalized = JSON.stringify(items);
    if (normalized !== raw) localStorage.setItem(STORAGE_KEY, normalized);
    return items;
  } catch {
    return [];
  }
}

function savePending(items: PendingSubmission[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Submit attendance via RPC with GPS and a server-validated Passkey receipt */
async function submitAttendanceDirect(
  hash: string,
  lat: number | null,
  lng: number | null,
  biometricCredentialId?: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await attendanceRecordService.submitAttendance(
    hash,
    lat,
    lng,
    biometricCredentialId,
  );
  if (result.error) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

let syncInFlight: Promise<{ synced: number; failed: number }> | null = null;
async function syncPendingOnce(): Promise<{ synced: number; failed: number }> {
  const pending = getPending();
  if (pending.length === 0) return { synced: 0, failed: 0 };
  const { data } = await supabase.auth.getSession();
  const authId = data.session?.user.id;
  if (!authId) return { synced: 0, failed: pending.length };

  let synced = 0;
  const remaining: PendingSubmission[] = [];

  for (const item of pending) {
    // Never submit another account's attendance, including legacy unbound entries.
    const { data: current } = await supabase.auth.getSession();
    if (item.authId !== authId || current.session?.user.id !== authId) {
      remaining.push(item);
      continue;
    }
    const result = await submitAttendanceDirect(
      item.hash,
      item.latitude,
      item.longitude,
      item.biometricCredentialId,
    );
    if (result.success) {
      synced += 1;
    } else {
      item.retries += 1;
      remaining.push(item);
    }
  }

  // Keep submissions added while the synchronization request was running.
  const processedIds = new Set(pending.map((item) => item.id));
  const additions = getPending().filter((item) => !processedIds.has(item.id));
  savePending([...remaining, ...additions]);
  return { synced, failed: remaining.length };
}

export const offlineAttendanceService = {
  async queueSubmission(
    hash: string,
    biometricCredentialId?: string,
  ): Promise<{ success: boolean; offline: boolean; error?: string }> {
    if (!navigator.onLine)
      return {
        success: false,
        offline: false,
        error:
          "تسجيل الحضور يحتاج اتصالًا بالإنترنت لتأكيد الرمز والبصمة. أعد المحاولة عند عودة الاتصال.",
      };
    const { data: authData } = await supabase.auth.getSession();
    const authId = authData.session?.user.id;
    if (!authId)
      return { success: false, offline: false, error: "يرجى تسجيل الدخول قبل تسجيل الحضور." };

    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!("geolocation" in navigator)) reject(new Error("no geolocation"));
        else
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      /* GPS unavailable */
    }

    if (navigator.onLine) {
      const result = await submitAttendanceDirect(hash, lat, lng, biometricCredentialId);
      if (result.success) return { success: true, offline: false };
      return {
        success: false,
        offline: false,
        error: result.error ?? "تعذر تسجيل الحضور. أعد المحاولة.",
      };
    }

    return { success: false, offline: false, error: "انقطع الاتصال. أعد تسجيل الحضور عند عودته." };
  },

  syncPending(): Promise<{ synced: number; failed: number }> {
    if (!syncInFlight)
      syncInFlight = syncPendingOnce().finally(() => {
        syncInFlight = null;
      });
    return syncInFlight;
  },

  getPendingCount(): number {
    return getPending().length;
  },

  getPendingItems(): PendingSubmission[] {
    return getPending();
  },
};
