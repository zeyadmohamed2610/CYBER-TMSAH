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
  const { user, fullName } = useAttendanceAuth();
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
      {fullName && (
        <p className="text-lg font-bold">
          مرحباً يا <span className="text-primary">{fullName}</span> 👋
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>خطأ في قاعدة البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="اجمالي الجلسات" value={String(metrics.totalSessions)} description="منذ البداية" icon={BarChart3} />
        <StatCard title="جلسات نشطة" value={String(metrics.activeSessions)} description="الان" icon={BarChart3} />
        <StatCard title="نسبة الحضور" value={Math.round(metrics.attendanceRate) + "%"} description="الاجمالي" icon={BarChart3} />
      </div>

      <LectureManagementPanel fixedSubjectId={doctorSubjectId} onSelectLecture={setSelectedLecture} />
    </div>
  );
};
