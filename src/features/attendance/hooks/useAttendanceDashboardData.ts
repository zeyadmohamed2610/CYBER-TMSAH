import { attendanceRecordService } from "@/features/attendance/services/attendanceRecordService";
import { sessionService } from "@/features/attendance/services/sessionService";
import { type AppRole } from "@/features/auth/types";
import { dashboardService } from "@/features/dashboards/services/dashboardService";
import { useLiveRefresh } from "@/shared/hooks/useLiveRefresh";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [trendPoints, setTrendPoints] = useState<AttendanceTrendPoint[]>([]);
  const [subjectMetrics, setSubjectMetrics] = useState<SubjectAttendanceMetric[]>([]);
  const mountedRef = useRef(true);
  const requestVersion = useRef(0);
  const sectionKey = JSON.stringify(sectionFilter ?? []);
  const sections = useMemo(() => JSON.parse(sectionKey) as string[], [sectionKey]);

  /** Core fetch — updates state silently (no loading spinner) */
  const fetchData = useCallback(async () => {
    const version = ++requestVersion.current;
    const [summaryResult, sessionsResult, recordsResult] = await Promise.all([
      dashboardService.fetchDashboardSnapshot(sections),
      sessionService.fetchSessionsByRole(role, sections),
      attendanceRecordService.fetchAttendanceRecords(role, undefined, sections),
    ]);

    if (!mountedRef.current || version !== requestVersion.current) return;

    if (summaryResult.data) {
      setMetrics(summaryResult.data.metrics);
      setSubjectMetrics(summaryResult.data.subjects);
      setReady(true);
    }
    if (sessionsResult.data) setSessions(sessionsResult.data);
    if (recordsResult.data) {
      setRecords(recordsResult.data);
      setTrendPoints(dashboardService.computeTrendData(recordsResult.data));
    }

    const firstError = summaryResult.error || sessionsResult.error || recordsResult.error || null;
    setError(firstError);
  }, [role, sections]);

  /** Initial fetch with loading spinner */
  const initialFetch = useCallback(async () => {
    setLoading(true);
    await fetchData();
    if (mountedRef.current) setLoading(false);
  }, [fetchData]);

  // Initial load only
  useEffect(() => {
    const versionRef = requestVersion;
    mountedRef.current = true;
    setReady(false);
    void initialFetch();
    return () => {
      mountedRef.current = false;
      versionRef.current++;
    };
  }, [initialFetch]);

  useLiveRefresh(fetchData, [
    "users",
    "user_subjects",
    "subjects",
    "lectures",
    "sessions",
    "attendance",
    "error_reports",
  ]);

  return {
    loading,
    ready,
    error,
    metrics,
    sessions,
    records,
    trendPoints,
    subjectMetrics,
    refetch: fetchData,
  };
};
