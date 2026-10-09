import { type AttendanceRecord, type SessionSummary } from "@/features/attendance/types";
export type AttendanceRow = {
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
export type SessionRow = {
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
export const asObj = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};
export const mapSessionSummary = (row: SessionRow): SessionSummary => {
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
    section: row.section ?? null,
  };
};
export const mapAttendanceRecord = (row: AttendanceRow): AttendanceRecord => {
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
