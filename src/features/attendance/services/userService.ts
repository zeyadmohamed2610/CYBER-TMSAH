import type { AttendanceApiResponse, AttendanceRole } from "../types";
import { supabase } from "@/lib/supabaseClient";

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
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        return fail<CreatedUser>("جلسة الدخول منتهية - سجّل دخول مجدداً");
      }

      console.log('Creating user via Edge Function...');

      const { data, error } = await supabase.functions.invoke('createUser', {
        body: {
          name: input.name.trim(),
          national_id: input.national_id?.trim(),
          email: input.email?.trim().toLowerCase(),
          password: input.password,
          role: input.role,
          subject_id: input.subjectId ?? null
        }
      });

      console.log('Function Response:', data, error);

      if (error) {
        return fail<CreatedUser>(error.message);
      }

      if (data?.error) {
        return fail<CreatedUser>(data.error);
      }

      if (!data?.success || !data?.user) {
        return fail<CreatedUser>("فشل في إنشاء المستخدم");
      }

      return ok<CreatedUser>(data.user);
    } catch (error) {
      console.error('Error:', error);
      return fail<CreatedUser>(error instanceof Error ? error.message : String(error));
    }
  },
};
