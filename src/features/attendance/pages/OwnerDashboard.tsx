import { useSearchParams } from "react-router-dom";
import { Activity, BookOpenCheck, ChevronDown, Clock3, Users, Wrench } from "lucide-react";
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

export const OwnerDashboard = () => {
  const { error, metrics } = useAttendanceDashboardData("owner");
  const { role, fullName } = useAttendanceAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || sessionStorage.getItem("cyber_owner_active_tab") || "requests";

  const setActiveTab = (tab: string) => {
    try {
      sessionStorage.setItem("cyber_owner_active_tab", tab);
    } catch {
      // ignore
    }
    setSearchParams({ tab });
  };

  const TABS = [
    { value: "requests", label: "🔔 الطلبات" },
    { value: "schedule", label: "الجدول" },
    { value: "departments", label: "الأقسام والمواد" },
    ...(role === "owner" ? [{ value: "coordinators", label: "رؤساء الأقسام" }] : []),
    { value: "doctors", label: "الدكاترة" },
    { value: "tas", label: "المعيدين" },
    { value: "students", label: "الطلاب" },
    { value: "fixes", label: "🛠️ إصلاحات" },
    { value: "devices", label: "الأجهزة" },
    { value: "manual-attendance", label: "تسجيل يدوي" },
    { value: "attendance-records", label: "سجلات الحضور" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>خطأ في قاعدة البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        {fullName && (
          <p className="text-lg font-bold text-white">
            مرحباً بك يا <span className="text-purple-400">{fullName}</span>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="الجلسات" value={metrics.totalSessions} description="منذ البداية" icon={BookOpenCheck} />
        <StatCard title="الطلاب" value={metrics.totalStudents} description="مسجلين" icon={Users} />
        <StatCard title="نشطة" value={metrics.activeSessions} description="الآن" icon={Clock3} />
        <StatCard title="الحضور" value={metrics.attendanceRate.toFixed(1) + "%"} description="الإجمالي" icon={Activity} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Mobile: dropdown select */}
        <div className="md:hidden mb-4">
          <div className="relative">
            <select
              id="dashboard-tab-select"
              name="dashboard-tab"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full appearance-none rounded-xl border border-white/10 bg-card/80 px-4 py-3 text-sm font-bold text-white outline-none pr-10 cursor-pointer"
              aria-label="اختر القسم"
            >
              {TABS.map((tab) => (
                <option key={tab.value} value={tab.value} className="bg-[#120d1c] text-white">
                  {tab.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Desktop: horizontal scrollable tabs */}
        <div className="hidden md:block w-full overflow-x-auto pb-2 custom-scrollbar mb-4 border-b border-white/10">
          <TabsList className="flex h-auto w-max min-w-full justify-start gap-2 bg-transparent p-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300 data-[state=active]:border-purple-500/50 data-[state=active]:shadow-[0_0_20px_rgba(168,85,247,0.25)] border border-transparent px-4 py-2 rounded-xl font-bold transition-all text-slate-300 hover:text-white hover:bg-white/5"
                value={tab.value}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="requests">
          <JoinRequestsPanel />
        </TabsContent>

        <TabsContent value="schedule">
          <QuickScheduleEditor />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentsAndSubjectsPanel />
        </TabsContent>

        {role === "owner" && (
          <TabsContent value="coordinators">
            <UserList role="coordinator" title="قائمة منسقي البرامج (رؤساء الأقسام)" />
          </TabsContent>
        )}

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

        <TabsContent value="devices">
          <DeviceLockPanel />
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
