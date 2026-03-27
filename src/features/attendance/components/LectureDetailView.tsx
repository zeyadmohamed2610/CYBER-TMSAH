import { useEffect, useState } from "react";
import { ArrowRight, Download, RefreshCw, Users, Clock, Globe, Hash, Fingerprint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { activeSession, creating, error, createSession, stopSession, updateDuration, refreshHash } =
    useSessionManager();

  const load = async () => {
    setLoading(true);
    const result = await attendanceService.getLectureAttendees(lecture.id);
    if (result.error) {
      toast({ variant: "destructive", title: "Error", description: result.error });
    } else {
      setAttendees(result.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [lecture.id]);

  // Auto-refresh every 10 seconds when there's an active session
  useEffect(() => {
    if (!activeSession?.is_active) return;
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [activeSession?.is_active]);

  const handleCreateSession = async (subjectId: string, duration: number, lat?: number | null, lng?: number | null, radius?: number) => {
    await createSession(subjectId, duration, lat, lng, radius, lecture.id);
  };

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    const result = await reportService.exportLecture(attendees, lecture, format);
    if (result.error) {
      toast({ variant: "destructive", title: "Export failed", description: result.error });
    } else {
      toast({ title: "Exported", description: `${format.toUpperCase()} downloaded.` });
    }
  };

  const columns: DataTableColumn<LectureAttendee>[] = [
    {
      id: "num",
      header: "#",
      cell: (_row, index) => String((index ?? 0) + 1),
    },
    {
      id: "name",
      header: "Student Name",
      cell: (row) => <span className="font-medium">{row.student_name}</span>,
    },
    {
      id: "nid",
      header: "National ID",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.national_id ?? "\u2014"}</span>
      ),
    },
    {
      id: "code",
      header: "Session Code",
      cell: (row) => (
        <Badge variant="outline" className="font-mono">{row.short_code ?? "\u2014"}</Badge>
      ),
    },
    {
      id: "time",
      header: "Time",
      cell: (row) => (
        <span className="text-xs text-muted-foreground" dir="ltr">
          {new Date(row.submitted_at).toLocaleString("en-GB")}
        </span>
      ),
    },
    {
      id: "ip",
      header: "IP Address",
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
            Back
          </Button>
          <div>
            <h2 className="text-lg font-bold">{lecture.title}</h2>
            <p className="text-xs text-muted-foreground">
              {lecture.subject_name} &middot; {new Date(lecture.lecture_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
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
              <p className="text-xs text-muted-foreground">Attendees</p>
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
              <p className="text-xs text-muted-foreground">Sessions</p>
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
              <p className="text-xs text-muted-foreground">Last Check-in</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export buttons */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Attendance
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
      {activeSession && activeSession.is_active ? (
        <LiveSessionPanel
          session={activeSession}
          onStop={stopSession}
          onUpdateDuration={updateDuration}
          onRefreshHash={refreshHash}
        />
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-6">
            <Button
              onClick={() => handleCreateSession(lecture.subject_id, 10)}
              disabled={creating}
              className="gap-2"
            >
              <Hash className="h-4 w-4" />
              {creating ? "Creating..." : "Start Attendance Session"}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Attendees table */}
      <DataTable
        title={`Attendance List (${attendees.length})`}
        caption={loading ? "Loading..." : attendees.length === 0 ? "No attendance records yet. Start a session above." : undefined}
        columns={columns}
        rows={attendees}
        getRowId={(row) => row.attendance_id}
        emptyMessage="No attendance records"
      />
    </div>
  );
}
