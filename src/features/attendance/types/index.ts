export type AttendanceRole = "owner" | "doctor" | "student";

export interface AttendanceApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface Subject {
  id: string;
  name: string;
  doctor_name: string;
  createdAt: string;
}

export interface SessionSummary {
  id: string;
  subjectId: string;
  subjectName: string;
  rotatingHash: string | null;
  shortCode: string | null;
  expiresAt: string | null;
  createdAt: string;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName?: string;
  subjectName?: string;
  submittedAt: string; // maps to created_at
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
  count: number;
}

export interface SubjectAttendanceMetric {
  subjectName: string;
  totalSessions: number;
  attendanceRate: number;
}

export interface AttendanceSubmissionResult {
  attendanceId: string;
  recordedAt: string;
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
  actorId: string | null;
  actorName?: string | null;
  action: string;
  createdAt: string;
}
