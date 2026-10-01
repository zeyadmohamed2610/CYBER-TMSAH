import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  BookOpenCheck,
  ChevronDown,
  Clock3,
  Users,
  GraduationCap,
  Inbox,
  Wrench,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceRecordsPanel } from "../components/AttendanceRecordsPanel";
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

interface CategoryGroup {
  id: string;
  label: string;
  tabKeys?: string[];
}

export const OwnerDashboard = () => {
  const { role, fullName } = useAttendanceAuth();
  const isOwner = role === "owner";
  const isCoordinator = role === "coordinator";

  const { error, metrics } = useAttendanceDashboardData(isOwner ? "owner" : "coordinator");
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultTab = isOwner ? "requests" : "schedule";
  const activeTab =
    searchParams.get("tab") ||
    sessionStorage.getItem("cyber_owner_active_tab") ||
    defaultTab;

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [pendingFixesCount, setPendingFixesCount] = useState<number>(0);
  const [facultyCount, setFacultyCount] = useState<number>(0);

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
      sessionStorage.setItem("cyber_owner_active_tab", tab);
    } catch {
      // ignore
    }
    setSearchParams({ tab });
  };

  const ALL_TABS = [
    ...(isOwner
      ? [
          { value: "requests", label: "الطلبات", category: "system" },
          { value: "coordinators", label: "رؤساء الأقسام", category: "users" },
          { value: "devices", label: "الأجهزة", category: "system" },
        ]
      : []),
    { value: "schedule", label: "الجدول", category: "academic" },
    { value: "departments", label: "الأقسام والمواد", category: "academic" },
    { value: "doctors", label: "الدكاترة", category: "users" },
    { value: "tas", label: "المعيدين", category: "users" },
    { value: "students", label: "الطلاب", category: "users" },
    { value: "fixes", label: "إصلاحات", category: "system" },
    { value: "manual-attendance", label: "تسجيل يدوي", category: "attendance" },
    { value: "attendance-records", label: "سجلات الحضور", category: "attendance" },
  ];

  const CATEGORIES: CategoryGroup[] = [
    { id: "all", label: "الكل" },
    {
      id: "users",
      label: "الحسابات والمستخدمين",
      tabKeys: isOwner
        ? ["students", "tas", "doctors", "coordinators"]
        : ["students", "tas", "doctors"],
    },
    { id: "academic", label: "الجداول والأقسام", tabKeys: ["schedule", "departments"] },
    { id: "attendance", label: "عمليات الحضور", tabKeys: ["manual-attendance", "attendance-records"] },
    {
      id: "system",
      label: "الطلبات والنظام",
      tabKeys: isOwner ? ["requests", "fixes", "devices"] : ["fixes"],
    },
  ];

  const visibleTabs =
    activeCategory === "all" ? ALL_TABS : ALL_TABS.filter((t) => t.category === activeCategory);

  const roleBadgeLabel = isOwner ? "الأونر" : isCoordinator ? "منسق البرنامج" : role;
  const roleBadgeColor = isOwner
    ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
    : "bg-blue-600/20 text-blue-300 border-blue-500/40";

  return (
    <div className="space-y-5" dir="rtl">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>خطأ في قاعدة البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="الطلاب" value={metrics.totalStudents} description="مسجلين" icon={Users} />
        <StatCard title="هيئة التدريس" value={facultyCount} description="دكاترة ومعيدين" icon={GraduationCap} />
        <StatCard title="الجلسات" value={metrics.totalSessions} description="منذ البداية" icon={BookOpenCheck} />
        <StatCard title="نشطة الآن" value={metrics.activeSessions} description="جلسات مباشرة" icon={Clock3} />
        <StatCard title="الحضور" value={metrics.attendanceRate.toFixed(1) + "%"} description="الإجمالي" icon={Activity} />
        {isOwner ? (
          <div onClick={() => setActiveTab("requests")} className="cursor-pointer transition-all duration-300 hover:scale-[1.02]">
            <StatCard
              title="طلبات معلقة"
              value={pendingRequestsCount}
              description="انضمام واستعادة"
              icon={Inbox}
              className={pendingRequestsCount > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}
            />
          </div>
        ) : (
          <div onClick={() => setActiveTab("fixes")} className="cursor-pointer transition-all duration-300 hover:scale-[1.02]">
            <StatCard
              title="بلاغات معلقة"
              value={pendingFixesCount}
              description="تحتاج مراجعة"
              icon={Wrench}
              className={pendingFixesCount > 0 ? "border-orange-500/40 bg-orange-500/5" : ""}
            />
          </div>
        )}
      </div>

      {/* ── Category Filter Pills (scrollable, outside Tabs) ── */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1"
        dir="rtl"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                if (cat.tabKeys && !cat.tabKeys.includes(activeTab)) {
                  setActiveTab(cat.tabKeys[0]);
                }
              }}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border ${
                isSelected
                  ? "bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
                  : "bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/8 hover:border-white/20"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── Tabs (contains both mobile select + desktop tab list + all content) ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">

        {/* Mobile: styled dropdown selector */}
        <div className="md:hidden mb-3" dir="rtl">
          <div className="relative">
            <select
              id="dashboard-tab-select"
              name="dashboard-tab"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full appearance-none rounded-xl border border-white/10 bg-[#0c0914]/90 px-4 py-3.5 text-sm font-bold text-white outline-none cursor-pointer focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-all"
              style={{ paddingRight: "2.5rem" }}
              aria-label="اختر القسم"
            >
              {visibleTabs.map((tab) => (
                <option key={tab.value} value={tab.value} className="bg-[#120d1c] text-white font-medium">
                  {tab.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400 pointer-events-none" />
          </div>
        </div>

        {/* Desktop: horizontal scrollable tab list */}
        <div className="hidden md:block w-full overflow-x-auto pb-2 mb-4 border-b border-white/10" dir="rtl">
          <TabsList className="flex h-auto w-max min-w-full justify-start gap-1.5 bg-transparent p-0" dir="rtl">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300 data-[state=active]:border-purple-500/50 data-[state=active]:shadow-[0_0_18px_rgba(168,85,247,0.2)] border border-transparent px-4 py-2 rounded-xl font-bold transition-all text-slate-400 hover:text-white hover:bg-white/5 text-xs sm:text-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Owner-only tab panels */}
        {isOwner && (
          <>
            <TabsContent value="requests">
              <JoinRequestsPanel />
            </TabsContent>
            <TabsContent value="coordinators">
              <UserList role="coordinator" title="قائمة منسقي البرامج (رؤساء الأقسام)" />
            </TabsContent>
            <TabsContent value="devices">
              <DeviceLockPanel />
            </TabsContent>
          </>
        )}

        {/* Shared tab panels */}
        <TabsContent value="schedule">
          <QuickScheduleEditor />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentsAndSubjectsPanel />
        </TabsContent>
        <TabsContent value="doctors">
          <UserList role="doctor" title="قائمة الدكاترة" />
        </TabsContent>
        <TabsContent value="tas">
          <UserList role="ta" title="قائمة المعيدين" />
        </TabsContent>
        <TabsContent value="students">
          <UserList role="student" title="قائمة الطلاب" />
        </TabsContent>
        <TabsContent value="fixes">
          <FixesReportsPanel />
        </TabsContent>
        <TabsContent value="manual-attendance">
          <ManualAttendancePanel />
        </TabsContent>
        <TabsContent value="attendance-records">
          <AttendanceRecordsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};
