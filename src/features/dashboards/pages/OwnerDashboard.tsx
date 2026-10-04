import { AccountsWorkspace } from "../components/AccountsWorkspace";
import { LearningCenter } from "../../learning/components/LearningCenter";
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
  const { role, fullName } = useAuth();
  const isOwner = role === "owner";
  const isCoordinator = role === "coordinator";

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
    { value: "followup", label: "النتائج والأعذار", icon: BookOpenCheck, category: "academic" },
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

  const roleBadgeLabel = isOwner ? "مالك المنصة" : isCoordinator ? "رئيس القسم" : role;
  const roleBadgeColor = isOwner
    ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
    : "bg-blue-600/20 text-blue-300 border-blue-500/40";

  return (
    <div className="space-y-5" dir="rtl">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>تعذر تحميل البيانات. أعد المحاولة.</AlertTitle>
          <AlertDescription>{getFriendlyErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          {fullName && (
            <p className="text-lg font-bold text-white">
              مرحباً بك يا <span className="text-purple-400">{fullName}</span>
            </p>
          )}
          <span
            className={`self-start px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleBadgeColor}`}
          >
            {roleBadgeLabel}
          </span>
        </div>
      </div>

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
            <LectureDetailView lecture={selectedLecture} onBack={() => setSelectedLecture(null)} />
          ) : (
            <LectureManagementPanel onSelectLecture={setSelectedLecture} />
          )}
        </TabsContent>
        <TabsContent value="followup" aria-label="النتائج والأعذار">
          <LearningCenter />
        </TabsContent>
      </DashboardWorkspace>
    </div>
  );
};
