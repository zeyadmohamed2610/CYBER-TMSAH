import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatCard } from "../components/StatCard";
import { LectureManagementPanel } from "../components/LectureManagementPanel";
import { LectureDetailView } from "../components/LectureDetailView";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import { supabase } from "@/lib/supabaseClient";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import type { Lecture } from "../types";

export const DoctorDashboard = () => {
  const { user } = useAttendanceAuth();
  const { metrics, error } = useAttendanceDashboardData("doctor");
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [doctorSubjectId, setDoctorSubjectId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("subject_id").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.subject_id) setDoctorSubjectId(data.subject_id); });
  }, [user]);

  if (selectedLecture) {
    return (
      <LectureDetailView
        lecture={selectedLecture}
        onBack={() => setSelectedLecture(null)}
        fixedSubjectId={doctorSubjectId}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Database Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Sessions"
          value={String(metrics.totalSessions)}
          description="All time"
          icon={BarChart3}
        />
        <StatCard
          label="Active Sessions"
          value={String(metrics.activeSessions)}
          description="Right now"
          icon={BarChart3}
        />
        <StatCard
          label="Attendance Rate"
          value={`${Math.round(metrics.attendanceRate)}%`}
          description="Overall"
          icon={BarChart3}
        />
      </div>

      {/* Lecture Management */}
      <LectureManagementPanel
        fixedSubjectId={doctorSubjectId}
        onSelectLecture={setSelectedLecture}
      />
    </div>
  );
};
