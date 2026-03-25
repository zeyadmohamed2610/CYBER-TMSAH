import type { AttendanceApiResponse, AttendanceRole } from "../types";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabaseClient";

const SUPABASE_URL = supabaseUrl;
const SUPABASE_ANON_KEY = supabaseAnonKey;

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

// Get current session token
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Authorization': `Bearer ${token}`,
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
}

export const userService = {
  async createUser(input: CreateUserInput): Promise<AttendanceApiResponse<CreatedUser>> {
    try {
      // Use direct fetch to ensure headers are included
      const headers = await getAuthHeaders();

      const response = await fetch(`${SUPABASE_URL}/functions/v1/createUser`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: input.name.trim(),
          national_id: input.national_id?.trim(),
          email: input.email?.trim().toLowerCase(),
          password: input.password,
          role: input.role,
          subject_id: input.subjectId ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return fail<CreatedUser>(data.error || `HTTP ${response.status}`);
      }

      if (data.error) return fail<CreatedUser>(data.error);
      if (!data.success || !data.user) return fail<CreatedUser>("Failed to create user.");

      return ok<CreatedUser>(data.user);
    } catch (error) {
      return fail<CreatedUser>(error instanceof Error ? error.message : String(error));
    }
  },
};
