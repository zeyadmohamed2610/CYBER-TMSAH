import { supabase } from "@/shared/api/supabaseClient";
import type { AcademicEntry, AcademicSettings } from "../utils/academicSchedule";

interface Scope {
  p_department: string;
  p_year: string;
}

export const scheduleService = {
  get(params: { p_department: string | null; p_year: string | null }) {
    return supabase.rpc("get_academic_schedule", params);
  },
  saveEntry(params: Scope & { p_entry: AcademicEntry }) {
    return supabase.rpc("save_academic_entry", params);
  },
  saveCycle(params: Scope & { p_date: string; p_cycle: number | null; p_scope: string }) {
    return supabase.rpc("save_academic_cycle", params);
  },
  saveSettings(params: Scope & { p_settings: AcademicSettings }) {
    return supabase.rpc("save_academic_settings", params);
  },
  replace(params: Scope & { p_entries: AcademicEntry[]; p_expected_revision: string | null }) {
    return supabase.rpc("replace_academic_schedule", params);
  },
  importEntries(params: Scope & { p_entries: AcademicEntry[] }) {
    return supabase.rpc("import_academic_entries", params);
  },
  deleteEntry(params: { p_id: string | undefined }) {
    return supabase.rpc("delete_academic_entry", params);
  },
};
