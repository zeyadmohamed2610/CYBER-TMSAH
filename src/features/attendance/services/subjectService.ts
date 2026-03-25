import type { AttendanceApiResponse } from "../types";
import type { Subject } from "../types";
import { supabase } from "@/lib/supabaseClient";

const ok  = <T>(data: T): AttendanceApiResponse<T> => ({ data, error: null });
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
      const subjects: Subject[] = (data ?? []).map((row) => ({
        id:          row.id as string,
        name:        row.name as string,
        doctor_name: (row.doctor_name as string) ?? "",
        createdAt:   row.created_at as string,
      }));
      return ok<Subject[]>(subjects);
    } catch (err) {
      return fail<Subject[]>("fetchSubjects", err);
    }
  },

  async createSubject(name: string, doctorName: string): Promise<AttendanceApiResponse<Subject>> {
    try {
      const { data, error } = await supabase
        .from("subjects")
        .insert({ name: name.trim(), doctor_name: doctorName.trim() })
        .select("id, name, doctor_name, created_at")
        .single();
      if (error) throw error;
      return ok<Subject>({
        id:          data.id as string,
        name:        data.name as string,
        doctor_name: (data.doctor_name as string) ?? "",
        createdAt:   data.created_at as string,
      });
    } catch (err) {
      return fail<Subject>("createSubject", err);
    }
  },
};
