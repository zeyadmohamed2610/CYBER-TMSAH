export interface UserRecord {
  id: string;
  full_name: string;
  username?: string | null;
  email?: string | null;
  role: string;
  national_id?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  department?: string | null;
  departments?: string[];
  academic_year?: string | null;
  section_number?: number | null;
  created_at?: string;
}
export interface Subject {
  id: string;
  name: string;
  department?: string | null;
}
export interface UserForm {
  name: string;
  username: string;
  email: string;
  password: string;
  nationalId: string;
  department: string;
  academicYear: string;
  sectionNumber: string;
  subjectIds: string[];
}
