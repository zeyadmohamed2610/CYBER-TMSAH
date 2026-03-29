/**
 * Client-side protection utilities.
 * Defense-in-depth measures for the browser layer.
 */

/** Disable right-click context menu */
const disableContextMenu = () => {
  document.addEventListener("contextmenu", (e) => {
    if (import.meta.env.PROD) e.preventDefault();
  });
};

/** Disable all DevTools keyboard shortcuts */
const disableDevToolsShortcuts = () => {
  document.addEventListener("keydown", (e) => {
    if (!import.meta.env.PROD) return;

    // F12
    if (e.key === "F12") { e.preventDefault(); return; }

    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C / Ctrl+Shift+K
    if (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(e.key.toUpperCase())) {
      e.preventDefault(); return;
    }

    // Ctrl+U (view source)
    if (e.ctrlKey && e.key.toUpperCase() === "U") { e.preventDefault(); return; }

    // Ctrl+S (save page)
    if (e.ctrlKey && e.key.toUpperCase() === "S") { e.preventDefault(); return; }

    // Ctrl+Shift+Delete (clear data)
    if (e.ctrlKey && e.shiftKey && e.key === "Delete") { e.preventDefault(); return; }

    // Cmd+Option+I (Mac DevTools)
    if (e.metaKey && e.altKey && e.key.toUpperCase() === "I") { e.preventDefault(); return; }

    // Cmd+Option+J (Mac Console)
    if (e.metaKey && e.altKey && e.key.toUpperCase() === "J") { e.preventDefault(); return; }

    // Cmd+Option+C (Mac Inspect)
    if (e.metaKey && e.altKey && e.key.toUpperCase() === "C") { e.preventDefault(); return; }
  });
};

/** Disable text selection and copy */
const disableCopy = () => {
  if (!import.meta.env.PROD) return;
  document.addEventListener("selectstart", (e) => e.preventDefault());
  document.addEventListener("copy", (e) => e.preventDefault());
  document.addEventListener("cut", (e) => e.preventDefault());
};

/** Clear console periodically */
const sanitizeConsole = () => {
  if (!import.meta.env.PROD) return;
  setInterval(() => console.clear(), 15_000);
};

/** Block console methods */
const blockConsole = () => {
  if (!import.meta.env.PROD) return;
  const noop = () => {};
  const methods = ["log", "warn", "error", "info", "debug", "table", "trace", "dir", "dirxml", "group", "groupEnd", "time", "timeEnd", "assert", "count", "clear"] as const;
  for (const m of methods) {
    (console as Record<string, unknown>)[m] = noop;
  }
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

  check(rpcName: string): boolean {
    const now = Date.now();
    const timestamps = this.calls.get(rpcName) ?? [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxCalls) return false;
    recent.push(now);
    this.calls.set(rpcName, recent);
    return true;
  }

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
  disableCopy();
  sanitizeConsole();
  blockConsole();
};
