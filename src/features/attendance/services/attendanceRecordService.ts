import { type AttendanceRow, mapAttendanceRecord } from "@/features/attendance/services/rowMappers";
import {
  type AttendanceRecord,
  type AttendanceSubmissionResult,
} from "@/features/attendance/types";
import {
  addManualAttendanceSchema,
  submitAttendanceSchema,
  validateRpcInput,
} from "@/features/attendance/utils/rpcValidation";
import { resolveAuthUserId, resolveDbUserProfile } from "@/features/auth/services/currentUser";
import { type AppRole } from "@/features/auth/types";
import { fail, ok } from "@/shared/api/result";
import { supabase } from "@/shared/api/supabaseClient";
import { type ApiResponse } from "@/shared/api/types";
import { computeFingerprint } from "@/shared/lib/deviceFingerprint";
import { getPaginationRange } from "@/shared/lib/pagination";
export const attendanceRecordService = {
  async fetchAttendanceRecords(
    role: AppRole,
    pagination?: { page?: number; pageSize?: number },
    sectionFilter?: string[],
  ): Promise<ApiResponse<AttendanceRecord[]>> {
    const operation = "attendanceRecordService.fetchAttendanceRecords";
    try {
      const page = pagination?.page ?? 1;
      const pageSize = pagination?.pageSize ?? 50;
      const { from, to } = getPaginationRange(page, pageSize);

      const attendanceSelect =
        "id, session_id, student_id, created_at, sessions(subject_id, subjects(name)), users!attendance_student_id_fkey(full_name)";

      if (role === "owner") {
        const { data, error } = await supabase
          .from("attendance")
          .select(attendanceSelect)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) throw error;
        const records = ((data ?? []) as unknown as AttendanceRow[]).map(mapAttendanceRecord);
        return ok<AttendanceRecord[]>(records);
      }

      const authId = await resolveAuthUserId();
      if (!authId) throw new Error("Not authenticated.");
      const profile = await resolveDbUserProfile(authId);
      if (!profile) return ok<AttendanceRecord[]>([]);

      if (role === "student") {
        const { data, error } = await supabase
          .from("attendance")
          .select(attendanceSelect)
          .eq("student_id", profile.id)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) throw error;
        return ok<AttendanceRecord[]>(
          ((data ?? []) as unknown as AttendanceRow[]).map(mapAttendanceRecord),
        );
      }

      // Doctor: all attendance for their subject
      if (!profile.subjectId) return ok<AttendanceRecord[]>([]);
      const { data: sessionIds, error: sErr } = await supabase
        .from("sessions")
        .select("id")
        .eq("subject_id", profile.subjectId);
      if (sErr) throw sErr;
      const ids = (sessionIds ?? []).map((r) => r.id as string);
      if (ids.length === 0) return ok<AttendanceRecord[]>([]);

      let query = supabase
        .from("attendance")
        .select(attendanceSelect)
        .in("session_id", ids)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (sectionFilter && sectionFilter.length > 0) {
        query = query.in("section", sectionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return ok<AttendanceRecord[]>(
        ((data ?? []) as unknown as AttendanceRow[]).map(mapAttendanceRecord),
      );
    } catch (error) {
      return fail<AttendanceRecord[]>(operation, error);
    }
  },
  async submitAttendance(
    hash: string,
    latitude?: number | null,
    longitude?: number | null,
    biometricCredentialId?: string | null,
  ): Promise<ApiResponse<AttendanceSubmissionResult>> {
    const operation = "attendanceRecordService.submitAttendance";
    try {
      // Use the same device identity as registration and device-lock checks.
      const deviceFingerprint = await computeFingerprint();

      const validation = validateRpcInput(submitAttendanceSchema, {
        p_hash: hash,
        p_device_fingerprint: deviceFingerprint,
        p_student_latitude: latitude ?? null,
        p_student_longitude: longitude ?? null,
        p_biometric_credential_id: biometricCredentialId ?? null,
      });
      if (!validation.success) {
        return fail<AttendanceSubmissionResult>(operation, new Error(validation.error));
      }

      const { data, error } = await supabase.rpc("submit_attendance", validation.data);

      if (error) throw error;

      const row = data as { id?: string; created_at?: string } | null;
      if (!row?.id) throw new Error("RPC returned unexpected response.");

      return ok<AttendanceSubmissionResult>({
        attendanceId: row.id,
        recordedAt: row.created_at ?? new Date().toISOString(),
      });
    } catch (error) {
      return fail<AttendanceSubmissionResult>(operation, error);
    }
  },
  async addManualAttendance(
    studentId: string,
    sessionId: string,
  ): Promise<ApiResponse<AttendanceSubmissionResult>> {
    const operation = "attendanceRecordService.addManualAttendance";
    try {
      const validation = validateRpcInput(addManualAttendanceSchema, {
        p_student_id: studentId,
        p_session_id: sessionId,
      });
      if (!validation.success) {
        return fail<AttendanceSubmissionResult>(operation, new Error(validation.error));
      }

      const { data, error } = await supabase.rpc("add_manual_attendance", validation.data);
      if (error) throw error;

      const row = data as { id?: string; created_at?: string } | null;
      if (!row?.id) throw new Error("RPC returned unexpected response.");

      return ok<AttendanceSubmissionResult>({
        attendanceId: row.id,
        recordedAt: row.created_at ?? new Date().toISOString(),
      });
    } catch (error) {
      return fail<AttendanceSubmissionResult>(operation, error);
    }
  },
};
