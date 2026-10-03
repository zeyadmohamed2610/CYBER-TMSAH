export interface UserProfileDetails {
  id: string;
  auth_id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  role: string;
  department: string | null;
  academic_year: string | null;
  section_number: number | null;
  subject_name?: string | null;
  created_at: string | null;
}
