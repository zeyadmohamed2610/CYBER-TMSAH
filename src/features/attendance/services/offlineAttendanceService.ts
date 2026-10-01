import { attendanceService } from "./attendanceService";
import { computeFingerprint } from "../utils/fingerprint";

interface PendingSubmission {
  id: string;
  hash: string;
  deviceFingerprint: string;
  latitude: number | null;
  longitude: number | null;
  biometricCredentialId: string | undefined;
  timestamp: string;
  retries: number;
}

const STORAGE_KEY = "cyber_tmsah_pending_attendance";

let cachedFingerprint: string | null = null;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

async function getFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;
  cachedFingerprint = await computeFingerprint();
  return cachedFingerprint;
}

/** Submit attendance via RPC with device fingerprint, GPS, and biometric credential */
async function submitAttendanceDirect(
  hash: string,
  fingerprint: string,
  lat: number | null,
  lng: number | null,
  biometricCredentialId?: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await attendanceService.submitAttendance(hash, lat, lng, biometricCredentialId);
  if (result.error) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export const offlineAttendanceService = {
  async queueSubmission(
    hash: string,
    biometricCredentialId?: string,
  ): Promise<{ success: boolean; offline: boolean; error?: string }> {
    const fingerprint = await getFingerprint();

    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!("geolocation" in navigator)) reject(new Error("no geolocation"));
        else navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* GPS unavailable */ }

    if (navigator.onLine) {
      const result = await submitAttendanceDirect(hash, fingerprint, lat, lng, biometricCredentialId);
      if (result.success) return { success: true, offline: false };
      return { success: false, offline: false, error: result.error };
    }

    const pending = getPending();
    pending.push({
      id: generateId(),
      hash,
      deviceFingerprint: fingerprint,
      latitude: lat,
      longitude: lng,
      biometricCredentialId,
      timestamp: new Date().toISOString(),
      retries: 0,
    });
    savePending(pending);

    return { success: true, offline: true };
  },

  async syncPending(): Promise<{ synced: number; failed: number }> {
    const pending = getPending();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    const remaining: PendingSubmission[] = [];

    for (const item of pending) {
      const result = await submitAttendanceDirect(
        item.hash,
        item.deviceFingerprint,
        item.latitude,
        item.longitude,
        item.biometricCredentialId,
      );
      if (result.success) {
        synced += 1;
      } else {
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
