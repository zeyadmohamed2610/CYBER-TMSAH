type HealthStatus = "ok" | "degraded" | "unhealthy";
type CheckStatus = "healthy" | "unhealthy" | "misconfigured" | "unknown";

type HealthCheckResponse = {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    database: CheckStatus;
    supabase: CheckStatus;
  };
  error?: string;
};

Deno.serve(async (req: Request) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey",
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers, status: 200 });
  }

  const checks: HealthCheckResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(performance.now() / 1000),
    environment: Deno.env.get("ENVIRONMENT") || "development",
    version: Deno.env.get("FUNCTION_VERSION") || "1.0.0",
    checks: {
      database: "unknown",
      supabase: "unknown",
    },
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      checks.checks.database = "misconfigured";
      checks.checks.supabase = "misconfigured";
      checks.status = "degraded";
    } else {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: dbError } = await supabase
        .from("subjects")
        .select("id")
        .limit(1);

      if (dbError) {
        checks.checks.database = "unhealthy";
        checks.status = "unhealthy";
      } else {
        checks.checks.database = "healthy";
      }

      const { error: authError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });

      if (authError) {
        checks.checks.supabase = "unhealthy";
        checks.status = "degraded";
      } else {
        checks.checks.supabase = "healthy";
      }
    }
  } catch (error: unknown) {
    checks.checks.database = "unhealthy";
    checks.status = "unhealthy";
    checks.error = error instanceof Error ? error.message : "Unknown health check error";
  }

  const statusCode = checks.status === "ok" ? 200 : 503;
  return new Response(JSON.stringify(checks, null, 2), {
    headers,
    status: statusCode,
  });
});