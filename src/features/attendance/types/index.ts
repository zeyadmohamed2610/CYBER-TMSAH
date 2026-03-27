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

export interface Lecture {
  id: string;
  subject_id: string;
  title: string;
  lecture_date: string;
  created_by: string | null;
  created_at: string;
  subject_name?: string;
  session_count?: number;
  attendee_count?: number;
}

export interface LectureAttendee {
  attendance_id: string;
  student_name: string;
  national_id: string | null;
  session_id: string;
  short_code: string | null;
  submitted_at: string;
  ip_address: string | null;
  student_latitude: number | null;
  student_longitude: number | null;
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
  lectureId?: string | null;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName?: string;
  nationalId?: string;
  subjectName?: string;
  submittedAt: string;
  ipAddress?: string | null;
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
