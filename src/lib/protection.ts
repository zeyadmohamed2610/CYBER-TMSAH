/**
 * Client-side protection utilities.
 * Real security is enforced server-side via RLS + SECURITY DEFINER functions.
 * These are defense-in-depth measures for the browser layer.
 */

/** Disable right-click context menu (deterrent only) */
const disableContextMenu = () => {
  document.addEventListener("contextmenu", (e) => {
    if (import.meta.env.PROD) e.preventDefault();
  });
};

/** Disable common DevTools keyboard shortcuts in production */
const disableDevToolsShortcuts = () => {
  document.addEventListener("keydown", (e) => {
    if (!import.meta.env.PROD) return;

    // F12
    if (e.key === "F12") {
      e.preventDefault();
      return;
    }

    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) {
      e.preventDefault();
      return;
    }

    // Ctrl+U (view source)
    if (e.ctrlKey && e.key.toUpperCase() === "U") {
      e.preventDefault();
    }
  });
};

/** Detect DevTools opening via timing attack (best-effort) */
const detectDevTools = () => {
  if (!import.meta.env.PROD) return;

  const threshold = 160;
  setInterval(() => {
    const start = performance.now();
    debugger; // eslint-disable-line no-debugger
    const duration = performance.now() - start;
    if (duration > threshold) {
      console.clear();
      console.log("%c⚠️ تم اكتشاف أدوات التطوير", "color: red; font-size: 20px; font-weight: bold;");
    }
  }, 1000);
};

/** Clear sensitive data from console periodically */
const sanitizeConsole = () => {
  if (!import.meta.env.PROD) return;
  setInterval(() => console.clear(), 30_000);
};

/** Rate limiter for RPC calls */
class RpcRateLimiter {
  private calls: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxCalls: number;

  constructor(windowMs = 60_000, maxCalls = 30) {
    this.windowMs = windowMs;
    this.maxCalls = maxCalls;
  }

  /** Returns true if the call is allowed */
  check(rpcName: string): boolean {
    const now = Date.now();
    const timestamps = this.calls.get(rpcName) ?? [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxCalls) return false;

    recent.push(now);
    this.calls.set(rpcName, recent);
    return true;
  }

  /** Get remaining calls in current window */
  remaining(rpcName: string): number {
    const now = Date.now();
    const timestamps = this.calls.get(rpcName) ?? [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxCalls - recent.length);
  }
}

export const rpcRateLimiter = new RpcRateLimiter(60_000, 30);

/** Initialize all protections */
export const initProtection = () => {
  disableContextMenu();
  disableDevToolsShortcuts();
  detectDevTools();
  sanitizeConsole();
};
