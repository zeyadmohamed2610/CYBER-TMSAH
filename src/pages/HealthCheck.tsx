import { useEffect, useState } from "react";

export const HealthCheck = () => {
  const [status, setStatus] = useState<{
    status: "ok" | "degraded" | "unhealthy";
    checks: { database: string; supabase: string };
    timestamp: string;
    version: string;
  } | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-check`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        setStatus({
          status: "unhealthy",
          checks: { database: "unreachable", supabase: "unreachable" },
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return (
      <div style={{ padding: "20px", textAlign: "center", direction: "rtl" }}>
        <p>جاري التحقق من الصحة...</p>
      </div>
    );
  }

  const statusColors = {
    ok: "#0d9488",
    degraded: "#f59e0b",
    unhealthy: "#ef4444",
  };

  return (
    <div
      style={{
        padding: "20px",
        textAlign: "center",
        direction: "rtl",
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      <h1
        style={{
          color: statusColors[status.status],
          marginBottom: "16px",
        }}
      >
        حالة النظام: {status.status.toUpperCase()}
      </h1>
      <div style={{ display: "flex", justifyContent: "center", gap: "24px", flexWrap: "wrap" }}>
        <div
          style={{
            padding: "12px 24px",
            borderRadius: "8px",
            background:
              status.checks.database === "healthy"
                ? "#d1fae5"
                : status.checks.database === "misconfigured"
                ? "#fef3c7"
                : "#fee2e2",
            color:
              status.checks.database === "healthy"
                ? "#065f46"
                : status.checks.database === "misconfigured"
                ? "#92400e"
                : "#991b1b",
          }}
        >
          قاعدة البيانات: {status.checks.database}
        </div>
        <div
          style={{
            padding: "12px 24px",
            borderRadius: "8px",
            background:
              status.checks.supabase === "healthy"
                ? "#d1fae5"
                : status.checks.supabase === "misconfigured"
                ? "#fef3c7"
                : "#fee2e2",
            color:
              status.checks.supabase === "healthy"
                ? "#065f46"
                : status.checks.supabase === "misconfigured"
                ? "#92400e"
                : "#991b1b",
          }}
        >
          Supabase: {status.checks.supabase}
        </div>
      </div>
      <p style={{ marginTop: "16px", color: "#64748b", fontSize: "14px" }}>
        آخر فحص: {new Date(status.timestamp).toLocaleString("ar-EG")}
      </p>
      <p style={{ color: "#94a3b8", fontSize: "12px" }}>
        الإصدار: {status.version}
      </p>
    </div>
  );
};

export default HealthCheck;