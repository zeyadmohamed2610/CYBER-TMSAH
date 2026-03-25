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

      console.log('Calling function with manual headers...');

      // Use fetch with explicit headers including the apikey
      const response = await fetch(`${SUPABASE_URL}/functions/v1/createUser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: input.name.trim(),
          national_id: input.national_id?.trim(),
          email: input.email?.trim().toLowerCase(),
          password: input.password,
          role: input.role,
          subject_id: input.subjectId ?? null,
        }),
      });

      console.log('Response:', response.status);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        return fail<CreatedUser>(data.error || `خطأ: ${response.status}`);
      }

      if (data.error) return fail<CreatedUser>(data.error);
      if (!data.success || !data.user) return fail<CreatedUser>("فشل في إنشاء المستخدم");

      return ok<CreatedUser>(data.user);
    } catch (error) {
      console.error('Error:', error);
      return fail<CreatedUser>(error instanceof Error ? error.message : String(error));
    }
  },
};
