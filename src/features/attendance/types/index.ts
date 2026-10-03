export interface Lecture {
  kind?: "lecture" | "section";
  section?: string | null;
  duration_minutes?: number;
  id: string;
  subject_id: string;
  title: string;
  lecture_date: string;
  created_by: string | null;
  created_at: string;
  subject_name?: string;
  session_count?: number;
  attendee_count?: number;
  is_ended?: boolean;
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
  radiusMeters: number | null;
  lectureId: string | null;
  section?: string | null;
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
  section?: string | null;
}

export interface DashboardMetrics {
  totalSessions: number;
  totalStudents: number;
  activeSessions: number;
  attendanceRate: number;
  pendingSubmissions: number;
  completedOpportunities?: number;
  absenceRate?: number;
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

export interface SystemLogEntry {
  id: string;
  actorId: string | null;
  actorName?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
