import { createAdminClient, createContextClient } from "npm:@supabase/server@1.8.0/core";
import { readJsonObject, RequestFailure, serverEnvironment } from "../_shared/request.ts";
import { corsHeaders, isAllowedOrigin, json } from "../passkey-login/support.ts";

/** Resolve identifiers on the server; never disclose an account's email before authentication. */
export async function handleAccountLogin(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAllowedOrigin(request.headers.get("origin") ?? ""))
    return json({ error: "Origin not allowed" }, 403);
  try {
    const body = await readJsonObject(request);
    if (
      typeof body.identifier !== "string" ||
      !body.identifier.trim() ||
      body.identifier.length > 254 ||
      typeof body.password !== "string" ||
      !body.password ||
      body.password.length > 1024
    )
      return json({ error: "Invalid request" }, 400);
    const env = serverEnvironment();
    const admin = createAdminClient({ env });
    const client = createContextClient({ env });
    const resolved = await admin.rpc("resolve_login_identifier", { p_identifier: body.identifier });
    if (resolved.error || typeof resolved.data !== "string")
      return json({ error: "Sign-in failed" }, 503);
    const limit = await admin.rpc("reserve_account_login", { p_identifier: resolved.data });
    if (limit.error) return json({ error: "Sign-in failed" }, 503);
    if (!limit.data) return json({ error: "Try again later" }, 429);
    const result = await client.auth.signInWithPassword({
      email: resolved.data,
      password: body.password,
    });
    if (result.error || !result.data.session) return json({ error: "Invalid credentials" }, 401);
    return json({ session: result.data.session, user: result.data.user });
  } catch (error) {
    return json(
      { error: error instanceof RequestFailure ? error.message : "Sign-in failed" },
      error instanceof RequestFailure ? error.status : 503,
    );
  }
}
