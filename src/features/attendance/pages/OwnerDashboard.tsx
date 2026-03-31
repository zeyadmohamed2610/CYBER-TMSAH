import { useState } from "react";
import { Activity, BookOpenCheck, Clock3, Users } from "lucide-react";
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
        <div className="w-full overflow-x-auto pb-2 custom-scrollbar mb-4 border-b border-white/10">
          <TabsList className="flex h-auto w-max min-w-full justify-start gap-2 bg-transparent p-0">
            <TabsTrigger className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl" value="lectures">المحاضرات</TabsTrigger>
            <TabsTrigger className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl" value="schedule">الجدول</TabsTrigger>
            <TabsTrigger className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl" value="materials">المواد</TabsTrigger>
            <TabsTrigger className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl" value="users">المستخدمين</TabsTrigger>
            <TabsTrigger className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl" value="tas">المعيدين</TabsTrigger>
            <TabsTrigger className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl" value="devices">الأجهزة</TabsTrigger>
            <TabsTrigger className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl" value="manual-attendance">تسجيل يدوي</TabsTrigger>
            <TabsTrigger className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl" value="notifications">الإشعارات</TabsTrigger>
            <TabsTrigger className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary px-4 py-2 rounded-xl" value="logs">السجلات</TabsTrigger>
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
