import { useState } from "react";
import { Activity, BookOpenCheck, ChevronDown, Clock3, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { TAManagementPanel } from "../components/TAManagementPanel";
import { UserCreationForm } from "../components/UserCreationForm";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import type { Lecture } from "../types";

export const OwnerDashboard = () => {
  const { error, metrics } = useAttendanceDashboardData("owner");
  const { fullName } = useAttendanceAuth();
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [activeTab, setActiveTab] = useState("lectures");

  const TABS = [
    { value: "lectures", label: "المحاضرات" },
    { value: "schedule", label: "الجدول" },
    { value: "materials", label: "المواد" },
    { value: "users", label: "المستخدمين" },
    { value: "tas", label: "المعيدين" },
    { value: "devices", label: "الأجهزة" },
    { value: "manual-attendance", label: "تسجيل يدوي" },
    { value: "notifications", label: "الإشعارات" },
    { value: "logs", label: "السجلات" },
  ];

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

      {fullName && (
        <p className="text-lg font-bold">مرحباً يا <span className="text-primary">{fullName}</span></p>
      )}

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

        <TabsContent value="users"><UserCreationForm /></TabsContent>

        <TabsContent value="tas"><TAManagementPanel /></TabsContent>

        <TabsContent value="devices"><DeviceLockPanel /></TabsContent>

        <TabsContent value="manual-attendance"><ManualAttendancePanel /></TabsContent>

        <TabsContent value="notifications"><NotificationForm createdBy={fullName ?? "المدير"} /></TabsContent>

        <TabsContent value="logs"><SystemLogsTable /></TabsContent>
      </Tabs>
    </div>
  );
};
