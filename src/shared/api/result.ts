import { type ApiResponse } from "@/shared/api/types";
export const ok = <T>(data: T): ApiResponse<T> => ({ data, error: null });
export const fail = <T>(operation: string, error: unknown): ApiResponse<T> => ({
  data: null,
  error: normalizeError(operation, error),
});
export const normalizeError = (operation: string, error: unknown): string => {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [e.message, e.details, e.hint]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
    if (parts.length > 0) return parts.join(" | ");
  }
  return `${operation} failed.`;
};
