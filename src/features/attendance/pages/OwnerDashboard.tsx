import { getFriendlyErrorMessage } from "@/lib/academicCopy";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TabsContent } from "@/components/ui/tabs";
import { DashboardWorkspace } from "../components/DashboardWorkspace";
import { AttendanceRecordsPanel } from "../components/AttendanceRecordsPanel";
import { LectureManagementPanel } from "../components/LectureManagementPanel";
import { LectureDetailView } from "../components/LectureDetailView";
import type { Lecture } from "../types";
import { QuickScheduleEditor } from "../components/QuickScheduleEditor";
import { ManualAttendancePanel } from "../components/ManualAttendancePanel";
import { StatCard } from "../components/StatCard";
import { DeviceLockPanel } from "../components/DeviceLockPanel";
import { UserList } from "../components/UserList";
import { JoinRequestsPanel } from "../components/JoinRequestsPanel";
import { DepartmentsAndSubjectsPanel } from "../components/DepartmentsAndSubjectsPanel";
import { FixesReportsPanel } from "../components/FixesReportsPanel";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { supabase } from "@/lib/supabaseClient";

export const OwnerDashboard = () => {
  const { role, fullName } = useAttendanceAuth();
  const isOwner = role === "owner";
  const isCoordinator = role === "coordinator";

  const { error, metrics } = useAttendanceDashboardData(isOwner ? "owner" : "coordinator");
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultTab = isOwner ? "requests" : "schedule";
  const requestedTab =
    searchParams.get("tab") ||
    sessionStorage.getItem(`cyber_${role}_active_tab`) ||
    defaultTab;

  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [pendingFixesCount, setPendingFixesCount] = useState<number>(0);
  const [facultyCount, setFacultyCount] = useState<number>(0);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);

  useEffect(() => {
    if (!role) return;
    let isMounted = true;
    async function loadAuxCounts() {
      try {
        const [reqs, fixes, faculty] = await Promise.all([
          supabase.from("join_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("error_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("users").select("id", { count: "exact", head: true }).in("role", ["doctor", "ta"]),
        ]);
        if (isMounted) {
          if (typeof reqs.count === "number") setPendingRequestsCount(reqs.count);
          if (typeof fixes.count === "number") setPendingFixesCount(fixes.count);
          if (typeof faculty.count === "number") setFacultyCount(faculty.count);
        }
      } catch {
        // ignore auxiliary errors
      }
    }
    loadAuxCounts();
    return () => { isMounted = false; };
  }, [role]);

  const setActiveTab = (tab: string) => {
    try {
      sessionStorage.setItem(`cyber_${role}_active_tab`, tab);
    } catch {
      // ignore
    }
    setSearchParams({ tab });
  };

  const ALL_TABS = [
    ...(isOwner
      ? [
          { value: "coordinators", label: "رؤساء الأقسام", icon: ShieldCheck, category: "users" },
        ]
      : []),
    { value: "requests", label: "الطلبات المعلقة", icon: Inbox, category: "system", badge: pendingRequestsCount, colorScheme: "amber" },
    { value: "devices", label: "أمان الأجهزة", icon: Smartphone, category: "system" },
    { value: "schedule", label: "الجدول الدراسي", icon: CalendarDays, category: "academic" },
    { value: "departments", label: "الأقسام والمواد", icon: Layers, category: "academic" },
    { value: "doctors", label: "الدكاترة", icon: GraduationCap, category: "users" },
    { value: "tas", label: "المعيدين", icon: Users, category: "users" },
    { value: "students", label: "الطلاب", icon: Users, category: "users" },
    { value: "fixes", label: "بلاغات المشاكل", icon: Wrench, category: "system", badge: pendingFixesCount, colorScheme: "rose" },
    { value: "manual-attendance", label: "تسجيل يدوي", icon: CheckCircle2, category: "attendance" },
    { value: "lectures", label: "المحاضرات", icon: BookOpen, category: "attendance" },
    { value: "attendance-records", label: "سجلات الحضور", icon: Activity, category: "attendance" },
  ];

  const activeTab = ALL_TABS.some(tab => tab.value === requestedTab) ? requestedTab : defaultTab;

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
          <span className={`self-start px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleBadgeColor}`}>
            {roleBadgeLabel}
          </span>
        </div>
      </div>

      {/* Stat Cards - Vertical grid (3 rows of 2 on phones, 6 cols on XL) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        <StatCard
          title="الطلاب"
          value={metrics.totalStudents}
          description="إجمالي المسجلين"
          icon={Users}
          colorScheme="purple"
        />
        <StatCard
          title="هيئة التدريس"
          value={facultyCount}
          description="دكاترة ومعيدين"
          icon={GraduationCap}
          colorScheme="blue"
        />
        <StatCard
          title="الجلسات"
          value={metrics.totalSessions}
          description="منذ البداية"
          icon={BookOpenCheck}
          colorScheme="cyan"
        />
        <StatCard
          title="نشطة الآن"
          value={metrics.activeSessions}
          description="جلسات مباشرة"
          icon={Clock3}
          colorScheme="emerald"
        />
        <StatCard
          title="نسبة الحضور"
          value={metrics.attendanceRate.toFixed(1) + "%"}
          description="المعدل التراكمي"
          icon={Activity}
          colorScheme="purple"
        />
        {isOwner ? (
          <StatCard
            title="طلبات معلقة"
            value={pendingRequestsCount}
            description="انضمام واستعادة"
            icon={Inbox}
            colorScheme={pendingRequestsCount > 0 ? "amber" : "default"}
            badge={pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
            onClick={() => {
              setActiveTab("requests");
            }}
          />
        ) : (
          <StatCard
            title="بلاغات معلقة"
            value={pendingFixesCount}
            description="تحتاج مراجعة"
            icon={Wrench}
            colorScheme={pendingFixesCount > 0 ? "rose" : "default"}
            badge={pendingFixesCount > 0 ? pendingFixesCount : undefined}
            onClick={() => {
              setActiveTab("fixes");
            }}
          />
        )}
      </div>

      {/* ── TABS NAVIGATION (Zero Horizontal Scroll on Mobile) ── */}
      <DashboardWorkspace value={activeTab} onValueChange={setActiveTab} items={ALL_TABS} title={isOwner ? "إدارة المنصة" : "إدارة القسم"} groups={[
        {id:'academic',label:'الدراسة'}, {id:'attendance',label:'الحضور والغياب'}, {id:'users',label:'المستخدمون'}, {id:'system',label:'الطلبات والمتابعة'},
      ]}>
        {/* Owner-only tab panels */}
        {isOwner && (
          <>
            <TabsContent value="coordinators" className="mt-4 outline-none">
              <UserList role="coordinator" title="قائمة منسقي البرامج (رؤساء الأقسام)" />
            </TabsContent>
          </>
        )}

        {/* Shared tab panels */}
        <TabsContent value="requests" className="mt-4 outline-none"><JoinRequestsPanel /></TabsContent>
        <TabsContent value="devices" className="mt-4 outline-none"><DeviceLockPanel /></TabsContent>
        <TabsContent value="schedule" className="mt-4 outline-none">
          <QuickScheduleEditor />
        </TabsContent>
        <TabsContent value="departments" className="mt-4 outline-none">
          <DepartmentsAndSubjectsPanel />
        </TabsContent>
        <TabsContent value="doctors" className="mt-4 outline-none">
          <UserList role="doctor" title="قائمة الدكاترة" />
        </TabsContent>
        <TabsContent value="tas" className="mt-4 outline-none">
          <UserList role="ta" title="قائمة المعيدين" />
        </TabsContent>
        <TabsContent value="students" className="mt-4 outline-none">
          <UserList role="student" title="قائمة الطلاب" />
        </TabsContent>
        <TabsContent value="fixes" className="mt-4 outline-none">
          <FixesReportsPanel />
        </TabsContent>
        <TabsContent value="manual-attendance" className="mt-4 outline-none">
          <ManualAttendancePanel />
        </TabsContent>
        <TabsContent value="attendance-records" className="mt-4 outline-none">
          <AttendanceRecordsPanel />
        </TabsContent>
        <TabsContent value="lectures" className="mt-4 outline-none">
          {selectedLecture ? <LectureDetailView lecture={selectedLecture} onBack={() => setSelectedLecture(null)} /> :
            <LectureManagementPanel onSelectLecture={setSelectedLecture} />}
        </TabsContent>
      </DashboardWorkspace>
    </div>
  );
};
