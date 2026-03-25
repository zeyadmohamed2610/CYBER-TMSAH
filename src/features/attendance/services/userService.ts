import type { AttendanceApiResponse, AttendanceRole } from "../types";
import { supabase } from "@/lib/supabaseClient";

export interface CreateUserInput {
  name: string;
  national_id?: string;   // students only (14-digit)
  email?: string;         // doctors/owner
  password: string;
  role: "doctor" | "student";
  subjectId?: string | null;
}

export interface CreatedUser {
  id: string;
  name: string;
  role: AttendanceRole;
}

type CreateUserResponse = {
  success?: boolean;
  user?: CreatedUser;
  error?: string;
};

const ok = <T>(data: T): AttendanceApiResponse<T> => ({ data, error: null });
const fail = <T>(error: string): AttendanceApiResponse<T> => ({ data: null, error });

export const userService = {
  async createUser(input: CreateUserInput): Promise<AttendanceApiResponse<CreatedUser>> {
    try {
      console.log('Creating user - calling function...');

      // Use the SDK's invoke method - it handles auth automatically
      // The SDK gets the session and passes the correct headers
      const { data, error } = await supabase.functions.invoke('createUser', {
        body: {
          name: input.name.trim(),
          national_id: input.national_id?.trim(),
          email: input.email?.trim().toLowerCase(),
          password: input.password,
          role: input.role,
          subject_id: input.subjectId ?? null,
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        return fail<CreatedUser>(error.message || String(error));
      }

      if (!data) {
        return fail<CreatedUser>("لم يتم استلام رد من السيرفر");
      }

      if (data.error) {
        return fail<CreatedUser>(data.error);
      }

      if (!data.success || !data.user) {
        return fail<CreatedUser>("فشل في إنشاء المستخدم");
      }

      return ok<CreatedUser>(data.user);
    } catch (error) {
      console.error('Create user error:', error);
      return fail<CreatedUser>(error instanceof Error ? error.message : String(error));
    }
  },
};
