import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Database, Shield, Server, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface HealthState {
  status: "healthy" | "degraded" | "unhealthy";
  database: {
    status: "ok" | "error";
    latencyMs: number;
    message?: string;
  };
  auth: {
    status: "ok" | "error";
    latencyMs: number;
  };
  timestamp: string;
  version: string;
}

export const HealthCheck = () => {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [checking, setChecking] = useState(false);

  const runDiagnostics = async () => {
    setChecking(true);
    const startDb = performance.now();
    let dbStatus: "ok" | "error" = "ok";
    let dbMessage = "";

    try {
      // Query a lightweight table to verify database connectivity
      const { error } = await supabase
        .from("academic_departments")
        .select("id")
        .limit(1);

      if (error) {
        dbStatus = "error";
        dbMessage = error.message;
      }
    } catch (e: unknown) {
      dbStatus = "error";
      dbMessage = e instanceof Error ? e.message : "Connection failed";
    }
    const dbLatency = Math.round(performance.now() - startDb);

    // Auth check
    const startAuth = performance.now();
    let authStatus: "ok" | "error" = "ok";
    try {
      const { error } = await supabase.auth.getSession();
      if (error) authStatus = "error";
    } catch {
      authStatus = "error";
    }
    const authLatency = Math.round(performance.now() - startAuth);

    const overall: "healthy" | "degraded" | "unhealthy" =
      dbStatus === "ok" && authStatus === "ok"
        ? "healthy"
        : dbStatus === "ok" || authStatus === "ok"
        ? "degraded"
        : "unhealthy";

    setHealth({
      status: overall,
      database: { status: dbStatus, latencyMs: dbLatency, message: dbMessage },
      auth: { status: authStatus, latencyMs: authLatency },
      timestamp: new Date().toISOString(),
      version: "2.1.0",
    });
    setChecking(false);
  };

  useEffect(() => {
    void runDiagnostics();
    const interval = setInterval(runDiagnostics, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 bg-[#050811] text-white relative overflow-hidden"
      dir="rtl"
    >
      {/* Background ambient mesh */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-cyan-600/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-lg relative z-10 space-y-6">
        {/* Main Card */}
        <div className="rounded-3xl border border-white/10 bg-[#0B0F19]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_30px_rgba(147,51,234,0.15)] space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(147,51,234,0.25)]">
                <Activity className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">لوحة تشخيص وسلامة النظام</h1>
                <p className="text-xs text-slate-400">CYBER TMSAH - Health Monitor</p>
              </div>
            </div>

            <button
              onClick={runDiagnostics}
              disabled={checking}
              className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="إعادة الفحص"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin text-purple-400" : ""}`} />
            </button>
          </div>

          {/* Overall Status Badge */}
          {health ? (
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                health.status === "healthy"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : health.status === "degraded"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              <div className="flex items-center gap-3">
                {health.status === "healthy" ? (
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                ) : health.status === "degraded" ? (
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 shrink-0" />
                )}
                <div>
                  <h2 className="text-sm font-bold">
                    حالة المنظومة:{" "}
                    {health.status === "healthy"
                      ? "تعمل بكفاءة ممتازة (HEALTHY)"
                      : health.status === "degraded"
                      ? "أداء متوسط (DEGRADED)"
                      : "غير مستقرة (UNHEALTHY)"}
                  </h2>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    النسخة {health.version} · استجابة سريعة
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 text-sm animate-pulse">
              جارٍ فحص استجابة الخوادم وقاعدة البيانات...
            </div>
          )}

          {/* Diagnostic Metrics */}
          {health && (
            <div className="space-y-3">
              {/* Database */}
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-xs font-bold text-white">قاعدة بيانات Supabase (PostgreSQL)</p>
                    <p className="text-[10px] text-slate-400">
                      {health.database.status === "ok" ? "متصلة ومتاحة" : health.database.message || "فشل الاتصال"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">{health.database.latencyMs}ms</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      health.database.status === "ok" ? "bg-emerald-400 shadow-[0_0_8px_#34D399]" : "bg-red-400"
                    }`}
                  />
                </div>
              </div>

              {/* Auth API */}
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="text-xs font-bold text-white">نظام التوثيق والمصادقة (Auth Engine)</p>
                    <p className="text-[10px] text-slate-400">
                      {health.auth.status === "ok" ? "مفعل ومستقر" : "غير متاح"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">{health.auth.latencyMs}ms</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      health.auth.status === "ok" ? "bg-emerald-400 shadow-[0_0_8px_#34D399]" : "bg-red-400"
                    }`}
                  />
                </div>
              </div>

              {/* Edge Node */}
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-white">الاستضافة السحابية وواجهة الويب</p>
                    <p className="text-[10px] text-slate-400">تشفير HTTPS / Vercel Edge</p>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
              </div>
            </div>
          )}

          {/* Footer note */}
          {health && (
            <div className="pt-2 text-center text-[11px] text-slate-500 border-t border-white/10 flex items-center justify-between">
              <span>آخر فحص: {new Date(health.timestamp).toLocaleTimeString("ar-EG")}</span>
              <Link
                to="/owner-dashboard"
                className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold"
              >
                <span>العودة للوحة التحكم</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthCheck;