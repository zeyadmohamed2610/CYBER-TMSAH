import { AttendanceRegisterPanel } from "../components/AttendanceRegisterPanel";
import { AcademicSchedulePanel } from '../components/AcademicSchedulePanel';
import { getFriendlyErrorMessage } from "@/lib/academicCopy";
// src/features/attendance/pages/StudentDashboard.tsx
// Updated: Modern tabbed dashboard for Student role
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Activity, AlertCircle, AlertTriangle, ClipboardCheck, CloudOff,
  TrendingUp, CheckCircle2, QrCode, History, BarChart3, ShieldCheck,
  RefreshCw, Smartphone, Sparkles, BookOpen
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { DashboardWorkspace } from "../components/DashboardWorkspace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { ActiveSessionsBar } from "../components/ActiveSessionsBar";
import { AttendanceSubmissionForm } from "../components/AttendanceSubmissionForm";
import { StatCard } from "../components/StatCard";
import { SubjectProgressCard } from "../components/SubjectProgressCard";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { useDeviceLock } from "../hooks/useDeviceLock";
import type { AttendanceRecord } from "../types";
import { formatDateTime } from "../utils/rotatingSession";
import { offlineAttendanceService } from "../services/offlineAttendanceService";

export const StudentDashboard = () => {
  const { fullName, user } = useAttendanceAuth();
  const { loading, error, metrics, records, sessions, subjectMetrics, refetch } =
    useAttendanceDashboardData("student");
  const { isDeviceLocked, lockLabel } = useDeviceLock(user?.id);

  const [activeTab, setActiveTab] = useState("checkin");
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const syncAndRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      await offlineAttendanceService.syncPending();
      setPendingCount(offlineAttendanceService.getPendingCount());
      refetch();
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  useEffect(() => {
    setPendingCount(offlineAttendanceService.getPendingCount());
    syncAndRefresh();

    const handleOnline = () => syncAndRefresh();
    window.addEventListener("online", handleOnline);

    return () => window.removeEventListener("online", handleOnline);
  }, [syncAndRefresh]);

  const absenceRate = metrics.absenceRate ?? 0;
  const topSubjects = useMemo(() =>
    [...subjectMetrics].sort((a, b) => b.attendanceRate - a.attendanceRate).slice(0, 3),
  [subjectMetrics]);
  const isCriticalAttendance = metrics.attendanceRate < 50 && (metrics.completedOpportunities ?? 0) > 0;
  const isWarningAttendance = metrics.attendanceRate >= 50 && metrics.attendanceRate < 70 && (metrics.completedOpportunities ?? 0) > 0;
  const isLowAttendance = isCriticalAttendance || isWarningAttendance;

  const columns = useMemo<DataTableColumn<AttendanceRecord>[]>(() => [
    {
      id: "subject",
      header: "المادة الدراسية",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-foreground">{row.subjectName || "—"}</span>
        </div>
      )
    },
    {
      id: "submitted-at",
      header: "وقت التسجيل",
      cell: (row) => (
        <span className="text-sm text-muted-foreground" dir="ltr">
          {formatDateTime(row.submittedAt)}
        </span>
      )
    },
    {
      id: "status",
      header: "الحالة",
      cell: () => (
        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          حاضر
        </Badge>
      )
    },
  ], []);

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Welcome & Status Top Bar ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl glass-card border border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              أهلاً بك، <span className="text-primary">{fullName || "عزيزي الطالب"}</span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            تابع حضورك وسجل في الجلسات الأكاديمية النشطة بكل موثوقية وأمان.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={syncAndRefresh}
              disabled={syncing}
              className="gap-1.5 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-xs h-8"
            >
              <CloudOff className="h-3.5 w-3.5" />
              {pendingCount} معلق (تحديث)
            </Button>
          )}

          {isDeviceLocked ? (
            <Badge variant="outline" className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 py-1 px-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              جهاز موثق ({lockLabel || "هذا الجهاز"})
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-400 py-1 px-3">
              <Smartphone className="h-3.5 w-3.5" />
              غير مقفول
            </Badge>
          )}
        </div>
      </div>

      {/* ── Error Alert ───────────────────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive" role="alert" aria-live="assertive">
          <AlertTitle>تعذر تحميل البيانات. أعد المحاولة.</AlertTitle>
          <AlertDescription>{getFriendlyErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {/* ── Attendance Warning ────────────────────────────────────────────── */}
      {isLowAttendance && (
        <Alert
          variant="default"
          className={
            isCriticalAttendance
              ? "border-red-500 bg-red-950/30 border-red-500/70 animate-pulse text-red-200"
              : "border-amber-500 bg-amber-950/30 border-amber-500/70 text-amber-200"
          }
        >
          {isCriticalAttendance ? (
            <AlertCircle className="h-5 w-5 text-red-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          )}
          <AlertTitle className="text-base font-bold">
            {isCriticalAttendance ? "تحذير أمني وأكاديمي: معدل الحضور منخفض للغاية!" : "تنبيه انخفاض نسبة الحضور"}
          </AlertTitle>
          <AlertDescription className="text-sm mt-1 leading-relaxed">
            معدل حضورك الحالي <strong>{metrics.attendanceRate.toFixed(1)}%</strong>.
            {isCriticalAttendance
              ? " تجاوزت نسبة الغياب المسموح بها ويجب مراجعة إدارة الكلية لحضور الجلسات القادمة لتجنب الحرمان."
              : " يُرجى الحرص على حضور الجلسات القادمة لتحسين تقييمك التراكمي."}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Navigation Tabs ───────────────────────────────────────────────── */}
      <DashboardWorkspace value={activeTab} onValueChange={setActiveTab} title="منصتي الأكاديمية" compactMobile items={[
          {value:'checkin',label:'تسجيل الحضور',shortLabel:'الحضور',icon:QrCode},
          {value:'records',label:'سجل حضوري',shortLabel:'السجل',icon:History,badge:records.length},
          {value:'schedule',label:'الجدول والامتحانات',shortLabel:'الجدول',icon:CalendarDays},
          {value:'analytics',label:'النسب والمقررات',shortLabel:'النسب',icon:BarChart3},
          {value:'device',label:'أمان الجهاز',shortLabel:'الجهاز',icon:ShieldCheck},
        ]}>
        <TabsContent value="schedule"><AcademicSchedulePanel /></TabsContent>
        {/* ── TAB 1: Check-in ─────────────────────────────────────────────── */}
        <TabsContent value="checkin" className="space-y-6 focus-visible:outline-none">
          {/* Active Sessions Panel */}
          <div className="rounded-3xl glass-card p-5 sm:p-6 border border-white/10 shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary animate-pulse" />
                الجلسات النشطة الآن
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-white gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                تحديث
              </Button>
            </div>
            <ActiveSessionsBar />
          </div>

          {/* Submission Form */}
          <AttendanceSubmissionForm sessions={sessions} onSubmitSuccess={refetch} />
        </TabsContent>

        {/* ── TAB 2: Attendance Records ───────────────────────────────────── */}
        <TabsContent value="records" className="space-y-4 focus-visible:outline-none">
          <AttendanceRegisterPanel />
          <DataTable
            title="سجل الحضور الأكاديمي"
            caption={loading ? "جارٍ التحميل..." : "يعرض هذا الجدول جميع المحاضرات والسكاشن التي تم إثبات حضورك فيها."}
            columns={columns}
            rows={records}
            getRowId={(row) => row.id}
            emptyMessage="لا توجد سجلات حضور مسجلة حتى الآن."
          />
        </TabsContent>

        {/* ── TAB 3: Analytics & Progress ─────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              title="معدل الحضور العام"
              value={`${metrics.attendanceRate.toFixed(1)}%`}
              description="نسبة التزامك الكلية"
              icon={Activity}
              colorScheme={metrics.attendanceRate >= 70 ? "emerald" : "amber"}
            />
            <StatCard
              title="معدل الغياب"
              value={`${absenceRate.toFixed(1)}%`}
              description="نسبة الغياب عن المحاضرات"
              icon={ClipboardCheck}
              colorScheme={absenceRate > 30 ? "rose" : "default"}
            />
          </div>

          {topSubjects.length > 0 && (
            <Card className="bg-card/70 border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  أعلى المواد التزاماً بالحضور
                </CardTitle>
                <CardDescription>المواد التي حققت فيها أعلى معدلات تواجد</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2.5">
                  {topSubjects.map((subject) => (
                    <div
                      key={subject.subjectName}
                      className="flex items-center gap-2 rounded-xl bg-background/60 border border-white/10 px-4 py-2.5 text-sm shadow-inner transition hover:border-primary/40"
                    >
                      <span className="font-semibold text-white">{subject.subjectName}</span>
                      <span className="text-primary font-bold bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg text-xs">
                        {subject.attendanceRate.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {subjectMetrics.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                تفاصيل المواد الدراسية والغياب
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {subjectMetrics.map((subject) => (
                  <SubjectProgressCard key={subject.subjectName} metric={subject} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 4: Device & Security ────────────────────────────────────── */}
        <TabsContent value="device" className="space-y-4 focus-visible:outline-none">
          <Card className="bg-card/70 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-5 w-5 text-primary" />
                حالة قفل وتوثيق الجهاز
              </CardTitle>
              <CardDescription>
                نظام الحماية يمنع تسجيل الحضور إلا من الجهاز المعتمد والمربوط بحسابك الأكاديمي.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-background/50 p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">حالة الجهاز الحالي</p>
                  <div className="flex items-center gap-2">
                    {isDeviceLocked ? (
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        موثق ومقترن بنجاح
                      </span>
                    ) : (
                      <span className="font-bold text-amber-400">غير مقترن بعد</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-background/50 p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">معرف الجهاز المقترن</p>
                  <p className="font-mono text-sm text-foreground">{lockLabel || "هذا الجهاز"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground leading-relaxed space-y-2">
                <p className="font-bold text-primary text-sm flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  سياسة الأمان ومنع التلاعب:
                </p>
                <ul className="list-disc list-inside space-y-1 marker:text-primary">
                  <li>نطلب تأكيد جهازك وموقعك للتأكد من وجودك داخل القاعة.</li>
                  <li>في حال تغيير هاتفك أو فرمتته، يرجى تقديم طلب للمشرف الأكاديمي أو منسق البرنامج لإعادة تعيين قفل الجهاز.</li>
                  <li>التسجيلات غير المتصلة بالإنترنت يتم تخزينها بأمان وتتم إرسالها تلقائياً عند عودة الاتصال.</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={syncAndRefresh}
                  disabled={syncing}
                  className="gap-2 border-white/15 hover:bg-white/5"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "جارٍ التحديث والتحديث..." : "تحديث البيانات فورياً"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </DashboardWorkspace>
    </div>
  );
};
