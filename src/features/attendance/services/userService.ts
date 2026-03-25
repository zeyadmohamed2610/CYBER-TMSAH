import type { AttendanceApiResponse, AttendanceRole } from "../types";
import { supabase } from "@/lib/supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface CreateUserInput {
  name: string;
  national_id?: string;
  email?: string;
  password: string;
  role: "doctor" | "student";
  subjectId?: string | null;
}

export interface CreatedUser {
  id: string;
  name: string;
  role: AttendanceRole;
}

const ok = <T>(data: T): AttendanceApiResponse<T> => ({ data, error: null });
const fail = <T>(error: string): AttendanceApiResponse<T> => ({ data: null, error });

export const userService = {
  async createUser(input: CreateUserInput): Promise<AttendanceApiResponse<CreatedUser>> {
    try {
      // Get fresh session with access token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        return fail<CreatedUser>("جلسة الدخول منتهية - سجّل دخول مجدداً");
      }

      console.log('Creating user via RPC...');

      // Call the database RPC function directly
      const { data, error } = await supabase.rpc('admin_create_user', {
        p_full_name: input.name.trim(),
        p_email: input.email?.trim().toLowerCase() || '',
        p_password: input.password,
        p_role: input.role,
        p_subject_id: input.subjectId ?? null
      });

      console.log('RPC Response:', data, error);

      if (error) {
        return fail<CreatedUser>(error.message);
      }

      if (data?.error) {
        return fail<CreatedUser>(data.error);
      }

      if (!data?.success || !data?.user) {
        return fail<CreatedUser>("فشل في إنشاء المستخدم");
      }

      return ok<CreatedUser>({
        id: data.user.id,
        name: data.user.name,
        role: data.user.role
      });
    } catch (error) {
      console.error('Error:', error);
      return fail<CreatedUser>(error instanceof Error ? error.message : String(error));
    }
  },
};
