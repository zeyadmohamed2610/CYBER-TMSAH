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
import { sha256Hash } from "../utils/fingerprint";

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
  subjects?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type SystemLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  created_at: string;
  users?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
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
    studentName: student?.full_name ?? undefined,
    subjectName: subject?.name ?? undefined,
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
  ): Promise<AttendanceApiResponse<SessionSummary[]>> {
    const operation = "attendanceService.fetchSessionsByRole";
    try {
      const sessionSelect = "id, subject_id, rotating_hash, short_code, expires_at, created_at, latitude, longitude, radius_meters, subjects(name)";

      if (role === "owner") {
        const { data, error } = await supabase
          .from("sessions")
          .select(sessionSelect)
          .order("created_at", { ascending: false });
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

      const { data, error } = await supabase
        .from("sessions")
        .select(sessionSelect)
        .eq("subject_id", profile.subjectId)
        .order("created_at", { ascending: false });

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

      const { data, error } = await supabase
        .from("attendance")
        .select(attendanceSelect)
        .in("session_id", ids)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return ok<AttendanceRecord[]>(((data ?? []) as unknown as AttendanceRow[]).map(mapAttendanceRecord));
    } catch (error) {
      return fail<AttendanceRecord[]>(operation, error);
    }
  },

  /** Dashboard metrics recomputed from real columns. */
  async fetchDashboardMetrics(
    role: AttendanceRole,
  ): Promise<AttendanceApiResponse<DashboardMetrics>> {
    const operation = "attendanceService.fetchDashboardMetrics";
    try {
      if (role === "owner") {
        const [sessionsResult, studentsResult, attendanceResult] = await Promise.all([
          supabase.from("sessions").select("id, expires_at", { count: "exact" }),
          supabase.from("users").select("id", { head: true, count: "exact" }).eq("role", "student"),
          supabase.from("attendance").select("id", { count: "exact" }),
        ]);
        if (sessionsResult.error) throw sessionsResult.error;
        if (studentsResult.error) throw studentsResult.error;
        if (attendanceResult.error) throw attendanceResult.error;

        const sessions = sessionsResult.data ?? [];
        const totalSessions = sessions.length;
        const activeSessions = sessions.filter(
          (s) => s.expires_at && new Date(s.expires_at as string).getTime() > Date.now(),
        ).length;
        const totalStudents = studentsResult.count ?? 0;
        const attendanceCount = attendanceResult.count ?? 0;

        // Attendance rate = actual records / possible records (1 per student per session)
        const possibleAttendance = totalSessions * totalStudents;
        return ok<DashboardMetrics>({
          totalSessions,
          totalStudents,
          activeSessions,
          attendanceRate:
            possibleAttendance > 0
              ? Math.min(100, (attendanceCount / possibleAttendance) * 100)
              : 0,
          pendingSubmissions: 0,
        });
      }

      const authId = await resolveAuthUserId();
      if (!authId) throw new Error("Not authenticated.");
      const profile = await resolveDbUserProfile(authId);

      if (role === "student") {
        if (!profile) {
          return ok<DashboardMetrics>({
            totalSessions: 0,
            totalStudents: 1,
            activeSessions: 0,
            attendanceRate: 0,
            pendingSubmissions: 0,
          });
        }

        // Students can attend any active subject, so their metrics are global.
        const [sessionsResult, attendedResult] = await Promise.all([
          supabase.from("sessions").select("id, expires_at"),
          supabase
            .from("attendance")
            .select("id", { head: true, count: "exact" })
            .eq("student_id", profile.id),
        ]);

        if (sessionsResult.error) throw sessionsResult.error;
        if (attendedResult.error) throw attendedResult.error;

        const sessions = sessionsResult.data ?? [];
        const totalSessions = sessions.length;
        const activeSessions = sessions.filter(
          (s) => s.expires_at && new Date(s.expires_at as string).getTime() > Date.now(),
        ).length;
        const attended = attendedResult.count ?? 0;

        return ok<DashboardMetrics>({
          totalSessions,
          totalStudents: 1,
          activeSessions,
          attendanceRate: totalSessions > 0 ? Math.min(100, (attended / totalSessions) * 100) : 0,
          pendingSubmissions: 0,
        });
      }

      // Doctor
      if (!profile?.subjectId) {
        return ok<DashboardMetrics>({
          totalSessions: 0,
          totalStudents: 0,
          activeSessions: 0,
          attendanceRate: 0,
          pendingSubmissions: 0,
        });
      }

      const [sessionsResult, studentsResult] = await Promise.all([
        supabase.from("sessions").select("id, expires_at").eq("subject_id", profile.subjectId),
        supabase
          .from("users")
          .select("id", { head: true, count: "exact" })
          .eq("role", "student"),
      ]);
      if (sessionsResult.error) throw sessionsResult.error;
      if (studentsResult.error) throw studentsResult.error;

      const sessionList = sessionsResult.data ?? [];
      const totalSessions = sessionList.length;
      const activeSessions = sessionList.filter(
        (s) => s.expires_at && new Date(s.expires_at as string).getTime() > Date.now(),
      ).length;
      const totalStudents = studentsResult.count ?? 0;

      const sessionIds = sessionList.map((s) => s.id as string);
      let attendanceCount = 0;
      if (sessionIds.length > 0) {
        const { count, error: aErr } = await supabase
          .from("attendance")
          .select("id", { head: true, count: "exact" })
          .in("session_id", sessionIds);
        if (aErr) throw aErr;
        attendanceCount = count ?? 0;
      }

      return ok<DashboardMetrics>({
        totalSessions,
        totalStudents,
        activeSessions,
        attendanceRate:
          totalSessions > 0 && totalStudents > 0
            ? Math.min(100, (attendanceCount / (totalSessions * totalStudents)) * 100)
            : 0,
        pendingSubmissions: 0,
      });
    } catch (error) {
      return fail<DashboardMetrics>(operation, error);
    }
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
      const { data, error } = await supabase.rpc("generate_rotating_hash", {
        p_subject_id: subjectId,
        p_duration_minutes: durationMinutes ?? 10,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_radius_meters: radiusMeters ?? 50,
      });

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
  async fetchSubjectMetrics(
    role: AttendanceRole,
  ): Promise<AttendanceApiResponse<SubjectAttendanceMetric[]>> {
    const operation = "attendanceService.fetchSubjectMetrics";
    try {
      const authId = await resolveAuthUserId();
      const profile = authId ? await resolveDbUserProfile(authId) : null;

      let sessionsQuery = supabase
        .from("sessions")
        .select("id, subject_id, subjects(name)");

      if (role === "doctor") {
        if (!profile?.subjectId) return ok<SubjectAttendanceMetric[]>([]);
        sessionsQuery = sessionsQuery.eq("subject_id", profile.subjectId);
      }

      const { data: sessionData, error: sessionError } = await sessionsQuery;
      if (sessionError) throw sessionError;

      type SubjectMetricSessionRow = {
        id: string;
        subject_id: string;
        subjects?: { name?: string | null } | Array<{ name?: string | null }> | null;
      };

      const sessions = (sessionData ?? []) as SubjectMetricSessionRow[];
      if (sessions.length === 0) return ok<SubjectAttendanceMetric[]>([]);

      const sessionToSubject = new Map<string, string>();
      const bySubject: Record<string, { subjectName: string; totalSessions: number; attendedRows: number }> = {};

      for (const row of sessions) {
        const subjectName = asObj(row.subjects)?.name ?? "Unknown Subject";
        sessionToSubject.set(row.id, row.subject_id);
        if (!bySubject[row.subject_id]) {
          bySubject[row.subject_id] = { subjectName, totalSessions: 0, attendedRows: 0 };
        }
        bySubject[row.subject_id].totalSessions += 1;
      }

      const sessionIds = sessions.map((row) => row.id);

      if (role === "student") {
        if (!profile) return ok<SubjectAttendanceMetric[]>([]);

        const { data: attendanceData, error: attendanceError } = await supabase
          .from("attendance")
          .select("session_id")
          .eq("student_id", profile.id)
          .in("session_id", sessionIds);

        if (attendanceError) throw attendanceError;

        for (const row of (attendanceData ?? []) as Array<{ session_id: string }>) {
          const subjectId = sessionToSubject.get(row.session_id);
          if (subjectId && bySubject[subjectId]) bySubject[subjectId].attendedRows += 1;
        }

        return ok<SubjectAttendanceMetric[]>(
          Object.values(bySubject)
            .map((entry) => ({
              subjectName: entry.subjectName,
              totalSessions: entry.totalSessions,
              attendanceRate:
                entry.totalSessions > 0
                  ? Math.min(100, (entry.attendedRows / entry.totalSessions) * 100)
                  : 0,
            }))
            .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
        );
      }

      const { count: totalStudents, error: studentCountError } = await supabase
        .from("users")
        .select("id", { head: true, count: "exact" })
        .eq("role", "student");

      if (studentCountError) throw studentCountError;

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("session_id")
        .in("session_id", sessionIds);

      if (attendanceError) throw attendanceError;

      for (const row of (attendanceData ?? []) as Array<{ session_id: string }>) {
        const subjectId = sessionToSubject.get(row.session_id);
        if (subjectId && bySubject[subjectId]) bySubject[subjectId].attendedRows += 1;
      }

      return ok<SubjectAttendanceMetric[]>(
        Object.values(bySubject)
          .map((entry) => ({
            subjectName: entry.subjectName,
            totalSessions: entry.totalSessions,
            attendanceRate:
              entry.totalSessions > 0 && (totalStudents ?? 0) > 0
                ? Math.min(100, (entry.attendedRows / (entry.totalSessions * (totalStudents ?? 0))) * 100)
                : 0,
          }))
          .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
      );
    } catch (error) {
      return fail<SubjectAttendanceMetric[]>(operation, error);
    }
  },

  /** Submit attendance via RPC with device fingerprint and GPS for verification. */
  async submitAttendance(
    hash: string,
    latitude?: number | null,
    longitude?: number | null,
  ): Promise<AttendanceApiResponse<AttendanceSubmissionResult>> {
    const operation = "attendanceService.submitAttendance";
    try {
      // Compute a stable browser fingerprint from device characteristics
      const canvasFingerprint = (() => {
        try {
          const c = document.createElement("canvas");
          const ctx = c.getContext("2d");
          if (!ctx) return "no-canvas";
          ctx.textBaseline = "top";
          ctx.font = "14px Arial";
          ctx.fillStyle = "#f60";
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = "#069";
          ctx.fillText("cyber-tmsah", 2, 15);
          return c.toDataURL();
        } catch {
          return "canvas-error";
        }
      })();

      const fpRaw = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        String(screen.width),
        String(screen.height),
        String(screen.colorDepth ?? 0),
        String(navigator.hardwareConcurrency ?? 0),
        String(Intl.DateTimeFormat().resolvedOptions().timeZone),
        navigator.vendor,
        canvasFingerprint,
      ].join("|");

      const deviceFingerprint = await sha256Hash(fpRaw);

      const { data, error } = await supabase.rpc("submit_attendance", {
        p_hash: hash,
        p_device_fingerprint: deviceFingerprint,
        p_student_latitude: latitude ?? null,
        p_student_longitude: longitude ?? null,
      });

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
    const operation = "attendanceService.fetchSystemLogs";
    try {
      const { data, error } = await supabase
        .from("system_logs")
        .select("id, actor_id, action, created_at, users:actor_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const logs: SystemLogEntry[] = ((data ?? []) as unknown as SystemLogRow[]).map((row) => {
        const actor = asObj(row.users);
        return {
          id: row.id,
          actorId: row.actor_id,
          actorName: actor?.full_name ?? null,
          action: row.action,
          createdAt: row.created_at,
        };
      });

      return ok<SystemLogEntry[]>(logs);
    } catch (error) {
      return fail<SystemLogEntry[]>(operation, error);
    }
  },

  // ─── Lecture Methods ─────────────────────────────────────────

  /** Fetch lectures with session/attendee counts via single RPC */
  async fetchLectures(
    subjectId?: string,
  ): Promise<AttendanceApiResponse<Lecture[]>> {
    const operation = "attendanceService.fetchLectures";
    try {
      const { data, error } = await supabase.rpc("fetch_lectures", {
        p_subject_id: subjectId ?? null,
      });
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
  ): Promise<AttendanceApiResponse<Lecture>> {
    const operation = "attendanceService.createLecture";
    try {
      const { data, error } = await supabase.rpc("create_lecture", {
        p_subject_id: subjectId,
        p_title: title,
      });
      if (error) throw error;

      const row = data as { id: string; subject_id: string; title: string; lecture_date: string; created_by: string | null; created_at: string };
      return ok<Lecture>({
        id: row.id,
        subject_id: row.subject_id,
        title: row.title,
        lecture_date: row.lecture_date,
        created_by: row.created_by,
        created_at: row.created_at,
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
      const { data, error } = await supabase.rpc("get_lecture_attendees", {
        p_lecture_id: lectureId,
      });
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
      return ok<SessionSummary[]>(((data ?? []) as SessionRow[]).map(mapSessionSummary));
    } catch (error) {
      return fail<SessionSummary[]>(operation, error);
    }
  },

  /** End a lecture: stop all sessions, delete empty ones */
  async endLecture(lectureId: string): Promise<AttendanceApiResponse<null>> {
    const operation = "attendanceService.endLecture";
    try {
      const { error } = await supabase.rpc("end_lecture", { p_lecture_id: lectureId });
      if (error) throw error;
      return ok<null>(null);
    } catch (error) {
      return fail<null>(operation, error);
    }
  },
};
