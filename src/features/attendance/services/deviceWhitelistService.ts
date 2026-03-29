import { supabase } from "@/lib/supabaseClient";

const WHITELIST_KEY = "cyber_device_whitelist";

export interface WhitelistedDevice {
  student_auth_id: string;
  device_fingerprint: string;
  device_label: string;
  added_at: string;
}

function loadLocal(): WhitelistedDevice[] {
  try { return JSON.parse(localStorage.getItem(WHITELIST_KEY) || "[]"); }
  catch { return []; }
}

function saveLocal(items: WhitelistedDevice[]): void {
  localStorage.setItem(WHITELIST_KEY, JSON.stringify(items));
}

async function computeFingerprint(): Promise<string> {
  try {
    const raw = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      String(screen.width),
      String(screen.height),
      String(navigator.hardwareConcurrency ?? 0),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.vendor,
    ].join("|");
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
    return [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "no-fingerprint";
  }
}

export const deviceWhitelistService = {
  async addDevice(studentAuthId: string, deviceLabel: string): Promise<void> {
    const fingerprint = await computeFingerprint();
    const items = loadLocal();
    const existing = items.findIndex(i => i.student_auth_id === studentAuthId);
    const entry: WhitelistedDevice = {
      student_auth_id: studentAuthId,
      device_fingerprint: fingerprint,
      device_label: deviceLabel,
      added_at: new Date().toISOString(),
    };
    if (existing >= 0) items[existing] = entry;
    else items.push(entry);
    saveLocal(items);
  },

  async isDeviceWhitelisted(studentAuthId: string): Promise<boolean> {
    const items = loadLocal();
    const entry = items.find(i => i.student_auth_id === studentAuthId);
    if (!entry) return false;
    const currentFp = await computeFingerprint();
    return entry.device_fingerprint === currentFp;
  },

  getWhitelistedDevices(): WhitelistedDevice[] {
    return loadLocal();
  },

  removeDevice(studentAuthId: string): void {
    const items = loadLocal().filter(i => i.student_auth_id !== studentAuthId);
    saveLocal(items);
  },
};
