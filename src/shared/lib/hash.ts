/**
 * SHA-256 hashing with automatic fallback for HTTP.
 * On HTTPS: uses Web Crypto API
 * On HTTP: uses FNV-1a hash (deterministic, not cryptographically secure but used only for non-secure local previews)
 */

function simpleHash(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xc6a4a793;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    h1 ^= char;
    h1 = (h1 * 0x01000193) >>> 0;
    h2 = ((h2 << 5) - h2 + char) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).substring(0, 16);
}

export async function sha256Hash(input: string): Promise<string> {
  // Direct attempt — if it fails, we catch and fallback
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "fb" + simpleHash(input);
  }
}
