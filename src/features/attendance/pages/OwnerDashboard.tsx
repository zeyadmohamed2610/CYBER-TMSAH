import { useEffect, useState } from "react";
import { Activity, BookOpenCheck, Clock3, Monitor, Smartphone, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateSessionForm } from "../components/CreateSessionForm";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { ExportButtons } from "../components/ExportButtons";
import { LiveSessionPanel } from "../components/LiveSessionPanel";
import { OwnerLiveSessionMap } from "../components/OwnerLiveSessionMap";
import { StatCard } from "../components/StatCard";
import { StudentDevicesPanel } from "../components/StudentDevicesPanel";
import { AttendanceStatusChart } from "../components/charts/AttendanceStatusChart";
import { AttendanceTrendChart } from "../components/charts/AttendanceTrendChart";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import { useSessionManager } from "../hooks/useSessionManager";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { supabase } from "@/lib/supabaseClient";
import type { AttendanceRecord } from "../types";
import { formatDateTime } from "../utils/rotatingSession";

export const OwnerDashboard = () => {
  const { user } = useAttendanceAuth();
  const { loading, error, metrics, sessions, records, trendPoints } =
    useAttendanceDashboardData("owner");

  // Session management
  const { activeSession, creating, error: sessionError, createSession, stopSession, refreshHash } =
    useSessionManager();

  // Owner login session tracking
  useEffect(() => {
    if (user) void supabase.rpc("log_login_session");
  }, [user]);

  const attendanceCols: DataTableColumn<AttendanceRecord>[] = [
    { id: "student", header: "الطالب", cell: (r) => r.studentName || r.studentId },
    { id: "subject", header: "المادة", cell: (r) => r.subjectName || "—" },
    { id: "time", header: "وقت التسجيل", cell: (r) => formatDateTime(r.submittedAt) },
    { id: "session", header: "الجلسة", cell: (r) => <Badge variant="outline">{r.sessionId.slice(0, 8)}…</Badge> },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>خطأ في قاعدة البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي الجلسات" value={metrics.totalSessions} description="جلسات في جميع المواد" icon={BookOpenCheck} />
        <StatCard title="إجمالي الطلاب" value={metrics.totalStudents} description="مستخدمون بدور الطالب" icon={Users} />
        <StatCard title="الجلسات النشطة" value={metrics.activeSessions} description="لم تنته بعد" icon={Clock3} />
        <StatCard title="معدل الحضور" value={`${metrics.attendanceRate.toFixed(1)}%`} description="النسبة العامة" icon={Activity} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="session">إنشاء جلسة</TabsTrigger>
          <TabsTrigger value="devices">الأجهزة</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
            <AttendanceTrendChart points={trendPoints} />
            <AttendanceStatusChart records={records} />
          </div>
          <OwnerLiveSessionMap sessions={sessions} records={records} />
          <DataTable
            title="سجل الحضور الكامل"
            caption={loading ? "جارٍ التحميل..." : "آخر تسجيلات الحضور."}
            columns={attendanceCols}
            rows={records}
            getRowId={(r) => r.id}
            emptyMessage="لا توجد سجلات حضور."
          />
          <ExportButtons role="owner" />
        </TabsContent>

        {/* ── Create Session ── */}
        <TabsContent value="session" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {!activeSession ? (
              <CreateSessionForm
                onSessionCreated={createSession}
                creating={creating}
                error={sessionError}
              />
            ) : (
              <LiveSessionPanel
                session={activeSession}
                onStop={stopSession}
                onRefreshHash={refreshHash}
              />
            )}
            {/* Owner login history */}
            <OwnerLoginSessions />
          </div>
        </TabsContent>



        {/* ── Devices ── */}
        <TabsContent value="devices" className="space-y-6">
          <StudentDevicesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/** Owner's own login session history */
function OwnerLoginSessions() {
  const [sessions, setSessions] = useState<{ ip_address: string; user_agent: string; created_at: string }[]>([]);
  useEffect(() => {
    supabase.from("login_sessions").select("ip_address, user_agent, created_at")
      .order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => { if (data) setSessions(data); });
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <Monitor className="h-4 w-4 text-primary" />
        جلسات تسجيل دخول الأدمن
      </h3>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد جلسات مسجلة.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-mono text-xs">{s.ip_address ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{s.user_agent?.slice(0, 55) ?? "—"}</p>
              </div>
              <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                {new Date(s.created_at).toLocaleDateString("ar-EG")}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
