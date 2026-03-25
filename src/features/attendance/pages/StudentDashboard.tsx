import { Activity, BookOpen, CalendarClock, ClipboardCheck, TrendingUp, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { AttendanceSubmissionForm } from "../components/AttendanceSubmissionForm";
import { ExportButtons } from "../components/ExportButtons";
import { RotatingSessionDisplay } from "../components/RotatingSessionDisplay";
import { StatCard } from "../components/StatCard";
import { SubjectProgressCard } from "../components/SubjectProgressCard";
import { AttendanceTrendChart } from "../components/charts/AttendanceTrendChart";
import { AttendanceStatusChart } from "../components/charts/AttendanceStatusChart";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import type { AttendanceRecord } from "../types";
import { formatDateTime } from "../utils/rotatingSession";

export const StudentDashboard = () => {
  const { loading, error, metrics, records, sessions, trendPoints, subjectMetrics, refetch } =
    useAttendanceDashboardData("student");

  // Calculate absence rate
  const absenceRate = 100 - metrics.attendanceRate;

  // Get top performing subjects
  const topSubjects = subjectMetrics
    .sort((a, b) => b.attendanceRate - a.attendanceRate)
    .slice(0, 3);

  // Warning if attendance is low
  const isLowAttendance = metrics.attendanceRate < 70;

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

      {/* Low attendance warning */}
      {isLowAttendance && (
        <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle>تنبيه معدل الحضور</AlertTitle>
          <AlertDescription>
            معدل حضورك الحالي {metrics.attendanceRate.toFixed(1)}% منخفض. يُنصح بحضور المزيد من الجلسات لتحسين أدائك.
          </AlertDescription>
        </Alert>
      )}

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
          className={metrics.attendanceRate >= 70 ? "border-green-500/50" : "border-yellow-500/50"}
        />
        <StatCard
          title="معدل الغياب"
          value={`${absenceRate.toFixed(1)}%`}
          description="نسبة الغياب"
          icon={ClipboardCheck}
          className={absenceRate > 30 ? "border-red-500/50" : ""}
        />
      </div>

      {/* Top performing subjects */}
      {topSubjects.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            أفضل المواد في الحضور
          </h3>
          <div className="flex flex-wrap gap-2">
            {topSubjects.map((subject) => (
              <div
                key={subject.subjectName}
                className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm"
              >
                <span className="font-medium">{subject.subjectName}</span>
                <span className="text-muted-foreground">
                  {subject.attendanceRate.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RotatingSessionDisplay sessions={sessions} />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* M8: pass refetch so the list updates immediately after successful submission */}
        <AttendanceSubmissionForm sessions={sessions} onSubmitSuccess={refetch} />
        <AttendanceTrendChart points={trendPoints} />
      </div>

      {/* Attendance by subject chart */}
      <div className="grid gap-4 xl:grid-cols-2">
        <AttendanceStatusChart records={records} />
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-lg font-semibold">تفاصيل المواد</h3>
          {subjectMetrics.length > 0 ? (
            <div className="space-y-3">
              {subjectMetrics.map((subject) => (
                <SubjectProgressCard key={subject.subjectName} metric={subject} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد بيانات متاحة</p>
          )}
        </div>
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
