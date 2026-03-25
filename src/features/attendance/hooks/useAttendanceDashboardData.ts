import { useCallback, useEffect, useState } from "react";
import { attendanceService } from "../services/attendanceService";
import type {
  AttendanceRecord,
  AttendanceRole,
  AttendanceTrendPoint,
  DashboardMetrics,
  SessionSummary,
  SubjectAttendanceMetric,
} from "../types";

const EMPTY_METRICS: DashboardMetrics = {
  totalSessions: 0,
  totalStudents: 0,
  activeSessions: 0,
  attendanceRate: 0,
  pendingSubmissions: 0,
};

/** M4: Poll every 30 seconds so expired sessions update without manual refresh. */
const POLL_INTERVAL_MS = 30_000;

export const useAttendanceDashboardData = (role: AttendanceRole, userId?: string) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [trendPoints, setTrendPoints] = useState<AttendanceTrendPoint[]>([]);
  const [subjectMetrics, setSubjectMetrics] = useState<SubjectAttendanceMetric[]>([]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    // M2 fix: fetch records once, derive trend synchronously — no double network call.
    const [metricsResult, sessionsResult, recordsResult, subjectResult] = await Promise.all([
      attendanceService.fetchDashboardMetrics(role, userId),
      attendanceService.fetchSessionsByRole(role, userId),
      attendanceService.fetchAttendanceRecords(role, userId),
      attendanceService.fetchSubjectMetrics(role, userId),
    ]);

    const fetchedRecords = recordsResult.data ?? [];

    setMetrics(metricsResult.data ?? EMPTY_METRICS);
    setSessions(sessionsResult.data ?? []);
    setRecords(fetchedRecords);
    // M2: compute trend from the already-fetched records — zero extra DB calls.
    setTrendPoints(attendanceService.computeTrendData(fetchedRecords));
    setSubjectMetrics(subjectResult.data ?? []);

    const firstError =
      metricsResult.error ||
      sessionsResult.error ||
      recordsResult.error ||
      subjectResult.error ||
      null;

    setError(firstError);
    setLoading(false);
  }, [role, userId]);

  // Initial fetch
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // M4: Auto-refresh every 30s so session expiry reflects in real-time.
  useEffect(() => {
    const interval = setInterval(() => {
      void refetch();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refetch]);

  return {
    loading,
    error,
    metrics,
    sessions,
    records,
    trendPoints,
    subjectMetrics,
    refetch,
  };
};
