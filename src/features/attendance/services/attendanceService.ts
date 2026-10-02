import { computeFingerprint } from "../utils/fingerprint";
import type {
  AttendanceApiResponse,
  AttendanceRecord,
  AttendanceRole,
  AttendanceSubmissionResult,
  AttendanceTrendPoint,
  DashboardMetrics,
  Lecture,
  LectureAttendee,
  SessionSummary,
  SubjectAttendanceMetric,
  SystemLogEntry,
} from "../types";
import { supabase } from "@/lib/supabaseClient";
import {
  validateRpcInput,
  generateRotatingHashSchema,
  submitAttendanceSchema,
  createLectureSchema,
  updateSessionExpirySchema,
  fetchLecturesSchema,
  getLectureAttendeesSchema,
  endLectureSchema,
  deleteLectureSchema,
  addManualAttendanceSchema,
  updateUserSchema,
  deleteStudentDeviceSchema,
  setSessionDurationSchema,
  refreshSessionHashSchema,
  stopSessionSchema,
} from "../utils/rpcValidation";

// ─── Internal row shapes ─────────────────────────────────────────────────────

type AttendanceRow = {
  id: string;
  session_id: string;
  student_id: string;
  created_at: string;
  sessions?: {
    subject_id?: string | null;
    subjects?: { name?: string | null } | Array<{ name?: string | null }> | null;
  } | null;
  users?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
};

type SessionRow = {
  id: string;
  subject_id: string;
  rotating_hash?: string | null;
  short_code?: string | null;
  expires_at?: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
  lecture_id?: string | null;
  section?: string | null;
  subjects?: { name?: string | null } | Array<{ name?: string | null }> | null;
};


// ─── Helpers ─────────────────────────────────────────────────────────────────

const ok = <T>(data: T): AttendanceApiResponse<T> => ({ data, error: null });

const fail = <T>(operation: string, error: unknown): AttendanceApiResponse<T> => ({
  data: null,
  error: normalizeError(operation, error),
});

const normalizeError = (operation: string, error: unknown): string => {
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

const asObj = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

const formatTrendLabel = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// Pagination helper - default values for backward compatibility
const getPaginationRange = (page = 1, pageSize = 50) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

const mapSessionSummary = (row: SessionRow): SessionSummary => {
  const subject = asObj(row.subjects);
  const expiresAt = row.expires_at ?? null;
  const isActive = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectName: subject?.name ?? "Unknown Subject",
    rotatingHash: row.rotating_hash ?? null,
    shortCode: row.short_code ?? null,
    expiresAt,
    createdAt: row.created_at,
    isActive,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    radiusMeters: row.radius_meters ?? 50,
    lectureId: row.lecture_id ?? null,
  };
};

const mapAttendanceRecord = (row: AttendanceRow): AttendanceRecord => {
  const session = asObj(row.sessions);
  const subject = asObj(session?.subjects);
  const student = asObj(row.users);
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    studentName: student?.full_name ?? "",
    subjectName: subject?.name ?? "",
    submittedAt: row.created_at,
  };
};

// ─── Private helpers ─────────────────────────────────────────────────────────

const resolveAuthUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
};

