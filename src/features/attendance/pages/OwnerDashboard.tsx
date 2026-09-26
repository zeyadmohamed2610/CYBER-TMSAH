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

  // Pass the actual role to the data hook so metrics are scoped correctly
  const { error, metrics } = useAttendanceDashboardData(isOwner ? "owner" : "coordinator");
  const [searchParams, setSearchParams] = useSearchParams();

  // Default tab differs by role
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
    return () => {
      isMounted = false;
    };
  }, []);

  const setActiveTab = (tab: string) => {
    try {
      sessionStorage.setItem("cyber_owner_active_tab", tab);
    } catch {
      // ignore
    }
    setSearchParams({ tab });
  };

  // ── Tab definitions ─────────────────────────────────────────────────────────
  // Owner: all 11 tabs. Coordinator: 8 shared tabs (no requests, coordinators, devices).
  const ALL_TABS = [
    ...(isOwner
      ? [
          { value: "requests", label: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a", category: "system" },
          { value: "coordinators", label: "\u0631\u0624\u0633\u0627\u0621 \u0627\u0644\u0623\u0642\u0633\u0627\u0645", category: "users" },
          { value: "devices", label: "\u0627\u0644\u0623\u062c\u0647\u0632\u0629", category: "system" },
        ]
      : []),
    { value: "schedule", label: "\u0627\u0644\u062c\u062f\u0648\u0644", category: "academic" },
    { value: "departments", label: "\u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0648\u0627\u0644\u0645\u0648\u0627\u062f", category: "academic" },
    { value: "doctors", label: "\u0627\u0644\u062f\u0643\u0627\u062a\u0631\u0629", category: "users" },
    { value: "tas", label: "\u0627\u0644\u0645\u0639\u064a\u062f\u064a\u0646", category: "users" },
    { value: "students", label: "\u0627\u0644\u0637\u0644\u0627\u0628", category: "users" },
    { value: "fixes", label: "\u0625\u0635\u0644\u0627\u062d\u0627\u062a", category: "system" },
    { value: "manual-attendance", label: "\u062a\u0633\u062c\u064a\u0644 \u064a\u062f\u0648\u064a", category: "attendance" },
    { value: "attendance-records", label: "\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u062d\u0636\u0648\u0631", category: "attendance" },
  ];

  const CATEGORIES: CategoryGroup[] = [
    { id: "all", label: "\u0627\u0644\u0643\u0644" },
    {
      id: "users",
      label: "\u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u0648\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646",
      tabKeys: isOwner
        ? ["students", "tas", "doctors", "coordinators"]
        : ["students", "tas", "doctors"],
    },
    { id: "academic", label: "\u0627\u0644\u062c\u062f\u0627\u0648\u0644 \u0648\u0627\u0644\u0623\u0642\u0633\u0627\u0645", tabKeys: ["schedule", "departments"] },
    { id: "attendance", label: "\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u062d\u0636\u0648\u0631", tabKeys: ["manual-attendance", "attendance-records"] },
    {
      id: "system",
      label: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0648\u0627\u0644\u0646\u0638\u0627\u0645",
      tabKeys: isOwner ? ["requests", "fixes", "devices"] : ["fixes"],
    },
  ];

  const visibleTabs =
    activeCategory === "all" ? ALL_TABS : ALL_TABS.filter((t) => t.category === activeCategory);

  const roleBadgeLabel = isOwner ? "\u0627\u0644\u0623\u0648\u0646\u0631" : isCoordinator ? "\u0645\u0646\u0633\u0642 \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c" : role;
  const roleBadgeColor = isOwner
    ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
    : "bg-blue-600/20 text-blue-300 border-blue-500/40";

  return (
    <div className="space-y-6" dir="rtl">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>{"\u062e\u0637\u0623 \u0641\u064a \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a"}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          {fullName && (
            <p className="text-lg font-bold text-white">
              {"\u0645\u0631\u062d\u0628\u0627\u064b \u0628\u0643 \u064a\u0627"} <span className="text-purple-400">{fullName}</span>
            </p>
          )}
          <span className={`self-start px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleBadgeColor}`}>
            {roleBadgeLabel}
          </span>
        </div>
      </div>

      <div className="grid gap-3.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title={"\u0627\u0644\u0637\u0644\u0627\u0628"} value={metrics.totalStudents} description={"\u0645\u0633\u062c\u0644\u064a\u0646"} icon={Users} />
        <StatCard title={"\u0647\u064a\u0626\u0629 \u0627\u0644\u062a\u062f\u0631\u064a\u0633"} value={facultyCount} description={"\u062f\u0643\u0627\u062a\u0631\u0629 \u0648\u0645\u0639\u064a\u062f\u064a\u0646"} icon={GraduationCap} />
        <StatCard title={"\u0627\u0644\u062c\u0644\u0633\u0627\u062a"} value={metrics.totalSessions} description={"\u0645\u0646\u0630 \u0627\u0644\u0628\u062f\u0627\u064a\u0629"} icon={BookOpenCheck} />
        <StatCard title={"\u0646\u0634\u0637\u0629 \u0627\u0644\u0622\u0646"} value={metrics.activeSessions} description={"\u062c\u0644\u0633\u0627\u062a \u0645\u0628\u0627\u0634\u0631\u0629"} icon={Clock3} />
        <StatCard title={"\u0627\u0644\u062d\u0636\u0648\u0631"} value={metrics.attendanceRate.toFixed(1) + "%"} description={"\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a"} icon={Activity} />
        {isOwner ? (
          <div
            onClick={() => setActiveTab("requests")}
            className="cursor-pointer transition-all duration-300 hover:scale-[1.02]"
          >
            <StatCard
              title={"\u0637\u0644\u0628\u0627\u062a \u0645\u0639\u0644\u0642\u0629"}
              value={pendingRequestsCount}
              description={"\u0627\u0646\u0636\u0645\u0627\u0645 \u0648\u0627\u0633\u062a\u0639\u0627\u062f\u0629"}
              icon={Inbox}
              className={pendingRequestsCount > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}
            />
          </div>
        ) : (
          <div
            onClick={() => setActiveTab("fixes")}
            className="cursor-pointer transition-all duration-300 hover:scale-[1.02]"
          >
            <StatCard
              title={"\u0628\u0644\u0627\u063a\u0627\u062a \u0645\u0639\u0644\u0642\u0629"}
              value={pendingFixesCount}
              description={"\u062a\u062d\u062a\u0627\u062c \u0645\u0631\u0627\u062c\u0639\u0629"}
              icon={Wrench}
              className={pendingFixesCount > 0 ? "border-orange-500/40 bg-orange-500/5" : ""}
            />
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? "bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                    : "bg-black/30 text-slate-400 border-white/5 hover:text-white hover:bg-white/5"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="md:hidden my-3">
          <div className="relative">
            <select
              id="dashboard-tab-select"
              name="dashboard-tab"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full appearance-none rounded-xl border border-white/10 bg-card/80 px-4 py-3 text-sm font-bold text-white outline-none pr-10 cursor-pointer"
              aria-label={"\u0627\u062e\u062a\u0631 \u0627\u0644\u0642\u0633\u0645"}
            >
              {ALL_TABS.map((tab) => (
                <option key={tab.value} value={tab.value} className="bg-[#120d1c] text-white">
                  {tab.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="hidden md:block w-full overflow-x-auto pb-2 custom-scrollbar my-3 border-b border-white/10">
          <TabsList className="flex h-auto w-max min-w-full justify-start gap-2 bg-transparent p-0">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300 data-[state=active]:border-purple-500/50 data-[state=active]:shadow-[0_0_20px_rgba(168,85,247,0.25)] border border-transparent px-4 py-2 rounded-xl font-bold transition-all text-slate-300 hover:text-white hover:bg-white/5 text-xs sm:text-sm"
                value={tab.value}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Owner-only tabs — completely hidden from coordinator */}
        {isOwner && (
          <>
            <TabsContent value="requests">
              <JoinRequestsPanel />
            </TabsContent>
            <TabsContent value="coordinators">
              <UserList role="coordinator" title={"\u0642\u0627\u0626\u0645\u0629 \u0645\u0646\u0633\u0642\u064a \u0627\u0644\u0628\u0631\u0627\u0645\u062c (\u0631\u0624\u0633\u0627\u0621 \u0627\u0644\u0623\u0642\u0633\u0627\u0645)"} />
            </TabsContent>
            <TabsContent value="devices">
              <DeviceLockPanel />
            </TabsContent>
          </>
        )}

        {/* Shared tabs visible to both owner and coordinator */}
        <TabsContent value="schedule">
          <QuickScheduleEditor />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentsAndSubjectsPanel />
        </TabsContent>
        <TabsContent value="doctors">
          <UserList role="doctor" title={"\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062f\u0643\u0627\u062a\u0631\u0629"} />
        </TabsContent>
        <TabsContent value="tas">
          <UserList role="ta" title={"\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0639\u064a\u062f\u064a\u0646"} />
        </TabsContent>
        <TabsContent value="students">
          <UserList role="student" title={"\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0637\u0644\u0627\u0628"} />
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

