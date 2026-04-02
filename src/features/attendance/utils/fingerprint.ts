/**
 * Shared device fingerprint utility.
 * Generates a hash from stable browser signals.
 * Works on both HTTP and HTTPS.
 */

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return "fp-" + Math.abs(hash).toString(16) + "-" + str.length;
}

async function sha256Hash(input: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuf = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(hashBuf)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // crypto.subtle.digest not available (HTTP context)
  }
  return simpleHash(input);
}

export async function computeFingerprint(): Promise<string> {
  try {
    const raw = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      navigator.hardwareConcurrency ?? 0,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.vendor,
    ].join("|");

    return await sha256Hash(raw);
  } catch {
    return "no-fp";
  }
}

export { sha256Hash };
