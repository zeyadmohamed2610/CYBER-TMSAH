const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
export async function GET(req: Request): Promise<Response> {
  if (!["GET", "HEAD"].includes(req.method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  const started = Date.now();
  const probe = async (path: string, method = "GET") => {
    if (!supabaseUrl || !publicKey) return { status: "down", error: "Service is not configured" };
    const start = Date.now();
    try {
      const response = await fetch(supabaseUrl + path, { method, headers: { apikey: publicKey }, signal: AbortSignal.timeout(5000) });
      await response.body?.cancel();
      return { status: response.ok ? "ok" : "down", latencyMs: Date.now() - start };
    } catch { return { status: "down", latencyMs: Date.now() - start }; }
  };
  const [database, auth] = await Promise.all([probe("/rest/v1/subjects?select=id&limit=1", "HEAD"), probe("/auth/v1/health")]);
  const healthy = database.status === "ok" && auth.status === "ok";
  return new Response(req.method === "HEAD" ? null : JSON.stringify({ status: healthy ? "ok" : "degraded", timestamp: new Date().toISOString(), checks: { api: { status: "ok" }, database, auth }, latencyMs: Date.now() - started }), {
    status: healthy ? 200 : 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
export const HEAD = GET;
