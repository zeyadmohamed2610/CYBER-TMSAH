/**
 * Shared device fingerprint utility.
 * Generates a SHA-256 hash from stable browser signals.
 * Excludes screen dimensions to avoid changes on rotation.
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
    const hashBuf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw)
    );
    return [...new Uint8Array(hashBuf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "no-fp";
  }
}
