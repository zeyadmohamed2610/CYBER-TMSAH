import { type SessionRow, mapSessionSummary } from "@/features/attendance/services/rowMappers";
import { type SessionSummary } from "@/features/attendance/types";
import {
  generateRotatingHashSchema,
  refreshSessionHashSchema,
  setSessionDurationSchema,
  stopSessionSchema,
  updateSessionExpirySchema,
  validateRpcInput,
} from "@/features/attendance/utils/rpcValidation";
import { resolveAuthUserId, resolveDbUserProfile } from "@/features/auth/services/currentUser";
import { type AppRole } from "@/features/auth/types";
import { fail, ok } from "@/shared/api/result";
import { supabase } from "@/shared/api/supabaseClient";
import { type ApiResponse } from "@/shared/api/types";
export const sessionService = {
  async fetchSessionsByRole(
    role: AppRole,
    sectionFilter?: string[],
  ): Promise<ApiResponse<SessionSummary[]>> {
    const operation = "sessionService.fetchSessionsByRole";
    try {
      const sessionSelect =
        "id, subject_id, rotating_hash, short_code, expires_at, created_at, latitude, longitude, radius_meters, subjects(name)";

      if (role === "owner") {
        let query = supabase
          .from("sessions")
          .select(sessionSelect)
          .order("created_at", { ascending: false });
        if (sectionFilter && sectionFilter.length > 0) {
          query = query.in("section", sectionFilter);
        }
        const { data, error } = await query;
        if (error) throw error;
        return ok<SessionSummary[]>(((data ?? []) as SessionRow[]).map(mapSessionSummary));
      }

      // Student: sees ALL active sessions (attends every subject)
      if (role === "student") {
        const { data, error } = await supabase
          .from("sessions")
          .select(sessionSelect)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });
        if (error) throw error;
        return ok<SessionSummary[]>(((data ?? []) as SessionRow[]).map(mapSessionSummary));
      }

      // Doctor: filter by their assigned subject only
      const authId = await resolveAuthUserId();
      if (!authId) throw new Error("Not authenticated.");

      const profile = await resolveDbUserProfile(authId);
      if (!profile?.subjectId) {
        return ok<SessionSummary[]>([]);
      }

      let query = supabase
        .from("sessions")
        .select(sessionSelect)
        .eq("subject_id", profile.subjectId)
        .order("created_at", { ascending: false });

      if (sectionFilter && sectionFilter.length > 0) {
        query = query.in("section", sectionFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return ok<SessionSummary[]>(((data ?? []) as SessionRow[]).map(mapSessionSummary));
    } catch (error) {
      return fail<SessionSummary[]>(operation, error);
    }
  },
  async generateRotatingHash(
    subjectId: string,
    subjectName?: string,
    durationMinutes?: number,
    latitude?: number | null,
    longitude?: number | null,
    radiusMeters?: number,
  ): Promise<ApiResponse<SessionSummary>> {
    const operation = "sessionService.generateRotatingHash";
    try {
      const validation = validateRpcInput(generateRotatingHashSchema, {
        p_subject_id: subjectId,
        p_duration_minutes: durationMinutes ?? 10,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_radius_meters: radiusMeters ?? 50,
      });
      if (!validation.success) {
        return fail<SessionSummary>(operation, new Error(validation.error));
      }

      const { data, error } = await supabase.rpc("generate_rotating_hash", validation.data);

      if (error) throw error;

      const row = data as SessionRow | null;
      if (!row?.id) throw new Error("RPC returned unexpected response.");

      const session = mapSessionSummary({
        ...row,
        subjects: subjectName ? { name: subjectName } : null,
      });

      return ok<SessionSummary>(session);
    } catch (error) {
      return fail<SessionSummary>(operation, error);
    }
  },
  async updateSessionExpiry(
    sessionId: string,
    expiresAt: string | null,
  ): Promise<ApiResponse<null>> {
    const operation = "sessionService.updateSessionExpiry";
    try {
      const validation = validateRpcInput(updateSessionExpirySchema, {
        p_session_id: sessionId,
        p_expires_at: expiresAt ?? new Date().toISOString(),
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("set_session_expiry", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },
  async fetchSessionsForLecture(lectureId: string): Promise<ApiResponse<SessionSummary[]>> {
    const operation = "sessionService.fetchSessionsForLecture";
    try {
      const select =
        "id, subject_id, rotating_hash, short_code, expires_at, created_at, latitude, longitude, radius_meters, lecture_id, subjects(name)";
      const { data, error } = await supabase
        .from("sessions")
        .select(select)
        .eq("lecture_id", lectureId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return ok<SessionSummary[]>((data ?? []).map(mapSessionSummary));
    } catch (error) {
      return fail<SessionSummary[]>(operation, error);
    }
  },
  async setSessionDuration(sessionId: string, durationMinutes: number): Promise<ApiResponse<null>> {
    const operation = "sessionService.setSessionDuration";
    try {
      const validation = validateRpcInput(setSessionDurationSchema, {
        p_session_id: sessionId,
        p_duration_minutes: durationMinutes,
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("set_session_duration", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },
  async refreshSessionHash(sessionId: string): Promise<ApiResponse<null>> {
    const operation = "sessionService.refreshSessionHash";
    try {
      const validation = validateRpcInput(refreshSessionHashSchema, {
        p_session_id: sessionId,
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("refresh_session_hash", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },
  async stopSession(sessionId: string): Promise<ApiResponse<null>> {
    const operation = "sessionService.stopSession";
    try {
      const validation = validateRpcInput(stopSessionSchema, {
        p_session_id: sessionId,
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("stop_session", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },
};
