import { supabase } from "@/shared/api/supabaseClient";
import type { Inbox, Overview } from "./types";

export async function learningRequest<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}
export const loadOverview = (department: string, term: string | null) =>
  learningRequest<Overview>("academic_overview", { p_department: department, p_term: term });
export const loadInbox = (action = "list", payload: Record<string, unknown> = {}) =>
  learningRequest<Inbox>("academic_inbox", { p_action: action, p_payload: payload });
