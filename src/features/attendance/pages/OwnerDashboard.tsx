import { useState } from "react";
import { Activity, BookOpenCheck, Clock3, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportButtons } from "../components/ExportButtons";
import { LectureManagementPanel } from "../components/LectureManagementPanel";
import { LectureDetailView } from "../components/LectureDetailView";
import { MaterialsEditor } from "../components/MaterialsEditor";
import { ScheduleEditor } from "../components/ScheduleEditor";
import { StatCard } from "../components/StatCard";
import { StudentDevicesPanel } from "../components/StudentDevicesPanel";
import { SubjectManagementPanel } from "../components/SubjectManagementPanel";
import { SystemLogsTable } from "../components/SystemLogsTable";
import { TAManagementPanel } from "../components/TAManagementPanel";
import { UserCreationForm } from "../components/UserCreationForm";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import type { Lecture } from "../types";

export const OwnerDashboard = () => {
  const { error, metrics } = useAttendanceDashboardData("owner");
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [activeTab, setActiveTab] = useState("lectures");

  if (selectedLecture) {
    return <LectureDetailView lecture={selectedLecture} onBack={() => setSelectedLecture(null)} />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Database Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Sessions" value={metrics.totalSessions} description="All time" icon={BookOpenCheck} />
        <StatCard title="Total Students" value={metrics.totalStudents} description="Registered" icon={Users} />
        <StatCard title="Active Sessions" value={metrics.activeSessions} description="Right now" icon={Clock3} />
        <StatCard title="Attendance Rate" value={`${metrics.attendanceRate.toFixed(1)}%`} description="Overall" icon={Activity} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-8">
          <TabsTrigger value="lectures">Lectures</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="tas">TAs</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="lectures" className="space-y-6">
          <LectureManagementPanel onSelectLecture={setSelectedLecture} />
          <ExportButtons role="owner" />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <ScheduleEditor />
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

        <TabsContent value="logs" className="space-y-6">
          <SystemLogsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
};
