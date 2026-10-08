import { createAdminClient, createContextClient } from "npm:@supabase/server@1.8.0/core";
import { readJsonObject, RequestFailure, serverEnvironment } from "../_shared/request.ts";
import { corsHeaders, isAllowedOrigin, json } from "../passkey-login/support.ts";

/** Pending requests and orphan Auth identities cannot request recovery through the platform. */
export async function handleAccountRecovery(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const origin = request.headers.get("origin") ?? "";
  if (!isAllowedOrigin(origin)) return json({ error: "Origin not allowed" }, 403);
  try {
    const body = await readJsonObject(request, 1024);
    if (
      typeof body.email !== "string" ||
      body.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
    )
      return json({ error: "Invalid request" }, 400);
    const env = serverEnvironment();
    const admin = createAdminClient({ env });
    const eligibility = await admin.rpc("reserve_approved_account_recovery", {
      p_email: body.email.trim().toLowerCase(),
      p_client_ip: request.headers.get("x-real-ip") ?? "unknown",
    });
    if (eligibility.error) return json({ error: "Recovery unavailable" }, 503);
    if (typeof eligibility.data === "string") {
      const client = createContextClient({ env });
      const result = await client.auth.resetPasswordForEmail(eligibility.data, {
        redirectTo: `${origin}/reset-password`,
      });
      // Return the same response for absent, blocked, throttled and approved accounts.
      // Do not log addresses, links or tokens, including provider error messages.
      if (result.error)
        console.warn("account_recovery_delivery_failed", result.error.code ?? "provider_error");
    }
    return json({ accepted: true });
  } catch (error) {
    return json(
      { error: error instanceof RequestFailure ? error.message : "Recovery unavailable" },
      error instanceof RequestFailure ? error.status : 503,
    );
  }
}
