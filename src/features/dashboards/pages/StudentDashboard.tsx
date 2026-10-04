import { dashboardTabs } from "@/features/auth/utils/roleAccess";
import { useDashboardTab } from "../hooks/useDashboardTab";
import { LearningCenter } from "../../learning/components/LearningCenter";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { DepartmentsAndSubjectsPanel } from "../../academics/components/DepartmentsAndSubjectsPanel";
import { AttendanceRegisterPanel } from "../../attendance/components/AttendanceRegisterPanel";
import { AcademicSchedulePanel } from "../../schedule/components/AcademicSchedulePanel";
// Updated: Modern tabbed dashboard for Student role
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { TabsContent } from "@/shared/components/ui/tabs";
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CloudOff,
  History,
  QrCode,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActiveSessionsBar } from "../../attendance/components/ActiveSessionsBar";
import { AttendanceSubmissionForm } from "../../attendance/components/AttendanceSubmissionForm";
import { SubjectProgressCard } from "../../attendance/components/SubjectProgressCard";
import { useAttendanceDashboardData } from "../../attendance/hooks/useAttendanceDashboardData";
import { StudentAttendanceAccess } from "../../attendance/components/StudentAttendanceAccess";
import { GpsProvider } from "../../attendance/context/GpsContext";
import { offlineAttendanceService } from "../../attendance/services/offlineAttendanceService";
import { useAuth } from "../../auth/context/AuthContext";
import { DashboardWorkspace } from "../components/DashboardWorkspace";
import { StatCard } from "../components/StatCard";

export const StudentDashboard = () => {
  const { fullName } = useAuth();
  const { error, metrics, sessions, subjectMetrics, refetch } =
    useAttendanceDashboardData("student");

  const [activeTab, setActiveTab] = useDashboardTab("checkin", dashboardTabs("student"));
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
  const topSubjects = useMemo(
    () => [...subjectMetrics].sort((a, b) => b.attendanceRate - a.attendanceRate).slice(0, 3),
    [subjectMetrics],
  );

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
        </div>
      </div>

      {/* ── Error Alert ───────────────────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive" role="alert" aria-live="assertive">
          <AlertTitle>تعذر تحميل البيانات. أعد المحاولة.</AlertTitle>
          <AlertDescription>{getFriendlyErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {/* ── Navigation Tabs ───────────────────────────────────────────────── */}
      <DashboardWorkspace
        value={activeTab}
        onValueChange={setActiveTab}
        title="منصتي الأكاديمية"
        compactMobile
        items={[
          { value: "checkin", label: "تسجيل الحضور", shortLabel: "الحضور", icon: QrCode },
          {
            value: "records",
            label: "سجل حضوري",
            shortLabel: "السجل",
            icon: History,
          },
          {
            value: "schedule",
            label: "الجدول والامتحانات",
            shortLabel: "الجدول",
            icon: CalendarDays,
          },
          {
            value: "analytics",
            label: "المواد ونسب الحضور",
            shortLabel: "المواد",
            icon: BarChart3,
          },
          { value: "followup", label: "نتائجي وطلباتي", icon: BookOpen },
        ]}
      >
        <TabsContent aria-label="الجدول والامتحانات" value="schedule">
          <AcademicSchedulePanel />
        </TabsContent>
        {/* ── TAB 1: Check-in ─────────────────────────────────────────────── */}
        <TabsContent
          aria-label="تسجيل الحضور"
          value="checkin"
          className="space-y-6 focus-visible:outline-none"
        >
          <StudentAttendanceAccess>
            {/* Active Sessions Panel */}
            <div className="rounded-3xl glass-card p-5 sm:p-6 border border-white/10 shadow-lg">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary animate-pulse" />
                  الجلسات النشطة الآن
                </h2>
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
            <GpsProvider>
              <AttendanceSubmissionForm sessions={sessions} onSubmitSuccess={refetch} />
            </GpsProvider>
          </StudentAttendanceAccess>
        </TabsContent>

        {/* ── TAB 2: Attendance Records ───────────────────────────────────── */}
        <TabsContent
          aria-label="سجلات الحضور"
          value="records"
          className="space-y-4 focus-visible:outline-none"
        >
          <AttendanceRegisterPanel />
        </TabsContent>

        {/* ── TAB 3: Analytics & Progress ─────────────────────────────────── */}
        <TabsContent
          aria-label="المواد ونسب الحضور"
          value="analytics"
          className="space-y-6 focus-visible:outline-none"
        >
          <DepartmentsAndSubjectsPanel />
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              title="معدل الحضور العام"
              value={`${metrics.attendanceRate.toFixed(1)}%`}
              description="نسبة التزامك الكلية"
              icon={Activity}
              colorScheme="emerald"
            />
            <StatCard
              title="معدل الغياب"
              value={`${absenceRate.toFixed(1)}%`}
              description="نسبة الغياب عن المحاضرات والسكاشن"
              icon={ClipboardCheck}
              colorScheme="default"
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
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                تفاصيل المواد الدراسية والغياب
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {subjectMetrics.map((subject) => (
                  <SubjectProgressCard key={subject.subjectName} metric={subject} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="followup" aria-label="متابعة الدراسة">
          <LearningCenter />
        </TabsContent>
      </DashboardWorkspace>
    </div>
  );
};
