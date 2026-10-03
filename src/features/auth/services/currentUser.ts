import { supabase } from "@/shared/api/supabaseClient";
export const resolveAuthUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
};
export const resolveDbUserProfile = async (
  authId: string,
): Promise<{ id: string; subjectId: string | null } | null> => {
  const { data, error } = await supabase
    .from("users")
    .select("id, subject_id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id as string, subjectId: (data.subject_id as string | null) ?? null };
};
