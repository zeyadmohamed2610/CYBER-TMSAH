// src/features/attendance/pages/TADashboard.tsx
// Updated: Rich tabbed dashboard for TA (Teaching Assistant) role
import { useEffect, useState, useCallback } from "react";
import {
  BookOpenCheck, Clock3, Users, BarChart2,
  ListChecks, CalendarDays, UserCheck, Info, GraduationCap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "../components/StatCard";
import { LectureManagementPanel } from "../components/LectureManagementPanel";
import { LectureDetailView } from "../components/LectureDetailView";
import { useAttendanceDashboardData } from "../hooks/useAttendanceDashboardData";
import { supabase } from "@/lib/supabaseClient";
import { useAttendanceAuth } from "../context/AttendanceAuthContext";
import { QuickScheduleEditor } from "../components/QuickScheduleEditor";
import type { Lecture } from "../types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── TA Attendance Records ──────────────────────────────────────────────────
function TAAttendanceRecords({
  subjectId,
  sections,
}: {
  subjectId: string | undefined;
  sections: string[];
}) {
  const [records, setRecords] = useState<{
    id: string;
    student_name: string;
    subject_name: string;
    submitted_at: string;
    section: string | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("attendance")
      .select("id, created_at, section, session_id, sessions(subject_id, subjects(name)), users!attendance_student_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(300);

    if (subjectId) {
      const { data: sessionIds } = await supabase
        .from("sessions").select("id").eq("subject_id", subjectId);
      if (sessionIds && sessionIds.length > 0) {
        q = q.in("session_id", sessionIds.map((s: { id: string }) => s.id));
      }
    }
    if (sections.length > 0) {
      q = q.in("section", sections);
    }

    const { data } = await q;
    const mapped = (data ?? []).map((row: Record<string, unknown>) => {
      const session = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
      const subject = session && (Array.isArray((session as Record<string, unknown>).subjects) ? ((session as Record<string, unknown>).subjects as Record<string, unknown>[])[0] : (session as Record<string, unknown>).subjects);
      const student = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        id: row.id as string,
        student_name: (student as Record<string, unknown>)?.full_name as string ?? "—",
        subject_name: (subject as Record<string, unknown>)?.name as string ?? "—",
        submitted_at: row.created_at as string,
        section: (row.section as string) ?? null,
      };
    });
    setRecords(mapped);
    setLoading(false);
  }, [subjectId, sections]);

  useEffect(() => { void load(); }, [load]);

  const filtered = search.trim()
    ? records.filter((r) =>
        r.student_name.toLowerCase().includes(search.toLowerCase()) ||
        r.subject_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.section && r.section.toLowerCase().includes(search.toLowerCase()))
      )
    : records;

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5 text-cyan-400" />
            سجلات حضور الطلاب ({records.length})
          </CardTitle>
          <input
            className="h-8 text-sm rounded-lg border border-white/10 bg-background/50 px-3 text-white placeholder:text-muted-foreground outline-none focus:border-cyan-500/50 w-48"
            placeholder="بحث باسم أو سكشن..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد سجلات حضور حتى الآن.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filtered.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{rec.student_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{rec.subject_name}</Badge>
                    {rec.section && (
                      <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-400">
                        سكشن {rec.section}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground" dir="ltr">
                      {new Date(rec.submitted_at).toLocaleString("en-GB")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── TA Info Card ──────────────────────────────────────────────────────────────
function TAInfoCard({
  subjectId,
  sections,
}: {
  subjectId: string | undefined;
  sections: string[];
}) {
  const { fullName, user } = useAttendanceAuth();
  const [subjectName, setSubjectName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userDept, setUserDept] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.email) setUserEmail(user.email);
    supabase.from("users").select("email, department").eq("auth_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          if (data.email) setUserEmail(data.email);
          if (data.department) setUserDept(data.department);
        }
      })
      .catch(() => {});
    if (subjectId) {
      supabase.from("subjects").select("name").eq("id", subjectId).maybeSingle()
        .then(({ data }) => { if (data?.name) setSubjectName(data.name); });
    }
  }, [user, subjectId]);

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="h-5 w-5 text-cyan-400" />
          بياناتي الشخصية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-background/50 p-4 space-y-1">
            <p className="text-xs text-muted-foreground">الاسم الكامل</p>
            <p className="font-bold text-white">{fullName ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-background/50 p-4 space-y-1">
            <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
            <p className="font-bold text-white text-sm" dir="ltr">{userEmail || "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-background/50 p-4 space-y-1">
            <p className="text-xs text-muted-foreground">القسم الأكاديمي</p>
            <p className="font-bold text-white">{userDept || "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-background/50 p-4 space-y-1">
            <p className="text-xs text-muted-foreground">المادة المُسندة</p>
            <p className="font-bold text-cyan-400">{subjectName || "لا يوجد"}</p>
          </div>
        </div>
        {sections.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-background/50 p-4 space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <GraduationCap className="h-3.5 w-3.5" /> السكاشن المُسندة إليك
            </p>
            <div className="flex flex-wrap gap-2">
              {sections.map((sec) => (
                <Badge key={sec} className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                  سكشن {sec}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main TADashboard ──────────────────────────────────────────────────────────
export const TADashboard = () => {
  const { user, fullName } = useAttendanceAuth();
  const [taSubjectId, setTaSubjectId] = useState<string | undefined>(undefined);
  const [taSubjectName, setTaSubjectName] = useState<string>("");
  const [taSections, setTaSections] = useState<string[]>([]);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [activeTab, setActiveTab] = useState("lectures");
  const { metrics, error } = useAttendanceDashboardData("ta", taSections);

  useEffect(() => {
    if (!user) return;
    supabase.from("users").select("subject_id, sections").eq("auth_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.subject_id) {
          setTaSubjectId(data.subject_id);
          supabase.from("subjects").select("name").eq("id", data.subject_id).maybeSingle()
            .then(({ data: subj }) => { if (subj?.name) setTaSubjectName(subj.name); });
        }
        if (Array.isArray(data?.sections) && data.sections.length > 0) {
          setTaSections(data.sections.map((s: string | number) => String(s)));
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
    <div className="space-y-6" dir="rtl">
      {fullName && (
        <p className="text-lg font-bold">
          مرحباً يا <span className="text-cyan-400">{fullName}</span>
        </p>
      )}

      {taSubjectName && (
        <Alert className="border-cyan-500/40 bg-cyan-500/5">
          <GraduationCap className="h-4 w-4 text-cyan-400" />
          <AlertTitle className="text-cyan-300">مادة السكشن: {taSubjectName}</AlertTitle>
          <AlertDescription className="text-cyan-200/70">
            يمكنك إنشاء وإدارة السكاشن لهذه المادة
            {taSections.length > 0 && ` — سكاشنك: ${taSections.join("، ")}`}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>خطأ في قاعدة البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard title="إجمالي السكاشن" value={String(metrics.totalSessions)} description="منذ البداية" icon={BookOpenCheck} />
        <StatCard title="سكاشن نشطة" value={String(metrics.activeSessions)} description="الآن" icon={Clock3} />
        <StatCard title="نسبة الحضور" value={Math.round(metrics.attendanceRate) + "%"} description="الإجمالي" icon={Users} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
        <TabsList className="flex h-auto w-full justify-start gap-2 bg-black/30 border border-white/10 p-1.5 rounded-xl flex-wrap" dir="rtl">
          <TabsTrigger value="lectures" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/40 border border-transparent px-4 py-2 rounded-lg font-bold text-sm gap-2">
            <BookOpenCheck className="h-4 w-4" /> السكاشن
          </TabsTrigger>
          <TabsTrigger value="records" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/40 border border-transparent px-4 py-2 rounded-lg font-bold text-sm gap-2">
            <ListChecks className="h-4 w-4" /> سجلات الحضور
          </TabsTrigger>
          <TabsTrigger value="schedule" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/40 border border-transparent px-4 py-2 rounded-lg font-bold text-sm gap-2">
            <CalendarDays className="h-4 w-4" /> الجدول الدراسي
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/40 border border-transparent px-4 py-2 rounded-lg font-bold text-sm gap-2">
            <BarChart2 className="h-4 w-4" /> الإحصائيات
          </TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/40 border border-transparent px-4 py-2 rounded-lg font-bold text-sm gap-2">
            <Info className="h-4 w-4" /> بياناتي
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lectures" className="mt-4">
          <LectureManagementPanel fixedSubjectId={taSubjectId} onSelectLecture={setSelectedLecture} />
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <TAAttendanceRecords subjectId={taSubjectId} sections={taSections} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <QuickScheduleEditor />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <Card className="bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart2 className="h-5 w-5 text-cyan-400" />
                إحصائيات سكاشني
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-white/10 bg-background/50 p-5 text-center space-y-2">
                  <p className="text-3xl font-black text-cyan-400">{metrics.totalSessions}</p>
                  <p className="text-xs text-muted-foreground">إجمالي السكاشن</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-background/50 p-5 text-center space-y-2">
                  <p className="text-3xl font-black text-green-400">{metrics.activeSessions}</p>
                  <p className="text-xs text-muted-foreground">سكاشن نشطة الآن</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-background/50 p-5 text-center space-y-2">
                  <p className="text-3xl font-black text-yellow-400">{Math.round(metrics.attendanceRate)}%</p>
                  <p className="text-xs text-muted-foreground">معدل الحضور الإجمالي</p>
                </div>
              </div>
              {taSections.length > 0 && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <p className="text-sm text-cyan-300 font-medium mb-2">السكاشن المُسندة:</p>
                  <div className="flex flex-wrap gap-2">
                    {taSections.map((sec) => (
                      <Badge key={sec} className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                        سكشن {sec}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <TAInfoCard subjectId={taSubjectId} sections={taSections} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
