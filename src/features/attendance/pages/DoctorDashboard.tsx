import { useEffect, useState } from "react";
import { Activity, BookOpenText, Clock3, Monitor, Smartphone } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateSessionForm } from "../components/CreateSessionForm";
import { LiveSessionPanel } from "../components/LiveSessionPanel";
import { StatCard } from "../components/StatCard";
import { AttendanceTrendChart } from "../components/charts/AttendanceTrendChart";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import { useSessionManager } from "../hooks/useSessionManager";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { supabase } from "@/lib/supabaseClient";

export const DoctorDashboard = () => {
  const { user } = useAttendanceAuth();
  const { loading, error, metrics, records, sessions, trendPoints } =
    useAttendanceDashboardData("doctor");
  const { activeSession, creating, error: sessionError, createSession, stopSession, updateDuration, refreshHash } =
    useSessionManager();

  // Fetch the doctor's own subject_id from DB
  const [doctorSubjectId, setDoctorSubjectId] = useState<string | undefined>(undefined);
  const [doctorDbId, setDoctorDbId] = useState<string | undefined>(undefined);
  const [loginSessions, setLoginSessions]     = useState<{ ip_address: string; user_agent: string; created_at: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("id, subject_id").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.subject_id) setDoctorSubjectId(data.subject_id);
        if (data?.id) {
          setDoctorDbId(data.id);
          supabase.from("login_sessions")
            .select("ip_address, user_agent, created_at")
            .eq("user_id", data.id)
            .order("created_at", { ascending: false })
            .limit(5)
            .then(({ data: sessions }) => { if (sessions) setLoginSessions(sessions); });
        }
      });

    // Log this login session (fire-and-forget)
    void supabase.rpc("log_login_session");
  }, [user]);

  return (
    <div className="space-y-6" dir="rtl">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>خطأ في قاعدة البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="جلساتي" value={metrics.totalSessions} description="جلسات مادتي" icon={BookOpenText} />
        <StatCard title="الجلسات النشطة" value={metrics.activeSessions} description="لم تنته بعد" icon={Clock3} />
        <StatCard title="معدل الحضور" value={`${metrics.attendanceRate.toFixed(1)}%`} description="الحضور في جلساتي" icon={Activity} />
      </div>

      {/* Session management section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {!activeSession ? (
          <CreateSessionForm
            fixedSubjectId={doctorSubjectId}
            onSessionCreated={createSession}
            creating={creating}
            error={sessionError}
          />
        ) : (
          <LiveSessionPanel
            session={activeSession}
            onStop={stopSession}
            onUpdateDuration={updateDuration}
            onRefreshHash={refreshHash}
          />
        )}

        {/* Login sessions / Device history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Monitor className="h-4 w-4 text-primary" />
              أجهزة تسجيل الدخول الأخيرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loginSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد جلسات مسجلة بعد.</p>
            ) : (
              <ul className="space-y-2">
                {loginSessions.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                    <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{s.ip_address ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.user_agent?.slice(0, 60) ?? "—"}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                      {new Date(s.created_at).toLocaleDateString("ar-EG")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AttendanceTrendChart points={trendPoints} />

      {loading && <p className="text-sm text-muted-foreground">جارٍ تحميل البيانات...</p>}
    </div>
  );
};
