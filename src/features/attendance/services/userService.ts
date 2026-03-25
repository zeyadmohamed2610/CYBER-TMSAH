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
      // Debug: log the environment variables
      console.log('Creating user - ENV:', {
        url: SUPABASE_URL,
        hasKey: !!SUPABASE_ANON_KEY,
        keyLength: SUPABASE_ANON_KEY?.length
      });

      // Get current user - this gives us the most up-to-date session
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error('Get user error:', userError);
        return fail<CreatedUser>(userError.message);
      }

      if (!user) {
        return fail<CreatedUser>("لم يتم العثور على مستخدم مسجل");
      }

      // Get the access token from the current user
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        return fail<CreatedUser>("لم يتم العثور على جلسة دخول");
      }

      console.log('User authenticated, calling Edge Function...');
      console.log('User ID:', user.id);

      // Use direct fetch to ensure headers are properly set
      const response = await fetch(`${SUPABASE_URL}/functions/v1/createUser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${accessToken}`,
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

      console.log('Response status:', response.status);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        return fail<CreatedUser>(data.error || `HTTP ${response.status}`);
      }

      if (data.error) return fail<CreatedUser>(data.error);
      if (!data.success || !data.user) return fail<CreatedUser>("فشل في إنشاء المستخدم");

      return ok<CreatedUser>(data.user);
    } catch (error) {
      console.error('Create user error:', error);
      return fail<CreatedUser>(error instanceof Error ? error.message : String(error));
    }
  },
};
