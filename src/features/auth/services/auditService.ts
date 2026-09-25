// src/features/auth/services/auditService.ts
import { supabase } from "@/lib/supabaseClient";
import { computeFingerprint } from "@/features/attendance/utils/fingerprint";

export interface AuditLogEntry {
  action: "login_success" | "login_failed" | "join_request" | "password_reset_request";
  identifier: string;
  role?: string;
  /** Human-readable reason for the outcome, e.g. "user_not_found" | "wrong_password" */
  notes?: string;
  metadata?: Record<string, unknown>;
}

export const recordAuditLog = async (entry: AuditLogEntry): Promise<void> => {
  try {
    const fingerprint = await computeFingerprint();

    const payload = {
      action: entry.action,
      identifier: entry.identifier,
      role: entry.role || null,
      user_agent: navigator.userAgent,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      metadata: {
        ...(entry.metadata || {}),
        fingerprint,
        ...(entry.notes ? { failure_reason: entry.notes } : {}),
      },
      created_at: new Date().toISOString(),
    };

    // Attempt to log to Supabase audit_logs table
    await supabase.from("audit_logs").insert(payload);
  } catch {
    // Non-blocking: fail silently if network is offline or table is pending migration
  }
};
