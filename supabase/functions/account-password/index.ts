import { createSupabaseContext } from "npm:@supabase/server@1.8.0";
import { assertUncompromisedPassword } from "../_shared/passwordBreach.ts";
import { readJsonObject, RequestFailure, serverEnvironment } from "../_shared/request.ts";
import { corsHeaders, isAllowedOrigin, json } from "../passkey-login/support.ts";

export async function handlePasswordChange(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAllowedOrigin(request.headers.get("origin") ?? ""))
    return json({ error: "Origin not allowed" }, 403);
  try {
    const { data: context, error } = await createSupabaseContext(request, {
      auth: "user",
      env: serverEnvironment(),
    });
    if (error || !context) return json({ error: "Authentication required" }, 401);
    const fresh = await context.supabase.auth.getUser();
    if (fresh.error || !fresh.data.user) return json({ error: "Authentication required" }, 401);
    const claims = context.jwtClaims as unknown as {
      amr?: { timestamp?: number }[];
      session_id?: string;
    };
    const active = await context.supabaseAdmin.rpc("is_current_platform_session", {
      p_auth_id: fresh.data.user.id,
      p_session_id: claims.session_id ?? null,
    });
    if (active.error || !active.data) return json({ error: "Authentication required" }, 401);
    const now = Date.now() / 1000;
    if (
      !claims.amr?.some(
        (method) =>
          typeof method.timestamp === "number" &&
          method.timestamp <= now + 30 &&
          now - method.timestamp <= 300,
      )
    )
      return json({ error: "RECENT_AUTH_REQUIRED" }, 403);
    const profile = await context.supabase
      .from("users")
      .select("id")
      .eq("auth_id", fresh.data.user.id)
      .maybeSingle();
    if (profile.error || !profile.data) return json({ error: "Permission denied" }, 403);
    const allowed = await context.supabaseAdmin.rpc("reserve_password_action", {
      p_ip: request.headers.get("x-real-ip") ?? "unknown",
      p_actor: fresh.data.user.id,
    });
    if (allowed.error || !allowed.data) return json({ error: "Try again later" }, 429);
    const body = await readJsonObject(request, 2048);
    const password = await assertUncompromisedPassword(body.password);
    const proof = await context.supabaseAdmin.rpc("register_password_check", {
      p_password: password,
      p_actor: fresh.data.user.id,
      p_target: fresh.data.user.id,
    });
    if (proof.error?.message.includes("same_password"))
      return json({ error: "PASSWORD_SAME" }, 400);
    if (proof.error || !proof.data) return json({ error: "Password update unavailable" }, 503);
    const updated = await context.supabaseAdmin.auth.admin.updateUserById(fresh.data.user.id, {
      password,
      app_metadata: { ...fresh.data.user.app_metadata, password_write_nonce: proof.data },
    });
    if (updated.error) return json({ error: "Password update failed" }, 400);
    return json({ success: true });
  } catch (error) {
    return json(
      { error: error instanceof RequestFailure ? error.message : "Password update unavailable" },
      error instanceof RequestFailure ? error.status : 503,
    );
  }
}
export default { fetch: handlePasswordChange };
