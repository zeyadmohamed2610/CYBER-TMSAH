import { AccountsWorkspace } from "../components/AccountsWorkspace";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { TabsContent } from "@/shared/components/ui/tabs";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import {
  Activity,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Inbox,
  Layers,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DepartmentsAndSubjectsPanel } from "../../academics/components/DepartmentsAndSubjectsPanel";
import { AttendanceRecordsPanel } from "../../attendance/components/AttendanceRecordsPanel";
import { LectureDetailView } from "../../attendance/components/LectureDetailView";
import { LectureManagementPanel } from "../../attendance/components/LectureManagementPanel";
import { ManualAttendancePanel } from "../../attendance/components/ManualAttendancePanel";
import { useAttendanceDashboardData } from "../../attendance/hooks/useAttendanceDashboardData";
import { type Lecture } from "../../attendance/types";
import { useAuth } from "../../auth/context/AuthContext";
import { QuickScheduleEditor } from "../../schedule/components/QuickScheduleEditor";
import { DashboardWorkspace } from "../components/DashboardWorkspace";
import { StatCard } from "../components/StatCard";

export const OwnerDashboard = () => {
  const { role } = useAuth();
  const isOwner = role === "owner";

  const { error, metrics, ready } = useAttendanceDashboardData(isOwner ? "owner" : "coordinator");
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultTab = "users";
  const requestedTab = searchParams.get("tab") || defaultTab;

  const pendingRequestsCount = metrics.pendingRequests ?? 0;
  const facultyCount = metrics.facultyCount ?? 0;
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);

  const setActiveTab = (tab: string) => {
    const aliases: Record<string, string> = {
      requests: "requests",
      devices: "devices",
      fixes: "fixes",
    };
    setSearchParams(aliases[tab] ? { tab: "users", manage: aliases[tab] } : { tab });
  };

  const ALL_TABS = [
    {
      value: "users",
      label: "المستخدمون والطلبات",
      icon: Users,
      category: "users",
      badge: pendingRequestsCount,
    },
    { value: "schedule", label: "الجدول الدراسي", icon: CalendarDays, category: "academic" },
    { value: "departments", label: "الأقسام والمواد", icon: Layers, category: "academic" },
    { value: "manual-attendance", label: "تسجيل يدوي", icon: CheckCircle2, category: "attendance" },
    { value: "lectures", label: "المحاضرات", icon: BookOpen, category: "attendance" },
    { value: "attendance-records", label: "سجلات الحضور", icon: Activity, category: "attendance" },
  ];

  const legacyRoles: Record<string, string> = {
    students: "student",
    doctors: "doctor",
    tas: "ta",
    coordinators: "coordinator",
  };
  const destination =
    legacyRoles[requestedTab] && (isOwner || requestedTab !== "coordinators")
      ? "users"
      : ["requests", "devices", "fixes"].includes(requestedTab)
        ? "users"
        : requestedTab;
  const activeTab = ALL_TABS.some((tab) => tab.value === destination) ? destination : defaultTab;

  return (
    <div className="space-y-3" dir="rtl">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>تعذر تحميل البيانات. أعد المحاولة.</AlertTitle>
          <AlertDescription>{getFriendlyErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {/* Every summary remains visible without sideways scrolling. */}
      {isOwner && (
        <div
          role="region"
          aria-label="ملخص المنصة"
          aria-busy={!ready}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6 sm:gap-3"
        >
          <StatCard
            title="الطلاب"
            value={ready ? metrics.totalStudents : "—"}
            description="إجمالي المسجلين"
            icon={Users}
            colorScheme="purple"
            onClick={() => setActiveTab("students")}
          />
          <StatCard
            title="هيئة التدريس"
            value={ready ? facultyCount : "—"}
            description="دكاترة ومعيدين"
            icon={GraduationCap}
            colorScheme="blue"
          />
          <StatCard
            title="الجلسات"
            value={ready ? metrics.totalSessions : "—"}
            description="الفصل الحالي"
            icon={BookOpenCheck}
            colorScheme="cyan"
          />
          <StatCard
            title="نشطة الآن"
            value={ready ? metrics.activeSessions : "—"}
            description="جلسات مباشرة"
            icon={Clock3}
            colorScheme="emerald"
          />
          <StatCard
            title="نسبة الحضور"
            value={ready ? metrics.attendanceRate.toFixed(1) + "%" : "—"}
            description="الحصص المنتهية"
            icon={Activity}
            colorScheme="purple"
          />
          <StatCard
            title="طلبات معلقة"
            value={ready ? pendingRequestsCount : "—"}
            description="طلبات الانضمام"
            icon={Inbox}
            colorScheme={pendingRequestsCount > 0 ? "amber" : "default"}
            badge={pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
            onClick={() => {
              setActiveTab("requests");
            }}
          />
        </div>
      )}

      {/* ── TABS NAVIGATION (Zero Horizontal Scroll on Mobile) ── */}
      <DashboardWorkspace
        value={activeTab}
        onValueChange={setActiveTab}
        items={ALL_TABS}
        mobilePriority={["users", "lectures", "schedule", "attendance-records"]}
        title={isOwner ? "إدارة المنصة" : "إدارة القسم"}
        groups={[
          { id: "users", label: "المستخدمون والطلبات" },
          { id: "academic", label: "الدراسة" },
          { id: "attendance", label: "الحضور والغياب" },
        ]}
      >
        <TabsContent aria-label="المستخدمون" value="users" className="mt-4 outline-none">
          <AccountsWorkspace
            initialRole={legacyRoles[requestedTab] ?? "all"}
            pending={pendingRequestsCount}
          />
        </TabsContent>
        <TabsContent aria-label="الجدول والامتحانات" value="schedule" className="mt-4 outline-none">
          <QuickScheduleEditor />
        </TabsContent>
        <TabsContent aria-label="الأقسام والمواد" value="departments" className="mt-4 outline-none">
          <DepartmentsAndSubjectsPanel />
        </TabsContent>
        <TabsContent
          aria-label="تسجيل يدوي"
          value="manual-attendance"
          className="mt-4 outline-none"
        >
          <ManualAttendancePanel />
        </TabsContent>
        <TabsContent
          aria-label="سجلات الحضور"
          value="attendance-records"
          className="mt-4 outline-none"
        >
          <AttendanceRecordsPanel />
        </TabsContent>
        <TabsContent aria-label="الجلسات الدراسية" value="lectures" className="mt-4 outline-none">
          {selectedLecture ? (
            <LectureDetailView
              lecture={selectedLecture}
              onSelectLecture={setSelectedLecture}
              onBack={() => setSelectedLecture(null)}
            />
          ) : (
            <LectureManagementPanel onSelectLecture={setSelectedLecture} />
          )}
        </TabsContent>
      </DashboardWorkspace>
    </div>
  );
};
