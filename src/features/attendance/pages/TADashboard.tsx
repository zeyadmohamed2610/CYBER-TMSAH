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

export const TADashboard = () => {
  const { user } = useAttendanceAuth();
  const { metrics, error } = useAttendanceDashboardData("student");
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [taSubjectId, setTaSubjectId] = useState<string | undefined>(undefined);
  const [taSubjectName, setTaSubjectName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("id, subject_id").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.subject_id) {
          setTaSubjectId(data.subject_id);
          supabase.from("subjects").select("name").eq("id", data.subject_id).maybeSingle()
            .then(({ data: subj }) => { if (subj?.name) setTaSubjectName(subj.name); });
        }
      });
  }, [user]);

  if (selectedLecture) {
    return (
      <LectureDetailView
        lecture={selectedLecture}
        onBack={() => setSelectedLecture(null)}
        fixedSubjectId={taSubjectId}
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

      {taSubjectName && (
        <Alert>
          <AlertTitle>المادة المُسندة: {taSubjectName}</AlertTitle>
          <AlertDescription>يمكنك إنشاء وإدارة السكاشن لهذه المادة.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Sessions" value={String(metrics.totalSessions)} description="All time" icon={BarChart3} />
        <StatCard title="Active Sessions" value={String(metrics.activeSessions)} description="Right now" icon={BarChart3} />
        <StatCard title="Attendance Rate" value={`${Math.round(metrics.attendanceRate)}%`} description="Overall" icon={BarChart3} />
      </div>

      <LectureManagementPanel
        fixedSubjectId={taSubjectId}
        onSelectLecture={setSelectedLecture}
      />
    </div>
  );
};
