/**
 * Shared device fingerprint utility.
 * Generates a SHA-256 hash from stable browser signals.
 * Works on both HTTP and HTTPS (with fallback).
 */
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

    // Try crypto.subtle first (works on HTTPS)
    if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
      const hashBuf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(raw)
      );
      return [...new Uint8Array(hashBuf)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // Fallback: simple hash for HTTP contexts
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return "fallback-" + Math.abs(hash).toString(16);
  } catch {
    return "no-fp";
  }
}
