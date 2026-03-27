import type { AttendanceApiResponse, Subject } from "../types";
import { supabase } from "@/lib/supabaseClient";

const ok = <T>(data: T): AttendanceApiResponse<T> => ({ data, error: null });
const fail = <T>(op: string, err: unknown): AttendanceApiResponse<T> => ({
  data: null,
  error: err instanceof Error ? err.message : `${op} failed.`,
});

export const subjectService = {
  async fetchSubjects(): Promise<AttendanceApiResponse<Subject[]>> {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, doctor_name, created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return ok<Subject[]>(
        (data ?? []).map((row) => ({
          id: row.id as string,
          name: row.name as string,
          doctor_name: (row.doctor_name as string) ?? "",
          createdAt: row.created_at as string,
        })),
      );
    } catch (err) {
      return fail<Subject[]>("fetchSubjects", err);
    }
  },

  async createSubject(
    name: string,
    doctorName: string,
  ): Promise<AttendanceApiResponse<Subject>> {
    try {
      const { data, error } = await supabase.rpc("create_subject", {
        p_name: name.trim(),
        p_doctor_name: doctorName.trim(),
      });
      if (error) throw error;
      const row = data as { id: string; name: string; doctor_name: string | null; created_at: string };
      return ok<Subject>({
        id: row.id,
        name: row.name,
        doctor_name: row.doctor_name ?? "",
        createdAt: row.created_at,
      });
    } catch (err) {
      return fail<Subject>("createSubject", err);
    }
  },

  async updateSubject(
    id: string,
    name: string,
    doctorName: string,
  ): Promise<AttendanceApiResponse<Subject>> {
    try {
      const { data, error } = await supabase.rpc("update_subject", {
        p_id: id,
        p_name: name.trim(),
        p_doctor_name: doctorName.trim(),
      });
      if (error) throw error;
      const row = data as { id: string; name: string; doctor_name: string | null; created_at: string };
      return ok<Subject>({
        id: row.id,
        name: row.name,
        doctor_name: row.doctor_name ?? "",
        createdAt: row.created_at,
      });
    } catch (err) {
      return fail<Subject>("updateSubject", err);
    }
  },

  async deleteSubject(id: string): Promise<AttendanceApiResponse<null>> {
    try {
      const { error } = await supabase.rpc("delete_subject", { p_id: id });
      if (error) throw error;
      return ok<null>(null);
    } catch (err) {
      return fail<null>("deleteSubject", err);
    }
  },
};
