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

const ok  = <T>(data: T): AttendanceApiResponse<T> => ({ data, error: null });
const fail = <T>(error: string): AttendanceApiResponse<T> => ({ data: null, error });

export const userService = {
  async createUser(input: CreateUserInput): Promise<AttendanceApiResponse<CreatedUser>> {
    try {
      const { data, error } = await supabase.functions.invoke<CreateUserResponse>("createUser", {
        body: {
          name:        input.name.trim(),
          national_id: input.national_id?.trim(),
          email:       input.email?.trim().toLowerCase(),
          password:    input.password,
          role:        input.role,
          subject_id:  input.subjectId ?? null,
        },
      });

      if (error)      return fail<CreatedUser>(error.message || error.toString());
      if (!data)      return fail<CreatedUser>("No response from server.");
      if (data.error) return fail<CreatedUser>(data.error);
      if (!data.success || !data.user) return fail<CreatedUser>("Failed to create user.");

      return ok<CreatedUser>(data.user);
    } catch (error) {
      return fail<CreatedUser>(error instanceof Error ? error.message : String(error));
    }
  },
};
