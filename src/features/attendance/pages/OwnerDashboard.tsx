import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GraduationCap,
  Inbox,
  Layers,
  LayoutGrid,
  Shield,
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  icon: typeof LayoutGrid;
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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
          { value: "requests", label: "الطلبات المعلقة", icon: Inbox, category: "system", badge: pendingRequestsCount, colorScheme: "amber" },
          { value: "coordinators", label: "رؤساء الأقسام", icon: ShieldCheck, category: "users" },
          { value: "devices", label: "أمان الأجهزة", icon: Smartphone, category: "system" },
        ]
      : []),
    { value: "schedule", label: "الجدول الدراسي", icon: CalendarDays, category: "academic" },
    { value: "departments", label: "الأقسام والمواد", icon: Layers, category: "academic" },
    { value: "doctors", label: "الدكاترة", icon: GraduationCap, category: "users" },
    { value: "tas", label: "المعيدين", icon: Users, category: "users" },
    { value: "students", label: "الطلاب", icon: Users, category: "users" },
    { value: "fixes", label: "بلاغات المشاكل", icon: Wrench, category: "system", badge: pendingFixesCount, colorScheme: "rose" },
    { value: "manual-attendance", label: "تسجيل يدوي", icon: CheckCircle2, category: "attendance" },
    { value: "attendance-records", label: "سجلات الحضور", icon: Activity, category: "attendance" },
  ];

  const CATEGORIES: CategoryGroup[] = [
    { id: "all", label: "الكل", icon: LayoutGrid },
    {
      id: "users",
      label: "المستخدمين",
      icon: Users,
      tabKeys: isOwner
        ? ["students", "tas", "doctors", "coordinators"]
        : ["students", "tas", "doctors"],
    },
    { id: "academic", label: "الجداول والأقسام", icon: BookOpen, tabKeys: ["schedule", "departments"] },
    { id: "attendance", label: "الحضور والغياب", icon: CalendarCheck, tabKeys: ["manual-attendance", "attendance-records"] },
    {
      id: "system",
      label: "النظام والطلبات",
      icon: Shield,
      tabKeys: isOwner ? ["requests", "fixes", "devices"] : ["fixes"],
    },
  ];

  const visibleTabs =
    activeCategory === "all" ? ALL_TABS : ALL_TABS.filter((t) => t.category === activeCategory);

  const currentTabObj = ALL_TABS.find((t) => t.value === activeTab) || ALL_TABS[0];
  const CurrentTabIcon = currentTabObj.icon;

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
              setActiveCategory("system");
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
              setActiveCategory("system");
              setActiveTab("fixes");
            }}
          />
        )}
      </div>

      {/* ── TABS NAVIGATION (Zero Horizontal Scroll on Mobile) ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full space-y-4">
        
        {/* ── MOBILE: Section Switcher Bar + Dialog (100% Vertical, No Horizontal Scroll) ── */}
        <div className="md:hidden" dir="rtl">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.15)] active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/25 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                <CurrentTabIcon className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400 font-medium">القسم المعروض حالياً</div>
                <div className="text-sm font-black text-white flex items-center gap-2">
                  <span>{currentTabObj.label}</span>
                  {currentTabObj.badge !== undefined && currentTabObj.badge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      {currentTabObj.badge}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/25 text-purple-200 border border-purple-500/40 text-xs font-bold">
              <span>تغيير القسم</span>
              <ChevronDown className="w-4 h-4 text-purple-300" />
            </div>
          </button>
        </div>

        {/* ── MOBILE MODAL: Vertical Section Picker ── */}
        <Dialog open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <DialogContent
            className="max-w-md bg-[#0a0d1e]/98 border border-purple-500/40 text-white rounded-3xl p-5 shadow-2xl backdrop-blur-2xl max-h-[85vh] overflow-y-auto"
            dir="rtl"
          >
            <DialogHeader className="text-start pb-3 border-b border-white/10">
              <DialogTitle className="text-base font-black text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                <span>اختر القسم المطلوب</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                تصفح أقسام لوحة الإدارة الأكاديمية بنقرة واحدة
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
                const CatIcon = cat.icon;
                const catTabs = ALL_TABS.filter((t) => t.category === cat.id);
                if (catTabs.length === 0) return null;

                return (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300 px-1 pt-1">
                      <CatIcon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {catTabs.map((t) => {
                        const TIcon = t.icon;
                        const isCurrent = activeTab === t.value;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => {
                              setActiveTab(t.value);
                              setIsMobileNavOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-bold transition-all ${
                              isCurrent
                                ? "bg-purple-600/30 text-white border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                                : "bg-white/[0.02] text-slate-300 border-white/[0.06] hover:bg-white/[0.06] hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <TIcon className={`w-4 h-4 ${isCurrent ? "text-purple-300" : "text-slate-400"}`} />
                              <span>{t.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {t.badge !== undefined && t.badge > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  {t.badge}
                                </span>
                              )}
                              {isCurrent && <Check className="w-4 h-4 text-purple-400 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── DESKTOP ONLY: Category Filters + TabsList (Visible on md and up) ── */}
        <div className="hidden md:block space-y-3" dir="rtl">
          {/* Category Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id;
              const CatIcon = cat.icon;
              const catBadge =
                cat.id === "system"
                  ? (isOwner ? pendingRequestsCount : 0) + pendingFixesCount
                  : 0;

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
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                    isSelected
                      ? "bg-purple-600/25 text-purple-200 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                      : "bg-white/[0.03] text-slate-400 border-white/[0.08] hover:text-white hover:bg-white/[0.07]"
                  }`}
                >
                  <CatIcon className={`h-3.5 w-3.5 ${isSelected ? "text-purple-400" : "text-slate-400"}`} />
                  <span>{cat.label}</span>
                  {catBadge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {catBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-tabs List */}
          <div className="w-full pb-2 border-b border-white/[0.08]">
            <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1.5 bg-transparent p-0">
              {visibleTabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:bg-purple-600/25 data-[state=active]:text-purple-200 data-[state=active]:border-purple-500/50 data-[state=active]:shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-transparent px-3.5 py-2 rounded-xl font-bold transition-all text-slate-400 hover:text-white hover:bg-white/[0.04] text-xs sm:text-sm flex items-center gap-2"
                  >
                    <TabIcon className="h-4 w-4 shrink-0 text-slate-400 group-data-[state=active]:text-purple-300" />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                        {tab.badge}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>

        {/* Owner-only tab panels */}
        {isOwner && (
          <>
            <TabsContent value="requests" className="mt-4 outline-none">
              <JoinRequestsPanel />
            </TabsContent>
            <TabsContent value="coordinators" className="mt-4 outline-none">
              <UserList role="coordinator" title="قائمة منسقي البرامج (رؤساء الأقسام)" />
            </TabsContent>
            <TabsContent value="devices" className="mt-4 outline-none">
              <DeviceLockPanel />
            </TabsContent>
          </>
        )}

        {/* Shared tab panels */}
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
      </Tabs>
    </div>
  );
};
