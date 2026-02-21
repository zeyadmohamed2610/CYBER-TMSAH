import type {
  AttendanceApiResponse,
  AttendanceRecord,
  AttendanceRole,
  AttendanceSubmissionInput,
  AttendanceSubmissionResult,
  AttendanceTrendPoint,
  DashboardMetrics,
  SessionSummary,
  SubjectAttendanceMetric,
} from "../types";
import { supabase } from "@/lib/supabaseClient";

type AttendanceRow = {
  id: string;
  session_id: string;
  student_id: string;
  status: string;
  submitted_at: string;
  ip_address?: string | null;
  device_hash?: string | null;
  sessions?: {
    subject_id?: string | null;
    doctor_id?: string | null;
    subjects?: { name?: string | null } | Array<{ name?: string | null }> | null;
  } | null;
  users?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
};

type SessionRow = {
  id: string;
  subject_id: string;
  doctor_id: string;
  starts_at: string;
  ends_at: string;
  room?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  geofence_radius_meters?: number | null;
  status: string;
  subjects?: { name?: string | null } | Array<{ name?: string | null }> | null;
  attendance?: Array<{ status?: string | null; student_id?: string | null }> | null;
};

type EdgeSubmitAttendancePayload = {
  attendance_id?: string;
  recorded_at?: string;
  attendance_status?: string;
};

type EdgeSubmitAttendanceResponse = {
  data?: EdgeSubmitAttendancePayload | null;
  error?: string;
};

const sessionSelect =
  "id, subject_id, doctor_id, starts_at, ends_at, room, latitude, longitude, geofence_radius_meters, status, subjects(name)";
const attendanceSelect =
  "id, session_id, student_id, status, submitted_at, ip_address, device_hash, sessions(subject_id, doctor_id, subjects(name)), users!attendance_student_id_fkey(full_name)";

const ok = <T>(data: T): AttendanceApiResponse<T> => ({
  data,
  error: null,
});

const fail = <T>(operation: string, error: unknown): AttendanceApiResponse<T> => ({
  data: null,
  error: normalizeError(operation, error),
});

const normalizeError = (operation: string, error: unknown): string => {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    const typedError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      error?: unknown;
    };

    const parts = [typedError.message, typedError.details, typedError.hint]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim());

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    if (typeof typedError.error === "string" && typedError.error.trim().length > 0) {
      return typedError.error.trim();
    }
  }

  return `${operation} failed.`;
};

const asObjectRelation = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

const toNumberOrNull = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toSessionStatus = (status: string): SessionSummary["status"] => {
  if (status === "scheduled" || status === "active" || status === "ended") {
    return status;
  }

  return "ended";
};

const toAttendanceStatus = (status: string): AttendanceRecord["status"] => {
  if (status === "present" || status === "late" || status === "absent") {
    return status;
  }

  return "absent";
};

const toSubmissionStatus = (status: string): AttendanceSubmissionResult["status"] => {
  if (status === "present" || status === "late") {
    return status;
  }

  return "present";
};

const formatTrendLabel = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const mapSessionSummary = (row: SessionRow): SessionSummary => {
  const subject = asObjectRelation(row.subjects);
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectName: subject?.name ?? "Unknown Subject",
    doctorId: row.doctor_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    room: row.room ?? null,
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    geofenceRadiusMeters: row.geofence_radius_meters ?? null,
    status: toSessionStatus(row.status),
  };
};

const mapAttendanceRecord = (row: AttendanceRow): AttendanceRecord => {
  const session = asObjectRelation(row.sessions);
  const subject = asObjectRelation(session?.subjects);
  const student = asObjectRelation(row.users);

  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    studentName: student?.full_name ?? undefined,
    subjectName: subject?.name ?? undefined,
    status: toAttendanceStatus(row.status),
    submittedAt: row.submitted_at,
    ipAddress: row.ip_address ?? null,
    deviceHash: row.device_hash ?? null,
  };
};

const resolveAuthenticatedUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return data.user?.id ?? null;
};

