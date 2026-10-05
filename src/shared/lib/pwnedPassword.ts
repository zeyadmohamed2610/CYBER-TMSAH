/**
 * HaveIBeenPwned (HIBP) Password Checker using k-Anonymity.
 *
 * Client-side assistance only. Server-side leaked-password protection is still
 * required to enforce this rule for clients that bypass the form.
 *
 * Security & Privacy:
 * - Only the first 5 characters of the SHA-1 hash are sent to HIBP's API.
 * - The actual password and remaining 35 characters never leave the client.
 */

export interface PwnedCheckResult {
  isPwned: boolean;
  count: number;
}

export async function checkPwnedPassword(password: string): Promise<PwnedCheckResult> {
  if (!password || password.trim().length === 0) {
    return { isPwned: false, count: 0 };
  }

  try {
    // 1. Compute SHA-1 hash using browser native Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    // 2. Split hash: first 5 characters (prefix) and remainder (suffix)
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    // 3. Query HIBP range API (free, no API key needed, k-anonymity model)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Add-Padding": "true", // Mitigates response size side-channel analysis
      },
    });

    if (!response.ok) {
      // If service is temporarily down or offline, fail open to not block users
      return { isPwned: false, count: 0 };
    }

    const text = await response.text();
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix && hashSuffix.trim().toUpperCase() === suffix) {
        const count = parseInt(countStr || "0", 10);
        return {
          isPwned: Number.isFinite(count) && count > 0,
          count: Number.isFinite(count) ? count : 0,
        };
      }
    }

    return { isPwned: false, count: 0 };
  } catch (error) {
    console.warn("Unable to check pwned password status:", error);
    return { isPwned: false, count: 0 };
  }
}
