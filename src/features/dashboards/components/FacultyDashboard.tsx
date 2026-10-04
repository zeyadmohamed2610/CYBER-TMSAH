import { DepartmentsAndSubjectsPanel } from "@/features/academics/components/DepartmentsAndSubjectsPanel";
import { AttendanceRegisterPanel } from "@/features/attendance/components/AttendanceRegisterPanel";
import { LectureDetailView } from "@/features/attendance/components/LectureDetailView";
import { LectureManagementPanel } from "@/features/attendance/components/LectureManagementPanel";
import { useAttendanceDashboardData } from "@/features/attendance/hooks/useAttendanceDashboardData";
import type { Lecture } from "@/features/attendance/types";
import { useAuth } from "@/features/auth/context/AuthContext";
import { dashboardTabs } from "@/features/auth/utils/roleAccess";
import { LearningCenter } from "@/features/learning/components/LearningCenter";
import { AcademicSchedulePanel } from "@/features/schedule/components/AcademicSchedulePanel";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { TabsContent } from "@/shared/components/ui/tabs";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { BookOpen, BookOpenCheck, CalendarDays, ListChecks } from "lucide-react";
import { useState } from "react";
import { useDashboardTab } from "../hooks/useDashboardTab";
import { DashboardWorkspace } from "./DashboardWorkspace";

export function FacultyDashboard({ role }: { role: "doctor" | "ta" }) {
  const { fullName } = useAuth();
  const { error } = useAttendanceDashboardData(role);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [activeTab, setActiveTab] = useDashboardTab("schedule", dashboardTabs(role));
  const classes = role === "doctor" ? "المحاضرات" : "السكاشن";
  if (selectedLecture)
    return <LectureDetailView lecture={selectedLecture} onBack={() => setSelectedLecture(null)} />;
  return (
    <div className="space-y-6" dir="rtl">
      {fullName && (
        <p className="text-lg font-bold">
          مرحبًا يا <span className="text-primary">{fullName}</span>
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>تعذر تحميل البيانات. أعد المحاولة.</AlertTitle>
          <AlertDescription>{getFriendlyErrorMessage(error)}</AlertDescription>
        </Alert>
      )}
      <DashboardWorkspace
        value={activeTab}
        onValueChange={setActiveTab}
        title={role === "doctor" ? "لوحة الدكتور" : "لوحة المعيد"}
        mobilePriority={["lectures", "schedule", "records", "subjects"]}
        items={[
          { value: "lectures", label: classes, icon: BookOpenCheck },
          { value: "records", label: "سجلات الحضور", icon: ListChecks },
          { value: "schedule", label: "الجدول والامتحانات", icon: CalendarDays },
          { value: "subjects", label: "المواد المسندة إليّ", shortLabel: "موادي", icon: BookOpen },
          { value: "followup", label: "الأعذار ومتابعة الطلاب", icon: BookOpenCheck },
        ]}
      >
        <TabsContent value="lectures" aria-label={classes}>
          <LectureManagementPanel onSelectLecture={setSelectedLecture} />
        </TabsContent>
        <TabsContent value="records" aria-label="سجلات الحضور">
          <AttendanceRegisterPanel />
        </TabsContent>
        <TabsContent value="schedule" aria-label="الجدول والامتحانات">
          <AcademicSchedulePanel />
        </TabsContent>
        <TabsContent value="subjects" aria-label="المواد المسندة إليّ">
          <DepartmentsAndSubjectsPanel />
        </TabsContent>
        <TabsContent value="followup" aria-label="الأعذار ومتابعة الطلاب">
          <LearningCenter />
        </TabsContent>
      </DashboardWorkspace>
    </div>
  );
}
