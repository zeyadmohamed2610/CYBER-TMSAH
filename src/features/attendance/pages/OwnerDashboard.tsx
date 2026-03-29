import { useState } from "react";
import { Activity, BellPlus, BookOpenCheck, Clock3, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportButtons } from "../components/ExportButtons";
import { SmartScheduleEditor } from "../components/SmartScheduleEditor";
import { LectureManagementPanel } from "../components/LectureManagementPanel";
import { LectureDetailView } from "../components/LectureDetailView";
import { MaterialsEditor } from "../components/MaterialsEditor";
import { NotificationForm } from "../components/NotificationForm";
import { StatCard } from "../components/StatCard";
import { StudentDevicesPanel } from "../components/StudentDevicesPanel";
import { SubjectManagementPanel } from "../components/SubjectManagementPanel";
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
        <p className="text-lg font-bold">
          مرحباً يا <span className="text-primary">{fullName}</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي الجلسات" value={metrics.totalSessions} description="منذ البداية" icon={BookOpenCheck} />
        <StatCard title="إجمالي الطلاب" value={metrics.totalStudents} description="مسجلين" icon={Users} />
        <StatCard title="جلسات نشطة" value={metrics.activeSessions} description="الآن" icon={Clock3} />
        <StatCard title="نسبة الحضور" value={`${metrics.attendanceRate.toFixed(1)}%`} description="الإجمالي" icon={Activity} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-9">
          <TabsTrigger value="lectures">المحاضرات</TabsTrigger>
          <TabsTrigger value="schedule">الجدول</TabsTrigger>
          <TabsTrigger value="materials">المواد</TabsTrigger>
          <TabsTrigger value="users">المستخدمين</TabsTrigger>
          <TabsTrigger value="tas">المعيدين</TabsTrigger>
          <TabsTrigger value="subjects">المواد الدراسية</TabsTrigger>
          <TabsTrigger value="devices">الأجهزة</TabsTrigger>
          <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
          <TabsTrigger value="logs">السجلات</TabsTrigger>
        </TabsList>

        <TabsContent value="lectures" className="space-y-6">
          <LectureManagementPanel onSelectLecture={setSelectedLecture} />
          <ExportButtons role="owner" />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <SmartScheduleEditor />
        </TabsContent>

        <TabsContent value="materials" className="space-y-6">
          <MaterialsEditor />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserCreationForm />
        </TabsContent>

        <TabsContent value="tas" className="space-y-6">
          <TAManagementPanel />
        </TabsContent>

        <TabsContent value="subjects" className="space-y-6">
          <SubjectManagementPanel />
        </TabsContent>

        <TabsContent value="devices" className="space-y-6">
          <StudentDevicesPanel />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationForm createdBy={fullName ?? "المدير"} />
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <SystemLogsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
};