const resolveRoleUserId = async (
  role: AttendanceRole,
  operation: string,
  userId?: string,
): Promise<string | null> => {
  if (userId) {
    return userId;
  }

  const authenticatedUserId = await resolveAuthenticatedUserId();
  if ((role === "doctor" || role === "student") && !authenticatedUserId) {
    throw new Error(`${operation} requires an authenticated ${role} user.`);
  }

  return authenticatedUserId;
};

const fetchDoctorSessionIds = async (doctorId: string): Promise<string[]> => {
  const { data, error } = await supabase.from("sessions").select("id").eq("doctor_id", doctorId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => row.id);
};

const fetchScopedAttendanceRows = async (
  role: AttendanceRole,
  operation: string,
  selectClause: string,
  userId?: string,
): Promise<AttendanceRow[]> => {
  const effectiveUserId = await resolveRoleUserId(role, operation, userId);

  let query = supabase.from("attendance").select(selectClause).order("submitted_at", { ascending: false });

  if (role === "doctor") {
    const sessionIds = await fetchDoctorSessionIds(effectiveUserId as string);
    if (sessionIds.length === 0) {
      return [];
    }
    query = query.in("session_id", sessionIds);
  }

  if (role === "student") {
    query = query.eq("student_id", effectiveUserId as string);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as AttendanceRow[];
};

const fetchOpenSessionIdsByRole = async (
  role: AttendanceRole,
  operation: string,
  userId?: string,
): Promise<string[]> => {
  const effectiveUserId = await resolveRoleUserId(role, operation, userId);
  let query = supabase.from("sessions").select("id").in("status", ["scheduled", "active"]);

  if (role === "doctor") {
    query = query.eq("doctor_id", effectiveUserId as string);
  }

  if (role === "student") {
    query = query.in("status", ["scheduled", "active"]);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.id);
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isEdgeSubmitResponse = (value: unknown): value is EdgeSubmitAttendanceResponse => {
  return isObject(value) && ("data" in value || "error" in value);
};

const isEdgeSubmitPayload = (value: unknown): value is EdgeSubmitAttendancePayload => {
  return isObject(value);
};

export const attendanceService = {
  async fetchDashboardMetrics(role: AttendanceRole, userId?: string): Promise<AttendanceApiResponse<DashboardMetrics>> {
    const operation = "attendanceService.fetchDashboardMetrics";

    try {
      const effectiveUserId = await resolveRoleUserId(role, operation, userId);

      let totalSessionsQuery = supabase.from("sessions").select("id", { head: true, count: "exact" });
      if (role === "doctor") {
        totalSessionsQuery = totalSessionsQuery.eq("doctor_id", effectiveUserId as string);
      }
      if (role === "student") {
        totalSessionsQuery = totalSessionsQuery.in("status", ["scheduled", "active"]);
      }

      let activeSessionsQuery = supabase
        .from("sessions")
        .select("id", { head: true, count: "exact" })
        .eq("status", "active");
      if (role === "doctor") {
        activeSessionsQuery = activeSessionsQuery.eq("doctor_id", effectiveUserId as string);
      }

      const [totalSessionsResult, activeSessionsResult, scopedAttendanceRows, openSessionIds] = await Promise.all([
        totalSessionsQuery,
        activeSessionsQuery,
        fetchScopedAttendanceRows(role, operation, "id, session_id, student_id, status, submitted_at", userId),
        fetchOpenSessionIdsByRole(role, operation, userId),
      ]);

      if (totalSessionsResult.error) {
        throw totalSessionsResult.error;
      }
      if (activeSessionsResult.error) {
        throw activeSessionsResult.error;
      }

      const groupedByStatus = scopedAttendanceRows.reduce(
        (accumulator, row) => {
          const status = toAttendanceStatus(row.status);
          accumulator[status] += 1;
          return accumulator;
        },
        { present: 0, late: 0, absent: 0 },
      );

      const totalAttendanceRows = groupedByStatus.present + groupedByStatus.late + groupedByStatus.absent;
      const presentOrLate = groupedByStatus.present + groupedByStatus.late;
      const attendanceRate = totalAttendanceRows > 0 ? (presentOrLate / totalAttendanceRows) * 100 : 0;

      let totalStudents = 0;
      if (role === "owner") {
        const { count, error } = await supabase
          .from("users")
          .select("id", { head: true, count: "exact" })
          .eq("role", "student");
        if (error) {
          throw error;
        }
        totalStudents = count ?? 0;
      } else if (role === "doctor") {
        totalStudents = new Set(scopedAttendanceRows.map((row) => row.student_id)).size;
      } else {
        totalStudents = effectiveUserId ? 1 : 0;
      }

      const openSessionIdSet = new Set(openSessionIds);
      const submittedOpenSessionIdSet = new Set(
        scopedAttendanceRows
          .map((row) => row.session_id)
          .filter((sessionId): sessionId is string => typeof sessionId === "string" && openSessionIdSet.has(sessionId)),
      );

      const pendingSubmissions = Math.max(openSessionIdSet.size - submittedOpenSessionIdSet.size, 0);

      return ok<DashboardMetrics>({
        totalSessions: totalSessionsResult.count ?? 0,
        totalStudents,
        activeSessions: activeSessionsResult.count ?? 0,
        attendanceRate,
        pendingSubmissions,
      });
    } catch (error) {
      return fail<DashboardMetrics>(operation, error);
    }
  },

  async fetchSessionsByRole(role: AttendanceRole, userId?: string): Promise<AttendanceApiResponse<SessionSummary[]>> {
    const operation = "attendanceService.fetchSessionsByRole";

    try {
      const effectiveUserId = await resolveRoleUserId(role, operation, userId);
      let query = supabase.from("sessions").select(sessionSelect).order("starts_at", { ascending: false });

      if (role === "doctor") {
        query = query.eq("doctor_id", effectiveUserId as string);
      }

      if (role === "student") {
        query = query.in("status", ["scheduled", "active"]);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const sessions = ((data ?? []) as SessionRow[]).map(mapSessionSummary);
      return ok<SessionSummary[]>(sessions);
    } catch (error) {
      return fail<SessionSummary[]>(operation, error);
    }
  },

  async fetchAttendanceRecords(
    role: AttendanceRole,
    userId?: string,
  ): Promise<AttendanceApiResponse<AttendanceRecord[]>> {
    const operation = "attendanceService.fetchAttendanceRecords";

    try {
      const rows = await fetchScopedAttendanceRows(role, operation, attendanceSelect, userId);
      const records = rows.map(mapAttendanceRecord);
      return ok<AttendanceRecord[]>(records);
    } catch (error) {
      return fail<AttendanceRecord[]>(operation, error);
    }
  },

  async fetchTrendData(role: AttendanceRole, userId?: string): Promise<AttendanceApiResponse<AttendanceTrendPoint[]>> {
    const operation = "attendanceService.fetchTrendData";

    try {
      const rows = await fetchScopedAttendanceRows(role, operation, "status, submitted_at, session_id, student_id, id", userId);

      const grouped = rows.reduce<Record<string, AttendanceTrendPoint>>((accumulator, row) => {
        const date = row.submitted_at?.slice(0, 10);
        if (!date) {
          return accumulator;
        }

        if (!accumulator[date]) {
          accumulator[date] = {
            date,
            label: formatTrendLabel(date),
            present: 0,
            late: 0,
            absent: 0,
          };
        }

        const status = toAttendanceStatus(row.status);
        accumulator[date][status] += 1;
        return accumulator;
      }, {});

      const trendPoints = Object.values(grouped).sort((left, right) => left.date.localeCompare(right.date));
      return ok<AttendanceTrendPoint[]>(trendPoints);
    } catch (error) {
      return fail<AttendanceTrendPoint[]>(operation, error);
    }
  },

  async fetchSubjectMetrics(
    role: AttendanceRole,
    userId?: string,
  ): Promise<AttendanceApiResponse<SubjectAttendanceMetric[]>> {
    const operation = "attendanceService.fetchSubjectMetrics";

    try {
      const effectiveUserId = await resolveRoleUserId(role, operation, userId);
      let query = supabase
        .from("sessions")
        .select("id, subject_id, doctor_id, status, subjects(name), attendance(status, student_id)");

      if (role === "doctor") {
        query = query.eq("doctor_id", effectiveUserId as string);
      }
      if (role === "student") {
        query = query.in("status", ["scheduled", "active"]);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const sessions = (data ?? []) as SessionRow[];
      const bySubject = sessions.reduce<
        Record<string, { subjectName: string; totalSessions: number; totalAttendanceRows: number; attendedRows: number }>
      >((accumulator, row) => {
        const subject = asObjectRelation(row.subjects);
        const subjectName = subject?.name ?? "Unknown Subject";

        if (!accumulator[row.subject_id]) {
          accumulator[row.subject_id] = {
            subjectName,
            totalSessions: 0,
            totalAttendanceRows: 0,
            attendedRows: 0,
          };
        }

        const attendanceRows = row.attendance ?? [];
        const attendedRows = attendanceRows.filter((entry) => {
          const status = entry.status ?? "absent";
          return status === "present" || status === "late";
        }).length;

        accumulator[row.subject_id].totalSessions += 1;
        accumulator[row.subject_id].totalAttendanceRows += attendanceRows.length;
        accumulator[row.subject_id].attendedRows += attendedRows;

        return accumulator;
      }, {});

      const metrics: SubjectAttendanceMetric[] = Object.values(bySubject)
        .map((entry) => ({
          subjectName: entry.subjectName,
          totalSessions: entry.totalSessions,
          attendanceRate:
            entry.totalAttendanceRows > 0 ? (entry.attendedRows / entry.totalAttendanceRows) * 100 : 0,
        }))
        .sort((left, right) => left.subjectName.localeCompare(right.subjectName));

      return ok<SubjectAttendanceMetric[]>(metrics);
    } catch (error) {
      return fail<SubjectAttendanceMetric[]>(operation, error);
    }
  },

  async submitAttendance(
    payload: AttendanceSubmissionInput,
  ): Promise<AttendanceApiResponse<AttendanceSubmissionResult>> {
    const operation = "attendanceService.submitAttendance";

    try {
      const { data, error } = await supabase.functions.invoke("submitAttendance", {
        body: {
          session_id: payload.sessionId,
          rotating_hash: payload.rotatingHash,
          latitude: payload.latitude,
          longitude: payload.longitude,
          device_hash: payload.deviceHash,
          request_nonce: payload.requestNonce,
          time_window: payload.timeWindow,
        },
      });

      if (error) {
        throw error;
      }

      const rawResponse = data as unknown;

      if (isEdgeSubmitResponse(rawResponse) && typeof rawResponse.error === "string" && rawResponse.error.trim()) {
        throw new Error(rawResponse.error.trim());
      }

      const edgeResult = isEdgeSubmitResponse(rawResponse) ? rawResponse.data : rawResponse;
      if (!isEdgeSubmitPayload(edgeResult)) {
        throw new Error("Edge function returned an unexpected response shape.");
      }

      const attendanceId =
        typeof edgeResult.attendance_id === "string" && edgeResult.attendance_id.trim()
          ? edgeResult.attendance_id
          : null;
      const recordedAt =
        typeof edgeResult.recorded_at === "string" && edgeResult.recorded_at.trim()
          ? edgeResult.recorded_at
          : null;
      const status =
        typeof edgeResult.attendance_status === "string" && edgeResult.attendance_status.trim()
          ? edgeResult.attendance_status
          : null;

      if (!attendanceId || !recordedAt || !status) {
        throw new Error("Edge function returned an unexpected response shape.");
      }

      return ok<AttendanceSubmissionResult>({
        attendanceId,
        recordedAt,
        status: toSubmissionStatus(status),
      });
    } catch (error) {
      return fail<AttendanceSubmissionResult>(operation, error);
    }
  },
};
