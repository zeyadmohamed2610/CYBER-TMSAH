import { useState } from "react";
import { Activity, BookOpenCheck, Clock3, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportButtons } from "../components/ExportButtons";
import { QuickScheduleEditor } from "../components/QuickScheduleEditor";
import { LectureManagementPanel } from "../components/LectureManagementPanel";
import { LectureDetailView } from "../components/LectureDetailView";
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
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="lectures">المحاضرات</TabsTrigger>
          <TabsTrigger value="schedule">الجدول</TabsTrigger>
          <TabsTrigger value="materials">المواد</TabsTrigger>
          <TabsTrigger value="users">المستخدمين</TabsTrigger>
          <TabsTrigger value="tas">المعيدين</TabsTrigger>
          <TabsTrigger value="devices">الأجهزة</TabsTrigger>
          <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
          <TabsTrigger value="logs">السجلات</TabsTrigger>
        </TabsList>

        <TabsContent value="lectures">
          <LectureManagementPanel onSelectLecture={setSelectedLecture} />
          <div className="mt-6"><ExportButtons role="owner" /></div>
        </TabsContent>

        <TabsContent value="schedule"><QuickScheduleEditor /></TabsContent>

        <TabsContent value="materials"><MaterialsEditor /></TabsContent>

        <TabsContent value="users"><UserCreationForm /></TabsContent>

        <TabsContent value="tas"><TAManagementPanel /></TabsContent>

        <TabsContent value="devices"><DeviceLockPanel /></TabsContent>

        <TabsContent value="notifications"><NotificationForm createdBy={fullName ?? "المدير"} /></TabsContent>

        <TabsContent value="logs"><SystemLogsTable /></TabsContent>
      </Tabs>
    </div>
  );
};
