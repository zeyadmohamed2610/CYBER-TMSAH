export interface Term {
  id: string;
  name: string;
  status: "draft" | "active" | "closed";
  starts_on: string | null;
  ends_on: string | null;
}
export interface AttendanceRule {
  term_id: string;
  subject_id: string;
  kind: "lecture" | "section";
  max_absences: number | null;
  warning_absences: number | null;
  max_percent: number | null;
  warning_percent: number | null;
  excuse_mode: "exclude" | "count_absent" | null;
}
export interface Result {
  student_id: string;
  subject_id: string;
  subject_name: string;
  kind: "lecture" | "section";
  student_snapshot: { name: string; academic_year: string; section: number };
  present: number;
  absent: number;
  excused: number;
  total: number;
  rule_snapshot: AttendanceRule | null;
}
export interface AttendanceCase {
  id: string;
  student_name: string;
  subject_name: string;
  request_type: "excuse" | "appeal" | "device" | "connection";
  reason: string;
  status: "pending" | "approved" | "rejected";
  decision_reason: string | null;
  file_path: string | null;
  version: number;
}
export interface Overview {
  department: string;
  selected_term: string | null;
  terms: Term[];
  subjects: { id: string; name: string }[];
  rules: AttendanceRule[];
  results: Result[];
  cases: AttendanceCase[];
  absences: { unit_id: string; subject_name: string; lecture_date: string; title: string }[];
  policy: {
    location_retention_days: number | null;
    national_id_retention_days: number | null;
  } | null;
}
export interface Inbox {
  items: {
    id: string;
    category: string;
    title: string;
    body: string;
    created_at: string;
    read_at: string | null;
  }[];
  unread: number;
  muted: string[];
}
