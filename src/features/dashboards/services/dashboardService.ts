import {
  type AttendanceRecord,
  type AttendanceTrendPoint,
  type DashboardMetrics,
  type SubjectAttendanceMetric,
} from "@/features/attendance/types";
import { type AppRole } from "@/features/auth/types";
import { formatTrendLabel } from "@/features/dashboards/utils/trends";
import { fail, ok } from "@/shared/api/result";
import { supabase } from "@/shared/api/supabaseClient";
import { type ApiResponse } from "@/shared/api/types";
export const dashboardService = {
  async fetchDashboardMetrics(
    _role: AppRole,
    sectionFilter?: string[],
  ): Promise<ApiResponse<DashboardMetrics>> {
    try {
      const { data, error } = await supabase.rpc("get_attendance_summary", {
        p_sections: sectionFilter?.length ? sectionFilter : null,
      });
      if (error) throw error;
      if (!data?.dashboard) throw new Error("تعذر تحميل إحصاءات الحضور.");
      return ok<DashboardMetrics>(data.dashboard as DashboardMetrics);
    } catch (error) {
      return fail<DashboardMetrics>("dashboardService.fetchDashboardMetrics", error);
    }
  },
  async fetchSubjectMetrics(
    _role: AppRole,
    sectionFilter?: string[],
  ): Promise<ApiResponse<SubjectAttendanceMetric[]>> {
    try {
      const { data, error } = await supabase.rpc("get_attendance_summary", {
        p_sections: sectionFilter?.length ? sectionFilter : null,
      });
      if (error) throw error;
      return ok<SubjectAttendanceMetric[]>((data?.subjects ?? []) as SubjectAttendanceMetric[]);
    } catch (error) {
      return fail<SubjectAttendanceMetric[]>("dashboardService.fetchSubjectMetrics", error);
    }
  },
  computeTrendData(records: AttendanceRecord[]): AttendanceTrendPoint[] {
    const grouped = records.reduce<Record<string, AttendanceTrendPoint>>((acc, row) => {
      const date = row.submittedAt?.slice(0, 10);
      if (!date) return acc;
      if (!acc[date]) {
        acc[date] = { date, label: formatTrendLabel(date), count: 0 };
      }
      acc[date].count += 1;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  },
};
