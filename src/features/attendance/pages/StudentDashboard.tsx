import { Activity, BookOpen, CalendarClock, ClipboardCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { AttendanceSubmissionForm } from "../components/AttendanceSubmissionForm";
import { ExportButtons } from "../components/ExportButtons";
import { RotatingSessionDisplay } from "../components/RotatingSessionDisplay";
import { StatCard } from "../components/StatCard";
import { AttendanceTrendChart } from "../components/charts/AttendanceTrendChart";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import type { AttendanceRecord } from "../types";
import { formatDateTime } from "../utils/rotatingSession";

export const StudentDashboard = () => {
  const { loading, error, metrics, records, sessions, trendPoints, refetch } =
    useAttendanceDashboardData("student");

  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      id: "subject",
      header: "المادة",
      cell: (row) => row.subjectName || "—",
    },
    {
      id: "submitted-at",
      header: "وقت التسجيل",
      cell: (row) => formatDateTime(row.submittedAt),
    },
    {
      id: "session",
      header: "معرف الجلسة",
      cell: (row) => row.sessionId.slice(0, 8) + "…",
    },
  ];

  return (
    <div className="space-y-6">
      {/* UX3 fix: use destructive variant for error alerts */}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>خطأ في الاتصال بقاعدة البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="جلساتي"
          value={metrics.totalSessions}
          description="جلسات مادتي"
          icon={BookOpen}
        />
        <StatCard
          title="الجلسات النشطة"
          value={metrics.activeSessions}
          description="جلسات تقبل الحضور الآن"
          icon={CalendarClock}
        />
        <StatCard
          title="معدل الحضور"
          value={`${metrics.attendanceRate.toFixed(1)}%`}
          description="نسبة حضوري"
          icon={Activity}
        />
        <StatCard
          title="مرات الحضور"
          value={records.length}
          description="إجمالي تسجيلات الحضور"
          icon={ClipboardCheck}
        />
      </div>

      <RotatingSessionDisplay sessions={sessions} />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* M8: pass refetch so the list updates immediately after successful submission */}
        <AttendanceSubmissionForm sessions={sessions} onSubmitSuccess={refetch} />
        <AttendanceTrendChart points={trendPoints} />
      </div>

      <DataTable
        title="سجل حضوري"
        caption={loading ? "جارٍ التحميل..." : "يمكنك فقط مشاهدة سجلك الخاص."}
        columns={columns}
        rows={records}
        getRowId={(row) => row.id}
        emptyMessage="لا توجد سجلات حضور."
      />

      <ExportButtons role="student" />
    </div>
  );
};
