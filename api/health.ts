import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const checks: Record<string, { status: "ok" | "degraded" | "down"; latencyMs?: number; error?: string }> = {
    api: { status: "ok" },
    database: { status: "down" },
    auth: { status: "down" },
  };

  let overallStatus: "ok" | "degraded" | "down" = "ok";

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const dbStart = Date.now();
    try {
      const { error } = await supabase.from("users").select("id").limit(1);
      checks.database = {
        status: error ? "degraded" : "ok",
        latencyMs: Date.now() - dbStart,
        error: error?.message,
      };
      if (error) overallStatus = "degraded";
    } catch (e) {
      checks.database = {
        status: "down",
        latencyMs: Date.now() - dbStart,
        error: e instanceof Error ? e.message : "Unknown error",
      };
      overallStatus = "degraded";
    }

    const authStart = Date.now();
    try {
      const { data, error } = await supabase.auth.getSession();
      checks.auth = {
        status: error ? "degraded" : "ok",
        latencyMs: Date.now() - authStart,
        error: error?.message,
      };
      if (error) overallStatus = "degraded";
    } catch (e) {
      checks.auth = {
        status: "down",
        latencyMs: Date.now() - authStart,
        error: e instanceof Error ? e.message : "Unknown error",
      };
      overallStatus = "degraded";
    }
  } else {
    checks.database = { status: "down", error: "Missing Supabase config" };
    checks.auth = { status: "down", error: "Missing Supabase config" };
    overallStatus = "degraded";
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.VITE_SENTRY_RELEASE || process.env.npm_package_version || "unknown",
    uptimeSeconds: process.uptime ? Math.floor(process.uptime()) : undefined,
    checks,
    latencyMs: Date.now() - startTime,
  };

  const statusCode = overallStatus === "ok" ? 200 : overallStatus === "degraded" ? 200 : 503;

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}