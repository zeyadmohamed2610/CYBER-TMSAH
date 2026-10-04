import type { AppRole } from "../types";
import { getDashboardRoute } from "./dashboardRoutes";

export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit >= "٠" && digit <= "٩" ? 0x0660 : 0x06f0)),
  );
}

export function normalizeIdentifier(value: string): string {
  return normalizeDigits(value.trim()).replace(/^@+/, "");
}

// The resolved account role, never a browser cache, determines the return destination.
export function getLoginDestination(role: AppRole, requested: unknown): string {
  const fallback = getDashboardRoute(role);
  if (typeof requested !== "string" || !requested.startsWith("/") || /[\\\r\n]/.test(requested))
    return fallback;
  try {
    const url = new URL(requested, "https://local.invalid");
    if (url.origin !== "https://local.invalid") return fallback;
    if (url.pathname !== fallback && url.pathname !== "/profile") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function hasStoredSession(): boolean {
  try {
    return Object.keys(localStorage).some(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
    );
  } catch {
    return false;
  }
}
