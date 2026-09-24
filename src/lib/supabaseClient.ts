import { createClient } from "@supabase/supabase-js";
import { validateRpcInput, safeValidateRpcInput, type RpcSchemas } from "./validation";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL environment variable.");
}

if (!supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ValidatedRpcNames = keyof typeof import("./validation").rpcSchemas;

function validateAndCall<T extends ValidatedRpcNames>(
  rpcName: T,
  params: RpcSchemas[T] extends z.ZodTypeAny ? z.infer<RpcSchemas[T]> : never
): ReturnType<typeof supabase.rpc> {
  const validated = validateRpcInput(rpcName, params);
  return supabase.rpc(rpcName, validated as Record<string, unknown>);
}

export const validatedRpc = {
  create_user: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("create_user", params),
  generate_rotating_hash: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("generate_rotating_hash", params),
  submit_attendance: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("submit_attendance", params),
  refresh_session_hash: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("refresh_session_hash", params),
  stop_session: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("stop_session", params),
  set_session_duration: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("set_session_duration", params),
  delete_student_device: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("delete_student_device", params),
  update_session_expiry: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("update_session_expiry", params),
  fetch_lectures: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("fetch_lectures", params),
  create_lecture: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("create_lecture", params),
  get_lecture_attendees: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("get_lecture_attendees", params),
  end_lecture: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("end_lecture", params),
  delete_lecture: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("delete_lecture", params),
  clear_system_logs: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("clear_system_logs", params),
  delete_user_by_id: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("delete_user_by_id", params),
  add_manual_attendance: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("add_manual_attendance", params),
  update_user: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("update_user", params),
  update_session_duration: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("update_session_duration", params),
  set_session_expiry: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("set_session_expiry", params),
  gps_distance_meters: (params: Parameters<typeof supabase.rpc>[1]) => validateAndCall("gps_distance_meters", params),
};

export function safeValidateRpc<T extends ValidatedRpcNames>(
  rpcName: T,
  params: unknown
): { success: true; data: RpcSchemas[T] extends z.ZodTypeAny ? z.infer<RpcSchemas[T]> : never } | { success: false; error: z.ZodError } {
  return safeValidateRpcInput(rpcName, params);
}