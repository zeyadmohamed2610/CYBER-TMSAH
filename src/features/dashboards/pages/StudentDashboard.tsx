import { dashboardTabs } from "@/features/auth/utils/roleAccess";
import { useDashboardTab } from "../hooks/useDashboardTab";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { AttendanceRegisterPanel } from "../../attendance/components/AttendanceRegisterPanel";
import { AcademicSchedulePanel } from "../../schedule/components/AcademicSchedulePanel";
// Updated: Modern tabbed dashboard for Student role
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { TabsContent } from "@/shared/components/ui/tabs";
import { CalendarDays, CloudOff, History, QrCode, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AttendanceSubmissionForm } from "../../attendance/components/AttendanceSubmissionForm";
import { useAttendanceDashboardData } from "../../attendance/hooks/useAttendanceDashboardData";
import { StudentAttendanceAccess } from "../../attendance/components/StudentAttendanceAccess";
import { GpsProvider } from "../../attendance/context/GpsContext";
import { offlineAttendanceService } from "../../attendance/services/offlineAttendanceService";
import { useAuth } from "../../auth/context/AuthContext";
import { DashboardWorkspace } from "../components/DashboardWorkspace";

export const StudentDashboard = () => {
  const { fullName } = useAuth();
  const { error, sessions, refetch } = useAttendanceDashboardData("student");

  const [activeTab, setActiveTab] = useDashboardTab("schedule", dashboardTabs("student"));
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
        mobilePriority={["checkin", "schedule", "records"]}
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
      </DashboardWorkspace>
    </div>
  );
};
