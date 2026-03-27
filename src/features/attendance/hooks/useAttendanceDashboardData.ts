import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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

/** Fallback poll interval when Realtime is unavailable (e.g. offline). */
const FALLBACK_POLL_MS = 60_000;

export const useAttendanceDashboardData = (role: AttendanceRole) => {
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

    const [metricsResult, sessionsResult, recordsResult, subjectResult] = await Promise.all([
      attendanceService.fetchDashboardMetrics(role),
      attendanceService.fetchSessionsByRole(role),
      attendanceService.fetchAttendanceRecords(role),
      attendanceService.fetchSubjectMetrics(role),
    ]);

    const fetchedRecords = recordsResult.data ?? [];

    setMetrics(metricsResult.data ?? EMPTY_METRICS);
    setSessions(sessionsResult.data ?? []);
    setRecords(fetchedRecords);
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
  }, [role]);

  // Initial fetch
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Realtime subscriptions for live updates (sessions + attendance)
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        () => { void refetch(); },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance" },
        () => { void refetch(); },
      )
      .subscribe();

    // Fallback polling if Realtime connection fails
    const fallbackTimer = setInterval(() => {
      if (channel.state !== "joined") {
        void refetch();
      }
    }, FALLBACK_POLL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallbackTimer);
    };
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