const resolveDbUserProfile = async (
  authId: string,
): Promise<{ id: string; subjectId: string | null } | null> => {
  const { data, error } = await supabase
    .from("users")
    .select("id, subject_id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id as string, subjectId: (data.subject_id as string | null) ?? null };
};

// ─── Public service ───────────────────────────────────────────────────────────

export const attendanceService = {
  /** Fetch sessions filtered by role. Derives isActive from expires_at. */
  async fetchSessionsByRole(
    role: AttendanceRole,
    sectionFilter?: string[],
  ): Promise<AttendanceApiResponse<SessionSummary[]>> {
    const operation = "attendanceService.fetchSessionsByRole";
    try {
      const sessionSelect = "id, subject_id, rotating_hash, short_code, expires_at, created_at, latitude, longitude, radius_meters, subjects(name)";

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

  /** Fetch attendance records filtered by role. */
  async fetchAttendanceRecords(
    role: AttendanceRole,
    pagination?: { page?: number; pageSize?: number },
    sectionFilter?: string[],
  ): Promise<AttendanceApiResponse<AttendanceRecord[]>> {
    const operation = "attendanceService.fetchAttendanceRecords";
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
        return ok<AttendanceRecord[]>(((data ?? []) as unknown as AttendanceRow[]).map(mapAttendanceRecord));
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
      return ok<AttendanceRecord[]>(((data ?? []) as unknown as AttendanceRow[]).map(mapAttendanceRecord));
    } catch (error) {
      return fail<AttendanceRecord[]>(operation, error);
    }
  },

  /** Ratios use eligible students and completed lecture opportunities. */
  async fetchDashboardMetrics(_role: AttendanceRole, sectionFilter?: string[]): Promise<AttendanceApiResponse<DashboardMetrics>> {
    try {
      const { data, error } = await supabase.rpc("get_attendance_summary", { p_sections: sectionFilter?.length ? sectionFilter : null });
      if (error) throw error;
      if (!data?.dashboard) throw new Error("تعذر تحميل إحصاءات الحضور.");
      return ok<DashboardMetrics>(data.dashboard as DashboardMetrics);
    } catch (error) { return fail<DashboardMetrics>("attendanceService.fetchDashboardMetrics", error); }
  },

  /**
   * Generate rotating hash for a subject via RPC with GPS coordinates.
   */
  async generateRotatingHash(
    subjectId: string,
    subjectName?: string,
    durationMinutes?: number,
    latitude?: number | null,
    longitude?: number | null,
    radiusMeters?: number,
  ): Promise<AttendanceApiResponse<SessionSummary>> {
    const operation = "attendanceService.generateRotatingHash";
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
  async fetchSubjectMetrics(_role: AttendanceRole, sectionFilter?: string[]): Promise<AttendanceApiResponse<SubjectAttendanceMetric[]>> {
    try {
      const { data, error } = await supabase.rpc("get_attendance_summary", { p_sections: sectionFilter?.length ? sectionFilter : null });
      if (error) throw error;
      return ok<SubjectAttendanceMetric[]>((data?.subjects ?? []) as SubjectAttendanceMetric[]);
    } catch (error) { return fail<SubjectAttendanceMetric[]>("attendanceService.fetchSubjectMetrics", error); }
  },

  /** Submit attendance via RPC with device fingerprint and GPS for verification. */
  async submitAttendance(
    hash: string,
    latitude?: number | null,
    longitude?: number | null,
    biometricCredentialId?: string | null,
  ): Promise<AttendanceApiResponse<AttendanceSubmissionResult>> {
    const operation = "attendanceService.submitAttendance";
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

  /**
   * Compute trend data from already-fetched records.
   */

  computeTrendData(records: AttendanceRecord[]): AttendanceTrendPoint[] {
    const grouped = records.reduce<Record<string, AttendanceTrendPoint>>((acc, row) => {
      const date = row.submittedAt?.slice(0, 10);
      if (!date) return acc;
      if (!acc[date]) {
        acc[date] = { date, label: formatTrendLabel(date), count: 0 };
      }
      acc[date].count += 1;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  },

  /** Fetch system logs (owner only). */
  async fetchSystemLogs(): Promise<AttendanceApiResponse<SystemLogEntry[]>> {

    try {
      const { data, error } = await supabase
        .from("system_logs")
        .select("id, actor_id, action, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.log("system_logs table error:", error.message);
        return ok<SystemLogEntry[]>([]);
      }

      const logs: SystemLogEntry[] = (data ?? []).map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorName: null,
        action: row.action,
        createdAt: row.created_at,
      }));

      return ok<SystemLogEntry[]>(logs);
    } catch (error) {
      console.error("fetchSystemLogs error:", error);
      return ok<SystemLogEntry[]>([]);
    }
  },

  /** Clear all system logs (owner only). */
  async clearSystemLogs(): Promise<AttendanceApiResponse<null>> {

    try {
      const { error } = await supabase.rpc("clear_system_logs");
      if (error) {
        console.log("clear_system_logs error:", error.message);
        return ok<null>(null);
      }
      return ok<null>(null);
    } catch (error) {
      console.error("clearSystemLogs error:", error);
      return ok<null>(null);
    }
  },

  // ─── Lecture Methods ─────────────────────────────────────────

  async fetchLectures(
    subjectId?: string,
  ): Promise<AttendanceApiResponse<Lecture[]>> {
    const operation = "attendanceService.fetchLectures";
    try {
      const validation = validateRpcInput(fetchLecturesSchema, {
        p_subject_id: subjectId ?? null,
      });
      if (!validation.success) {
        return fail<Lecture[]>(operation, new Error(validation.error));
      }

      const { data, error } = await supabase.rpc("fetch_lectures", validation.data);
      if (error) throw error;

      const lectures: Lecture[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        subject_id: row.subject_id as string,
        title: row.title as string,
        lecture_date: row.lecture_date as string,
        created_by: (row.created_by as string) ?? null,
        created_at: row.created_at as string,
        subject_name: (row.subject_name as string) ?? "غير معروف",
        session_count: Number(row.session_count ?? 0),
        attendee_count: Number(row.attendee_count ?? 0),
        is_ended: (row.is_ended as boolean) ?? false,
        kind: row.kind === 'section' ? 'section' : 'lecture',
        section: (row.section as string | null) ?? null,
        duration_minutes: Number(row.duration_minutes ?? 60),
      }));

      return ok<Lecture[]>(lectures);
    } catch (error) {
      return fail<Lecture[]>(operation, error);
    }
  },

  /** Create a new lecture */
  async createLecture(
    subjectId: string,
    title: string,
    kind?: 'lecture' | 'section',
    section?: string | null,
  ): Promise<AttendanceApiResponse<Lecture>> {
    const operation = "attendanceService.createLecture";
    try {
      const validation = validateRpcInput(createLectureSchema, {
        p_subject_id: subjectId,
        p_title: title,
        ...(kind ? { p_kind: kind, p_section: section ?? null } : {}),
      });
      if (!validation.success) {
        return fail<Lecture>(operation, new Error(validation.error));
      }

      const { data, error } = await supabase.rpc("create_lecture", validation.data);
      if (error) throw error;

      const row = data as Lecture;
      return ok<Lecture>({
        id: row.id,
        subject_id: row.subject_id,
        title: row.title,
        lecture_date: row.lecture_date,
        created_by: row.created_by,
        created_at: row.created_at,
        kind: row.kind ?? 'lecture',
        section: row.section ?? null,
        duration_minutes: row.duration_minutes ?? 60,
      });
    } catch (error) {
      return fail<Lecture>(operation, error);
    }
  },

  /** Get all attendees for a lecture with full details */
  async getLectureAttendees(
    lectureId: string,
  ): Promise<AttendanceApiResponse<LectureAttendee[]>> {
    const operation = "attendanceService.getLectureAttendees";
    try {
      const validation = validateRpcInput(getLectureAttendeesSchema, {
        p_lecture_id: lectureId,
      });
      if (!validation.success) {
        return fail<LectureAttendee[]>(operation, new Error(validation.error));
      }

      const { data, error } = await supabase.rpc("get_lecture_attendees", validation.data);
      if (error) throw error;

      const attendees: LectureAttendee[] = (data ?? []).map((row: Record<string, unknown>) => ({
        attendance_id: (row.attendance_id as string) ?? (row.id as string),
        student_name: (row.student_name as string) ?? (row.full_name as string),
        national_id: (row.national_id as string) ?? null,
        session_id: row.session_id as string,
        short_code: (row.short_code as string) ?? null,
        submitted_at: (row.submitted_at as string) ?? (row.created_at as string),
        ip_address: row.ip_address != null ? String(row.ip_address) : null,
        student_latitude: (row.student_latitude as number) ?? null,
        student_longitude: (row.student_longitude as number) ?? null,
      }));

      return ok<LectureAttendee[]>(attendees);
    } catch (error) {
      return fail<LectureAttendee[]>(operation, error);
    }
  },

  /** Update session expiry to manually open or close it (uses SECURITY DEFINER RPC) */
  async updateSessionExpiry(
    sessionId: string,
    expiresAt: string | null,
  ): Promise<AttendanceApiResponse<null>> {
    const operation = "attendanceService.updateSessionExpiry";
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

  /** End a lecture and all its sessions */
  async endLecture(lectureId: string): Promise<AttendanceApiResponse<null>> {
    const operation = "attendanceService.endLecture";
    try {
      const validation = validateRpcInput(endLectureSchema, {
        p_lecture_id: lectureId,
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("end_lecture", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },

  /** Fetch sessions for a specific lecture */
  async fetchSessionsForLecture(
    lectureId: string,
  ): Promise<AttendanceApiResponse<SessionSummary[]>> {
    const operation = "attendanceService.fetchSessionsForLecture";
    try {
      const select = "id, subject_id, rotating_hash, short_code, expires_at, created_at, latitude, longitude, radius_meters, lecture_id, subjects(name)";
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

  /** Delete a lecture (owner only) */
  async deleteLecture(lectureId: string): Promise<AttendanceApiResponse<null>> {
    const operation = "attendanceService.deleteLecture";
    try {
      const validation = validateRpcInput(deleteLectureSchema, {
        p_lecture_id: lectureId,
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("delete_lecture", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },

  /** Add manual attendance (owner/doctor/ta) */
  async addManualAttendance(
    studentId: string,
    sessionId: string,
  ): Promise<AttendanceApiResponse<AttendanceSubmissionResult>> {
    const operation = "attendanceService.addManualAttendance";
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

  /** Update user profile (owner only) */
  async updateUser(
    userId: string,
    fullName: string,
    nationalId?: string | null,
    subjectId?: string | null,
  ): Promise<AttendanceApiResponse<null>> {
    const operation = "attendanceService.updateUser";
    try {
      const validation = validateRpcInput(updateUserSchema, {
        p_user_id: userId,
        p_full_name: fullName,
        p_national_id: nationalId ?? null,
        p_subject_id: subjectId ?? null,
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("update_user", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },

  /** Delete student device binding (owner only) */
  async deleteStudentDevice(studentId: string): Promise<AttendanceApiResponse<null>> {
    const operation = "attendanceService.deleteStudentDevice";
    try {
      const validation = validateRpcInput(deleteStudentDeviceSchema, {
        p_student_id: studentId,
      });
      if (!validation.success) {
        return fail<null>(operation, new Error(validation.error));
      }

      const { error } = await supabase.rpc("delete_student_device", validation.data);
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },

  /** Set session duration (owner/doctor/ta) */
  async setSessionDuration(
    sessionId: string,
    durationMinutes: number,
  ): Promise<AttendanceApiResponse<null>> {
    const operation = "attendanceService.setSessionDuration";
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

  /** Refresh session hash (owner/doctor/ta) */
  async refreshSessionHash(sessionId: string): Promise<AttendanceApiResponse<null>> {
    const operation = "attendanceService.refreshSessionHash";
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

  /** Stop session immediately (owner/doctor/ta) */
  async stopSession(sessionId: string): Promise<AttendanceApiResponse<null>> {
    const operation = "attendanceService.stopSession";
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
