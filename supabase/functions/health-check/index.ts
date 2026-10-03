import { createContextClient, resolveEnv } from "npm:@supabase/server@1.8.0/core";
import { serverEnvironment } from "../_shared/request.ts";
export async function handleHealthCheck(request: Request): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (!["GET", "HEAD"].includes(request.method))
    return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
  try {
    const env = serverEnvironment();
    const config = resolveEnv(env);
    if (config.error || !config.data)
      return new Response(
        request.method === "HEAD" ? null : JSON.stringify({ status: "degraded" }),
        { status: 503, headers },
      );
    const key = Object.values(config.data.publishableKeys)[0];
    const client = createContextClient({
      env,
      supabaseOptions: {
        global: {
          fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
        },
      },
    });
    const [database, auth] = await Promise.all([
      client.from("subjects").select("id").limit(1),
      fetch(config.data.url + "/auth/v1/health", {
        headers: { apikey: key },
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    await auth.body?.cancel();
    const healthy = !database.error && auth.ok;
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify({
            status: healthy ? "ok" : "degraded",
            checks: { database: !database.error, auth: auth.ok },
          }),
      { status: healthy ? 200 : 503, headers },
    );
  } catch {
    return new Response(request.method === "HEAD" ? null : JSON.stringify({ status: "degraded" }), {
      status: 503,
      headers,
    });
  }
}
Deno.serve(handleHealthCheck);
