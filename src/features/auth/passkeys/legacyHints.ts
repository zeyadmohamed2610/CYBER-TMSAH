/** One-way cleanup for obsolete hints; they never authenticate a user. */
export function clearAllLocalPasskeys(): void {
  if (typeof window === "undefined") return;
  try {
    const obsolete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("cyber_device_passkey_") || key?.startsWith("cyber_passkeys_"))
        obsolete.push(key);
    }
    for (const key of obsolete) localStorage.removeItem(key);
    localStorage.removeItem("cyber_latest_passkey");
  } catch {
    /* Browser storage may be unavailable. */
  }
}
