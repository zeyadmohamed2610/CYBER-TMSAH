import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, BookOpenCheck, ChevronDown, Clock3, GraduationCap, Stethoscope, Trash2, Users, Users2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { AttendanceRecordsPanel } from "../components/AttendanceRecordsPanel";
import { ExportButtons } from "../components/ExportButtons";
import { QuickScheduleEditor } from "../components/QuickScheduleEditor";
import { LectureManagementPanel } from "../components/LectureManagementPanel";
import { LectureDetailView } from "../components/LectureDetailView";
import { ManualAttendancePanel } from "../components/ManualAttendancePanel";
import { MaterialsEditor } from "../components/MaterialsEditor";
import { NotificationForm } from "../components/NotificationForm";
import { StatCard } from "../components/StatCard";
import { DeviceLockPanel } from "../components/DeviceLockPanel";
import { SystemLogsTable } from "../components/SystemLogsTable";
import { UserList } from "../components/UserList";
import { TAManagementPanel } from "../components/TAManagementPanel";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import type { Lecture } from "../types";

export const OwnerDashboard = () => {
  const { error, metrics } = useAttendanceDashboardData("owner");
  const { fullName } = useAttendanceAuth();
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "lectures";
  
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const TABS = [
    { value: "lectures", label: "المحاضرات" },
    { value: "schedule", label: "الجدول" },
    { value: "materials", label: "المواد" },
    { value: "students", label: "الطلاب" },
    { value: "doctors", label: "الدكاترة" },
    { value: "tas", label: "المعيديـن" },
    { value: "devices", label: "الأجهزة" },
    { value: "manual-attendance", label: "تسجيل يدوي" },
    { value: "attendance-records", label: "سجلات الحضور" },
    { value: "notifications", label: "الإشعارات" },
    { value: "logs", label: "السجلات" },
  ];

  const clearLogs = async () => {
    const { attendanceService } = await import("../services/attendanceService");
    const { error } = await attendanceService.clearSystemLogs();
    if (error) {
      alert("فشل مسح السجلات: " + error);
    } else {
      window.location.reload();
    }
  };





  if (selectedLecture) {
    return <LectureDetailView lecture={selectedLecture} onBack={() => setSelectedLecture(null)} />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>خطأ في قاعدة البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        {fullName && (
          <p className="text-lg font-bold">مرحباً يا <span className="text-primary">{fullName}</span></p>
        )}
        <div className="flex items-center gap-2">
          <ConfirmAction
            title="مسح سجلات النظام"
            description="هل تريد مسح جميع سجلات العمليات؟ لا يمكن التراجع."
            confirmLabel="مسح الآن"
            onConfirm={clearLogs}
          >
            {(trigger) => (
              <Button variant="destructive" size="sm" onClick={trigger} className="gap-2 shadow-lg shadow-destructive/20">
                <Trash2 className="h-4 w-4" /> مسح السجلات
              </Button>
            )}
          </ConfirmAction>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="الجلسات" value={metrics.totalSessions} description="منذ البداية" icon={BookOpenCheck} />
        <StatCard title="الطلاب" value={metrics.totalStudents} description="مسجلين" icon={Users} />
        <StatCard title="نشطة" value={metrics.activeSessions} description="الآن" icon={Clock3} />
        <StatCard title="الحضور" value={metrics.attendanceRate.toFixed(1) + "%"} description="الإجمالي" icon={Activity} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Mobile: dropdown select */}
        <div className="md:hidden mb-4">
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground outline-none pr-10 cursor-pointer"
              aria-label="اختر القسم"
            >
              {TABS.map((tab) => (
                <option key={tab.value} value={tab.value}>{tab.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Desktop: horizontal scrollable tabs */}
        <div className="hidden md:block w-full overflow-x-auto pb-2 custom-scrollbar mb-4 border-b border-white/10">
          <TabsList className="flex h-auto w-max min-w-full justify-start gap-2 bg-transparent p-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl"
                value={tab.value}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="lectures">
          <LectureManagementPanel onSelectLecture={setSelectedLecture} />
          <div className="mt-6"><ExportButtons role="owner" /></div>
        </TabsContent>

        <TabsContent value="schedule"><QuickScheduleEditor /></TabsContent>

        <TabsContent value="materials"><MaterialsEditor /></TabsContent>

        <TabsContent value="students">
          <UserList role="student" title="قائمة الطلاب" />
        </TabsContent>

        <TabsContent value="doctors">
          <UserList role="doctor" title="قائمة الدكاترة" />
        </TabsContent>

        <TabsContent value="tas">
          <TAManagementPanel />
        </TabsContent>

        <TabsContent value="devices"><DeviceLockPanel /></TabsContent>

        <TabsContent value="manual-attendance"><ManualAttendancePanel /></TabsContent>

        <TabsContent value="attendance-records"><AttendanceRecordsPanel /></TabsContent>

        <TabsContent value="notifications"><NotificationForm createdBy={fullName ?? "المدير"} /></TabsContent>

        <TabsContent value="logs"><SystemLogsTable /></TabsContent>
      </Tabs>
    </div>
  );
};
