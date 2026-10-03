import { attendanceRecordService } from "@/features/attendance/services/attendanceRecordService";
import { sessionService } from "@/features/attendance/services/sessionService";
import { type AppRole } from "@/features/auth/types";
import { dashboardService } from "@/features/dashboards/services/dashboardService";
import { supabase } from "@/shared/api/supabaseClient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AttendanceRecord,
  type AttendanceTrendPoint,
  type DashboardMetrics,
  type SessionSummary,
  type SubjectAttendanceMetric,
} from "../types";

const EMPTY_METRICS: DashboardMetrics = {
  totalSessions: 0,
  totalStudents: 0,
  activeSessions: 0,
  attendanceRate: 0,
  pendingSubmissions: 0,
};

export const useAttendanceDashboardData = (role: AppRole, sectionFilter?: string[]) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [trendPoints, setTrendPoints] = useState<AttendanceTrendPoint[]>([]);
  const [subjectMetrics, setSubjectMetrics] = useState<SubjectAttendanceMetric[]>([]);
  const mountedRef = useRef(true);

  /** Core fetch — updates state silently (no loading spinner) */
  const fetchData = useCallback(async () => {
    const [metricsResult, sessionsResult, recordsResult, subjectResult] = await Promise.all([
      dashboardService.fetchDashboardMetrics(role, sectionFilter),
      sessionService.fetchSessionsByRole(role, sectionFilter),
      attendanceRecordService.fetchAttendanceRecords(role, undefined, sectionFilter),
      dashboardService.fetchSubjectMetrics(role, sectionFilter),
    ]);

    if (!mountedRef.current) return;

    const fetchedRecords = recordsResult.data ?? [];
    setMetrics(metricsResult.data ?? EMPTY_METRICS);
    setSessions(sessionsResult.data ?? []);
    setRecords(fetchedRecords);
    setTrendPoints(dashboardService.computeTrendData(fetchedRecords));
    setSubjectMetrics(subjectResult.data ?? []);

    const firstError =
      metricsResult.error ||
      sessionsResult.error ||
      recordsResult.error ||
      subjectResult.error ||
      null;
    setError(firstError);
  }, [role, sectionFilter]);

  /** Initial fetch with loading spinner */
  const initialFetch = useCallback(async () => {
    setLoading(true);
    await fetchData();
    if (mountedRef.current) setLoading(false);
  }, [fetchData]);

  // Initial load only
  useEffect(() => {
    mountedRef.current = true;
    void initialFetch();
    return () => {
      mountedRef.current = false;
    };
  }, [initialFetch]);

  // Realtime subscriptions — silent refresh, NO loading state
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-${role}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        void fetchData();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance" }, () => {
        void fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, role]);

  return {
    loading,
    error,
    metrics,
    sessions,
    records,
    trendPoints,
    subjectMetrics,
    refetch: fetchData,
  };
};
