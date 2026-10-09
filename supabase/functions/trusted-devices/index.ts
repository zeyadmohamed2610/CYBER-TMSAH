import { createSupabaseContext } from "npm:@supabase/server@1.8.0";
import { readJsonObject, RequestFailure, serverEnvironment } from "../_shared/request.ts";
import { passkeyAdmin } from "../passkey-login/context.ts";
import { corsHeaders, isAllowedOrigin, json } from "../passkey-login/support.ts";
export async function handleTrustedDevices(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAllowedOrigin(request.headers.get("origin") ?? ""))
    return json({ error: "Origin not allowed" }, 403);
  try {
    const env = serverEnvironment();
    const { data: context, error } = await createSupabaseContext(request, { auth: "user", env });
    if (error || !context) return json({ error: "Authentication required" }, 401);
    const fresh = await context.supabase.auth.getUser();
    if (fresh.error || !fresh.data.user) return json({ error: "Authentication required" }, 401);
    const active = await context.supabaseAdmin.rpc("is_current_platform_session", {
      p_auth_id: fresh.data.user.id,
      p_session_id: (context.jwtClaims as unknown as { session_id?: string }).session_id ?? null,
    });
    if (active.error || !active.data) return json({ error: "Authentication required" }, 401);
    const body = await readJsonObject(request, 1024);
    if (body.action !== "list" && body.action !== "revoke")
      return json({ error: "Invalid action" }, 400);
    const listed = await context.supabase.rpc("list_trusted_attendance_keys");
    if (listed.error || !Array.isArray(listed.data))
      return json({ error: "Permission denied" }, 403);
    if (body.action === "list") return json({ devices: listed.data });
    const profile = await context.supabase
      .from("users")
      .select("role")
      .eq("auth_id", fresh.data.user.id)
      .single();
    if (!profile.data || !["owner", "coordinator"].includes(profile.data.role))
      return json({ error: "Permission denied" }, 403);
    const target = listed.data.find((device) => device.auth_id === body.studentAuthId);
    if (!target?.credential_id) return json({ error: "Trusted key not found" }, 404);
    if (target.credential_exists) {
      const removed = await passkeyAdmin(env).auth.admin.passkey.deletePasskey({
        userId: target.auth_id,
        passkeyId: target.credential_id,
      });
      if (removed.error) return json({ error: "Could not revoke trusted key" }, 503);
    }
    const reset = await context.supabase.rpc("reset_trusted_attendance_key", {
      p_student_auth_id: target.auth_id,
    });
    if (reset.error) return json({ error: "Could not reset trusted key" }, 503);
    return json({ success: true });
  } catch (error) {
    return json(
      { error: error instanceof RequestFailure ? error.message : "Trusted devices unavailable" },
      error instanceof RequestFailure ? error.status : 503,
    );
  }
}
export default { fetch: handleTrustedDevices };
