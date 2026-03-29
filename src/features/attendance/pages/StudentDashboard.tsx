import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, AlertTriangle, ClipboardCheck, CloudOff, TrendingUp, Smartphone, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { ActiveSessionsBar } from "../components/ActiveSessionsBar";
import { AttendanceSubmissionForm } from "../components/AttendanceSubmissionForm";
import { StatCard } from "../components/StatCard";
import { SubjectProgressCard } from "../components/SubjectProgressCard";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import type { AttendanceRecord } from "../types";
import { formatDateTime } from "../utils/rotatingSession";
import { offlineAttendanceService } from "../services/offlineAttendanceService";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

async function computeFingerprint(): Promise<string> {
  try {
    const raw = [navigator.userAgent, navigator.language, navigator.platform, String(screen.width), String(screen.height), String(navigator.hardwareConcurrency ?? 0), Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.vendor].join("|");
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return "no-fp"; }
}

export const StudentDashboard = () => {
  const { fullName, user } = useAttendanceAuth();
  const { loading, error, metrics, records, sessions, subjectMetrics, refetch } =
    useAttendanceDashboardData("student");

  const [pendingCount, setPendingCount] = useState(0);
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);
  const [lockLabel, setLockLabel] = useState("");
  const [locking, setLocking] = useState(false);

  const syncAndRefresh = useCallback(async () => {
    await offlineAttendanceService.syncPending();
    setPendingCount(offlineAttendanceService.getPendingCount());
    refetch();
  }, [refetch]);

  useEffect(() => {
    setPendingCount(offlineAttendanceService.getPendingCount());
    syncAndRefresh();

    const handleOnline = () => syncAndRefresh();
    window.addEventListener("online", handleOnline);

    // Check device lock
    if (user) {
      supabase.from("device_locks").select("device_label").eq("student_auth_id", user.id).maybeSingle().then(({ data }) => {
        if (data) { setIsDeviceLocked(true); setLockLabel(data.device_label); }
      });
    }

    return () => window.removeEventListener("online", handleOnline);
  }, [syncAndRefresh, user]);

  const handleLockDevice = async () => {
    if (!user) return;
    setLocking(true);
    try {
      const fp = await computeFingerprint();
      const ua = navigator.userAgent;
      const label = ua.includes("Mobile") ? "هاتف محمول" : "جهاز كمبيوتر";
      const { error } = await supabase.from("device_locks").upsert({
        student_auth_id: user.id,
        device_fingerprint: fp,
        device_label: label + " - " + new Date().toLocaleDateString("ar-EG"),
      });
      if (error) throw error;
      setIsDeviceLocked(true);
      setLockLabel(label);
      toast.success("تم قفل هذا الجهاز بنجاح");
    } catch { toast.error("فشل قفل الجهاز"); }
    setLocking(false);
  };

  const absenceRate = 100 - metrics.attendanceRate;
  const topSubjects = useMemo(() =>
    [...subjectMetrics].sort((a, b) => b.attendanceRate - a.attendanceRate).slice(0, 3),
  [subjectMetrics]);
  const isCriticalAttendance = metrics.attendanceRate < 50;
  const isWarningAttendance = metrics.attendanceRate >= 50 && metrics.attendanceRate < 70;
  const isLowAttendance = isCriticalAttendance || isWarningAttendance;

  const columns: DataTableColumn<AttendanceRecord>[] = [
    { id: "subject", header: "المادة", cell: (row) => row.subjectName || "—" },
    { id: "submitted-at", header: "وقت التسجيل", cell: (row) => formatDateTime(row.submittedAt) },
    { id: "session", header: "معرف الجلسة", cell: (row) => `${row.sessionId.slice(0, 8)}…` },
  ];

  return (
    <div className="space-y-6">
      {fullName && (
        <p className="text-lg font-bold">
          مرحباً يا <span className="text-primary">{fullName}</span> 👋
        </p>
      )}

      {pendingCount > 0 && (
        <Badge variant="outline" className="gap-1.5 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <CloudOff className="h-3.5 w-3.5" />
          {pendingCount} تسجيل في انتظار المزامنة
        </Badge>
      )}

      {isDeviceLocked ? (
        <Badge variant="outline" className="gap-1.5 border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          جهازك مغلق ({lockLabel})
        </Badge>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>خطأ في الاتصال بقاعدة البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLowAttendance && (
        <Alert
          variant="default"
          className={
            isCriticalAttendance
              ? "border-red-500 bg-red-50 dark:bg-red-950/30 dark:border-red-500/70 animate-pulse"
              : "border-orange-400 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-400/70"
          }
        >
          {isCriticalAttendance ? (
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          )}
          <AlertTitle className={isCriticalAttendance ? "text-red-700 dark:text-red-300 text-base font-bold" : "text-orange-700 dark:text-orange-300 text-base font-bold"}>
            {isCriticalAttendance ? "⚠️ تحذير: معدل حضور منخفض جداً!" : "تنبيه معدل الحضور"}
          </AlertTitle>
          <AlertDescription className={isCriticalAttendance ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}>
            معدل حضورك الحالي <strong>{metrics.attendanceRate.toFixed(1)}%</strong>.
            {isCriticalAttendance ? " هذا المعدل خطير ويجب عليك حضور المزيد من الجلسات فوراً لتجنب رسوبك." : " يُنصح بحضور المزيد من الجلسات لتحسين أدائك."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="معدل الحضور" value={`${metrics.attendanceRate.toFixed(1)}%`} description="نسبة حضوري" icon={Activity} className={metrics.attendanceRate >= 70 ? "border-green-500/50" : "border-yellow-500/50"} />
        <StatCard title="معدل الغياب" value={`${absenceRate.toFixed(1)}%`} description="نسبة الغياب" icon={ClipboardCheck} className={absenceRate > 30 ? "border-red-500/50" : ""} />
      </div>

      {/* Active sessions — student picks which session to check into */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="text-lg font-bold mb-4">الجلسات النشطة الآن</h3>
        <ActiveSessionsBar />
      </div>

      {/* Manual code entry fallback */}
      <AttendanceSubmissionForm sessions={sessions} onSubmitSuccess={refetch} />

      {topSubjects.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            أفضل المواد في الحضور
          </h3>
          <div className="flex flex-wrap gap-2">
            {topSubjects.map((subject) => (
              <div key={subject.subjectName} className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm">
                <span className="font-medium">{subject.subjectName}</span>
                <span className="text-muted-foreground">{subject.attendanceRate.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {subjectMetrics.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-lg font-semibold">تفاصيل المواد</h3>
          <div className="space-y-3">
            {subjectMetrics.map((subject) => (
              <SubjectProgressCard key={subject.subjectName} metric={subject} />
            ))}
          </div>
        </div>
      )}

      <DataTable
        title="سجل حضوري"
        caption={loading ? "جارٍ التحميل..." : "يمكنك فقط مشاهدة سجلك الخاص."}
        columns={columns}
        rows={records}
        getRowId={(row) => row.id}
        emptyMessage="لا توجد سجلات حضور."
      />
    </div>
  );
};
