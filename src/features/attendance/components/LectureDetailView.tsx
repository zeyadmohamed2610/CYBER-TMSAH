import { useEffect, useState } from "react";
import { ArrowRight, Download, RefreshCw, Users, Clock, Hash, StopCircle, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { attendanceService } from "../services/attendanceService";
import { reportService } from "../services/reportService";
import { DataTable, type DataTableColumn } from "./DataTable";
import { LiveSessionPanel } from "./LiveSessionPanel";
import { useSessionManager } from "../hooks/useSessionManager";
import type { Lecture, LectureAttendee } from "../types";

interface Props {
  lecture: Lecture;
  onBack: () => void;
  fixedSubjectId?: string;
}

export function LectureDetailView({ lecture, onBack, fixedSubjectId }: Props) {
  const { toast } = useToast();
  const [attendees, setAttendees] = useState<LectureAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(10);
  const [sessionRadius, setSessionRadius] = useState(50);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { activeSession, creating, error, createSession, stopSession, updateDuration, refreshHash, restoreActiveSession } =
    useSessionManager();

  const load = async () => {
    setLoading(true);
    const result = await attendanceService.getLectureAttendees(lecture.id);
    if (result.error) {
      toast({ variant: "destructive", title: "خطأ", description: result.error });
    } else {
      setAttendees(result.data ?? []);
    }
    setLoading(false);
  };

  // Restore active session on mount
  useEffect(() => {
    void restoreActiveSession(lecture.id);
    // Capture GPS
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, [lecture.id, restoreActiveSession]);

  // Load attendees
  useEffect(() => { void load(); }, [lecture.id]);

  // Auto-refresh every 10 seconds when session is active
  useEffect(() => {
    if (!activeSession?.is_active) return;
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [activeSession?.is_active]);

  const handleCreateSession = async () => {
    await createSession(lecture.subject_id, sessionDuration, gpsCoords?.lat, gpsCoords?.lng, sessionRadius, lecture.id);
  };

  const handleEndLecture = async () => {
    setEnding(true);
    const result = await attendanceService.endLecture(lecture.id);
    if (result.error) {
      toast({ variant: "destructive", title: "خطأ", description: result.error });
    } else {
      toast({ title: "تم إنهاء المحاضرة", description: "تم إيقاف جميع الجلسات." });
      onBack();
    }
    setEnding(false);
  };

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    const result = await reportService.exportLecture(attendees, lecture, format);
    if (result.error) {
      toast({ variant: "destructive", title: "فشل التصدير", description: result.error });
    } else {
      toast({ title: "تم التصدير", description: `${format.toUpperCase()} downloaded.` });
    }
  };

  const columns: DataTableColumn<LectureAttendee>[] = [
    { id: "num", header: "#", cell: (_row, index) => String((index ?? 0) + 1) },
    {
      id: "name",
      header: "اسم الطالب",
      cell: (row) => <span className="font-medium">{row.student_name}</span>,
    },
    {
      id: "nid",
      header: "الرقم القومي",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.national_id ?? "\u2014"}</span>
      ),
    },
    {
      id: "code",
      header: "كود الجلسة",
      cell: (row) => (
        <Badge variant="outline" className="font-mono">{row.short_code ?? "\u2014"}</Badge>
      ),
    },
    {
      id: "time",
      header: "الوقت",
      cell: (row) => (
        <span className="text-xs text-muted-foreground" dir="ltr">
          {new Date(row.submitted_at).toLocaleString("en-GB")}
        </span>
      ),
    },
    {
      id: "ip",
      header: "عنوان IP",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {row.ip_address ?? "\u2014"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            رجوع
          </Button>
          <div>
            <h2 className="text-lg font-bold">{lecture.title}</h2>
            <p className="text-xs text-muted-foreground">
              {lecture.subject_name} — {new Date(lecture.lecture_date).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="destructive" size="sm" onClick={handleEndLecture} disabled={ending} className="gap-1">
            <StopCircle className="h-3 w-3" />
            {ending ? "جاري الإنهاء..." : "إنهاء المحاضرة"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{attendees.length}</p>
              <p className="text-xs text-muted-foreground">الحضور</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
              <Hash className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{new Set(attendees.map((a) => a.session_id)).size}</p>
              <p className="text-xs text-muted-foreground">الجلسات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Clock className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {attendees.length > 0
                  ? new Date(attendees[attendees.length - 1].submitted_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                  : "\u2014"}
              </p>
              <p className="text-xs text-muted-foreground">آخر تسجيل</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export buttons */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4" />
            تصدير الحضور
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
            <Button
              key={fmt}
              variant="outline"
              size="sm"
              onClick={() => void handleExport(fmt)}
              disabled={attendees.length === 0}
              className="gap-1"
            >
              <Download className="h-3 w-3" />
              {fmt.toUpperCase()}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Active session or create new */}
      {lecture.is_ended ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <StopCircle className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="font-bold text-lg text-foreground">تم انهاء هذه المحاضرة</p>
            <p className="text-sm text-muted-foreground">لا يمكن انشاء جلسات جديدة. يمكنك مشاهدة وتصدير بيانات الحضور.</p>
          </CardContent>
        </Card>
      ) : activeSession && activeSession.is_active ? (
        <LiveSessionPanel
          session={activeSession}
          onStop={stopSession}
          onUpdateDuration={updateDuration}
          onRefreshHash={refreshHash}
        />
      ) : (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">المدة (دقائق)</Label>
                <Input type="number" min={5} max={180} value={sessionDuration}
                  onChange={(e) => setSessionDuration(Number(e.target.value))}
                  className="h-8 text-sm" dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">نصف القطر GPS (متر)</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input type="number" min={10} max={500} value={sessionRadius}
                    onChange={(e) => setSessionRadius(Number(e.target.value))}
                    className="h-8 text-sm" dir="ltr" />
                </div>
                {gpsCoords && <p className="text-xs text-green-500">تم تحديد الموقع</p>}
              </div>
            </div>
            <Button onClick={handleCreateSession} disabled={creating} className="w-full gap-2">
              <Hash className="h-4 w-4" />
              {creating ? "جاري الإنشاء..." : "بدء جلسة الحضور"}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Attendees table */}
      <DataTable
        title={`قائمة الحضور (${attendees.length})`}
        caption={loading ? "جاري التحميل..." : attendees.length === 0 ? "لا يوجد سجلات حضور بعد." : undefined}
        columns={columns}
        rows={attendees}
        getRowId={(row) => row.attendance_id}
        emptyMessage="لا يوجد سجلات حضور"
      />
    </div>
  );
}
