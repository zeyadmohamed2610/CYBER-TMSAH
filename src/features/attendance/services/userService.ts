import type { AttendanceApiResponse, AttendanceRole } from "../types";
import { supabase } from "@/lib/supabaseClient";

// Direct environment variable access for production reliability
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
      console.log('Creating user via Supabase SDK...');

      // Use Supabase SDK's built-in function invoke
      // This handles auth headers automatically
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

      console.log('SDK Response:', { data, error });

      if (error) {
        console.error('Edge Function error:', error);
        return fail<CreatedUser>(error.message || String(error));
      }

      if (!data || !data.success || !data.user) {
        return fail<CreatedUser>("فشل في إنشاء المستخدم");
      }

      return ok<CreatedUser>(data.user);
    } catch (error) {
      console.error('Create user error:', error);
      return fail<CreatedUser>(error instanceof Error ? error.message : String(error));
    }
  },
};
