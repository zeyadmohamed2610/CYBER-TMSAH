// src/lib/errorReporting.ts
import { supabase } from "@/lib/supabaseClient";

export interface ReportPayload {
  errorMessage: string;
  errorStack?: string;
  pageUrl?: string;
  userNotes?: string;
}

// Global state to trigger ErrorModal from anywhere
type ErrorModalListener = (data: { message?: string; stack?: string } | null) => void;
const listeners = new Set<ErrorModalListener>();

export function subscribeToErrorModal(listener: ErrorModalListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function triggerGlobalErrorModal(errorInfo?: { message?: string; stack?: string }) {
  listeners.forEach((l) => l(errorInfo || { message: "خطأ غير متوقع" }));
}

export function closeGlobalErrorModal() {
  listeners.forEach((l) => l(null));
}

/**
 * Sends non-technical or technical error details to database table error_reports
 * Users will never see the technical stack trace on their screen.
 */
export async function sendErrorReportToDoctor(payload: ReportPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUrl = payload.pageUrl || window.location.href;
    const { error } = await supabase.rpc("report_system_error", {
      p_error_message: payload.errorMessage || "خطأ غير محدد في النظام",
      p_error_stack: payload.errorStack || null,
      p_page_url: currentUrl,
    });

    if (error) {
      // Fallback direct insert if RPC fails
      const { error: insertErr } = await supabase.from("error_reports").insert({
        error_message: payload.errorMessage || "خطأ غير محدد",
        error_stack: payload.errorStack || null,
        page_url: currentUrl,
      });
      if (insertErr) {
        return { success: false, error: insertErr.message };
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
