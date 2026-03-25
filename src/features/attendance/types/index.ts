export type AttendanceRole = "owner" | "doctor" | "student";

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
  expiresAt: string | null;
  createdAt: string;
  isActive: boolean;
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

export interface CreateUserRpcInput {
  p_auth_id: string;
  p_full_name: string;
  p_role: "doctor" | "student";
  p_subject_id: string | null;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Notification types
export type NotificationType =
  | 'session_starting'
  | 'attendance_submitted'
  | 'attendance_low'
  | 'session_ended'
  | 'session_extended';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

// User Settings
export interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    sessionReminders: boolean;
  };
  display: {
    language: 'ar' | 'en';
  };
}
