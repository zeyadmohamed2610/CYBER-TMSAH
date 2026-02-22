export type AttendanceRole = "owner" | "doctor" | "student";

export type AttendanceStatus = "present" | "late" | "absent";

export interface AttendanceApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  role: AttendanceRole;
  displayName?: string;
}

export interface SessionSummary {
  id: string;
  subjectId: string;
  subjectName: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  room?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadiusMeters?: number | null;
  status: "scheduled" | "active" | "ended";
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName?: string;
  subjectName?: string;
  status: AttendanceStatus;
  submittedAt: string;
  ipAddress?: string | null;
  deviceHash?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  recordedByOwner?: boolean;
}

export interface DashboardMetrics {
  totalSessions: number;
  totalStudents: number;
  activeSessions: number;
  attendanceRate: number;
  pendingSubmissions: number;
}

export interface AttendanceTrendPoint {
  date: string;
  label: string;
  present: number;
  late: number;
  absent: number;
}

export interface SubjectAttendanceMetric {
  subjectName: string;
  totalSessions: number;
  attendanceRate: number;
}

export interface AttendanceSubmissionInput {
  sessionId: string;
  rotatingHash: string;
  latitude: number;
  longitude: number;
  deviceHash: string;
  deviceClass: "mobile" | "tablet" | "desktop" | "unknown";
  requestNonce: string;
  timeWindow: number;
  userAgent: string;
  deviceMemory: number | null;
}

export interface AttendanceSubmissionResult {
  attendanceId: string;
  recordedAt: string;
  status: Exclude<AttendanceStatus, "absent">;
}

export interface ExportRequest {
  format: "csv" | "xlsx" | "pdf";
  role: AttendanceRole;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportResult {
  exportId: string;
  downloadUrl: string | null;
}

export interface SystemLogEntry {
  id: string;
  actorUserId?: string | null;
  action: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
}
