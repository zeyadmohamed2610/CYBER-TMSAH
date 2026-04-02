import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, RefreshCw, Users, Clock, Hash, StopCircle, PlayCircle, MapPin, History, Settings, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { attendanceService } from "../services/attendanceService";
import { reportService } from "../services/reportService";
import { DataTable, type DataTableColumn } from "./DataTable";
import { LiveSessionPanel } from "./LiveSessionPanel";
import { useSessionManager } from "../hooks/useSessionManager";
import { supabase } from "@/lib/supabaseClient";
import type { Lecture, LectureAttendee } from "../types";

interface Props {
  lecture: Lecture;
  onBack: () => void;
  fixedSubjectId?: string;
}

interface SessionDbRow {
  id: string;
  created_at: string;
  expires_at: string;
  section: string | null;
  duration_minutes: number | null;
  gps_radius: number | null;
}

interface SessionHistoryItem {
  session_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  attendee_count: number;
  section?: string | null;
  duration_minutes?: number | null;
  gps_radius?: number | null;
}

export function LectureDetailView({ lecture, onBack, fixedSubjectId }: Props) {
  const { toast } = useToast();
  const [attendees, setAttendees] = useState<LectureAttendee[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(10);
  const [sessionRadius, setSessionRadius] = useState(50);
  const [selectedSection, setSelectedSection] = useState<string>("عام");
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { activeSession, creating, error, createSession, stopSession, updateDuration, refreshHash, restoreActiveSession } =
    useSessionManager();

  const load = useCallback(async () => {
    setLoading(true);
    const result = await attendanceService.getLectureAttendees(lecture.id);
    if (result.error) {
      toast({ variant: "destructive", title: "خطأ", description: result.error });
    } else {
      setAttendees(result.data ?? []);
    }
    setLoading(false);
  }, [lecture.id, toast]);

  // Load session history for this lecture with enhanced details
  const loadSessionHistory = useCallback(async () => {
    try {
        const { data: sessions } = await supabase
        .from("sessions")
        .select("id, created_at, expires_at, section, duration_minutes, gps_radius")
        .eq("lecture_id", lecture.id)
        .order("created_at", { ascending: false });

      if (!sessions) { setSessionHistory([]); return; }

      const history: SessionHistoryItem[] = [];
      for (const s of sessions as SessionDbRow[]) {
        const { count } = await supabase
          .from("attendance")
          .select("id", { head: true, count: "exact" })
          .eq("session_id", s.id);

        history.push({
          session_id: s.id,
          created_at: s.created_at,
          expires_at: s.expires_at,
          is_active: new Date(s.expires_at).getTime() > Date.now(),
          attendee_count: count ?? 0,
          section: s.section ?? null,
          duration_minutes: s.duration_minutes ?? null,
          gps_radius: s.gps_radius ?? null,
        });
      }
      setSessionHistory(history);
    } catch {
      // silently fail
    }
  }, [lecture.id]);

  // Restore active session on mount
  useEffect(() => {
    void restoreActiveSession(lecture.id);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, [lecture.id, restoreActiveSession]);
  // Load available sections for the subject
  useEffect(() => {
    if (lecture.subject_id) {
      supabase.from("course_materials")
        .select("teaching_assistants")
        .eq("slug", lecture.subject_name.toLowerCase().replace(/\s+/g, "-"))
        .maybeSingle()
        .then(({ data }) => {
          if (data?.teaching_assistants) {
            const sections = new Set<string>(["عام"]);
            (data.teaching_assistants as string[]).forEach(ta => {
              const parts = ta.split("|");
              parts.slice(1).forEach(s => sections.add(s.trim()));
            });
            setAvailableSections(Array.from(sections));
          } else {
            setAvailableSections(["عام", "سكشن 1", "سكشن 2", "سكشن 3", "سكشن 4", "سكشن 5"]);
          }
        });
    }
  }, [lecture.subject_id, lecture.subject_name]);

  // Load attendees and session history
  useEffect(() => { void load(); void loadSessionHistory(); }, [load, loadSessionHistory]);

  // Auto-refresh every 10 seconds when session is active
  useEffect(() => {
    if (!activeSession?.is_active) return;
    const timer = setInterval(() => { void load(); void loadSessionHistory(); }, 10_000);
    return () => clearInterval(timer);
  }, [activeSession?.is_active, load, loadSessionHistory]);

  const handleToggleSession = useCallback(async (sessionId: string, activate: boolean) => {
    const expiresAt = activate 
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString() // Open for 15 mins
      : new Date().toISOString();
    
    const result = await attendanceService.updateSessionExpiry(sessionId, expiresAt);
    if (result.error) {
      toast({ variant: "destructive", title: "فشل التعديل", description: result.error });
    } else {
      toast({ title: activate ? "تم فتح الجلسة" : "تم غلق الجلسة", description: activate ? "الجلسة متاحة الآن لمدة 15 دقيقة." : "تم إيقاف استقبال الحضور لهذه الجلسة." });
      void loadSessionHistory();
    }
  }, [toast, loadSessionHistory]);

  const handleCreateSession = async () => {
    await createSession(lecture.subject_id, sessionDuration, gpsCoords?.lat, gpsCoords?.lng, sessionRadius, lecture.id, selectedSection);
    setTimeout(() => void loadSessionHistory(), 2000);
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

  const handleExportAll = async (format: "csv" | "xlsx" | "pdf") => {
    const result = await reportService.exportLecture(attendees, lecture, format);
    if (result.error) {
      toast({ variant: "destructive", title: "فشل التصدير", description: result.error });
    } else {
      toast({ title: "تم التصدير", description: "تم تصدير جميع حضور المحاضرة." });
    }
  };

  const handleExportSession = async (sessionId: string, format: "csv" | "xlsx") => {
    const sessionAttendees = attendees.filter((a) => a.session_id === sessionId);
    if (sessionAttendees.length === 0) {
      toast({ variant: "destructive", title: "لا يوجد حضور", description: "لا يوجد سجلات حضور لهذه الجلسة." });
      return;
    }
    const result = await reportService.exportLecture(sessionAttendees, { ...lecture, title: `${lecture.title} - جلسة` }, format);
    if (result.error) {
      toast({ variant: "destructive", title: "فشل التصدير", description: result.error });
    } else {
      toast({ title: "تم التصدير", description: `تم تصدير حضور الجلسة.` });
    }
  };

  const columns = useMemo<DataTableColumn<LectureAttendee>[]>(() => [
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
          {row.ip_address ?? "\u2014"}</span>
      ),
    },
  ], []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 shrink-0">
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            رجوع
          </Button>
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{lecture.title}</h2>
            <p className="text-xs text-muted-foreground truncate">
              {lecture.subject_name} — {new Date(lecture.lecture_date).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {activeSession?.section && <Badge variant="secondary" className="mr-2">قيد التنفيذ: {activeSession.section}</Badge>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { void load(); void loadSessionHistory(); }} disabled={loading} aria-label="تحديث البيانات">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <ConfirmAction
            title="إنهاء المحاضرة"
            description={`هل تريد إنهاء "${lecture.title}"؟ سيتم إيقاف جميع الجلسات النشطة.`}
            confirmLabel="إنهاء المحاضرة"
            onConfirm={handleEndLecture}
          >
            {(trigger) => (
              <Button variant="destructive" size="sm" disabled={ending} className="gap-1" onClick={trigger}>
                <StopCircle className="h-3 w-3" />
                <span className="hidden sm:inline">{ending ? "جاري الإنهاء..." : "إنهاء المحاضرة"}</span>
              </Button>
            )}
          </ConfirmAction>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{attendees.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي الحضور</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
              <Hash className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sessionHistory.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي الجلسات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Clock className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sessionHistory.filter(s => s.is_active).length}</p>
              <p className="text-xs text-muted-foreground">جلسات نشطة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Users className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sessionHistory.length > 0 ? Math.round(attendees.length / sessionHistory.length) : 0}</p>
              <p className="text-xs text-muted-foreground">متوسط الحضور/جلسة</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session History - Enhanced with detailed controls */}
      {sessionHistory.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              إدارة الجلسات ({sessionHistory.length})
              <span className="text-xs text-muted-foreground mr-auto">
                · {sessionHistory.filter(s => s.is_active).length} نشطة
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessionHistory.map((session, idx) => (
              <div key={session.session_id} className={`flex items-center justify-between gap-3 rounded-lg border p-4 transition-all ${
                session.is_active 
                  ? "bg-green-500/5 border-green-500/30" 
                  : "bg-muted/30 border-border/50"
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    session.is_active 
                      ? "bg-green-500/20 text-green-500" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {new Date(session.created_at).toLocaleString("ar-EG", { 
                          day: "numeric", 
                          month: "short", 
                          hour: "2-digit", 
                          minute: "2-digit" 
                        })}
                      </p>
                      {session.is_active && (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px]">نشطة</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {session.attendee_count} حاضر
                      </span>
                      {session.section && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {session.section}
                        </span>
                      )}
                      {session.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.duration_minutes} دقيقة
                        </span>
                      )}
                      {session.gps_radius && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {session.gps_radius}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    title="تصدير CSV" 
                    className="h-8 w-8 p-0 hover:bg-primary/10" 
                    onClick={() => void handleExportSession(session.session_id, "csv")}
                  >
                    <Download className="h-4 w-4 text-primary" />
                  </Button>
                  {session.is_active ? (
                    <ConfirmAction
                      title="إغلاق الجلسة"
                      description={`هل تريد إغلاق هذه الجلسة الآن؟ لن يتمكن الطلاب من تسجيل حضورها.`}
                      confirmLabel="إغلاق"
                      detailed={true}
                    >
                      {(trigger) => (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-3 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" 
                          onClick={trigger}
                        >
                          <ToggleRight className="h-4 w-4" />
                          إغلاق
                        </Button>
                      )}
                    </ConfirmAction>
                  ) : (
                    <ConfirmAction
                      title="فتح الجلسة"
                      description={`هل تريد إعادة فتح هذه الجلسة لمدة 15 دقيقة إضافية؟`}
                      confirmLabel="فتح"
                    >
                      {(trigger) => (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-3 text-xs gap-1 text-green-600 border-green-600/30 hover:bg-green-500/10" 
                          onClick={() => {
                            trigger();
                            setTimeout(() => void handleToggleSession(session.session_id, true), 100);
                          }}
                        >
                          <ToggleLeft className="h-4 w-4" />
                          فتح
                        </Button>
                      )}
                    </ConfirmAction>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Export all */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4" />
            تصدير المحاضرة كاملة
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
            <Button key={fmt} variant="outline" size="sm" onClick={() => void handleExportAll(fmt)} disabled={attendees.length === 0} className="gap-1">
              <Download className="h-3 w-3" /> {fmt.toUpperCase()}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Active session or create new */}
      {lecture.is_ended ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <StopCircle className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="font-bold text-lg text-foreground">تم إنهاء هذه المحاضرة</p>
            <p className="text-sm text-muted-foreground">لا يمكن إنشاء جلسات جديدة.</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">المدة (دقائق)</Label>
                <Input type="number" min={5} max={180} value={sessionDuration}
                  onChange={(e) => setSessionDuration(Number(e.target.value))}
                  className="h-8 text-sm" dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">القسم / السكشن</Label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="اختر القسم..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
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
