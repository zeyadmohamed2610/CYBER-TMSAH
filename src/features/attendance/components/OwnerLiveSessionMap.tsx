import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AttendanceRecord, SessionSummary } from "../types";
import { formatDateTime } from "../utils/rotatingSession";

interface OwnerLiveSessionDetailsProps {
  sessions: SessionSummary[];
  records: AttendanceRecord[];
}

export const OwnerLiveSessionDetails = ({ sessions, records }: OwnerLiveSessionDetailsProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  const activeSessions = useMemo(() => sessions.filter((s) => s.isActive), [sessions]);

  const selectedSession = useMemo(
    () =>
      activeSessions.find((s) => s.id === selectedSessionId) ?? activeSessions[0] ?? null,
    [activeSessions, selectedSessionId],
  );

  const sessionRecords = useMemo(
    () => records.filter((r) => r.sessionId === selectedSession?.id),
    [records, selectedSession],
  );

  return (
    <Card className="overflow-hidden border-primary/25 bg-card/85">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">الجلسات النشطة — تفاصيل الحضور</CardTitle>
        <CardDescription>حضور الطلاب في الجلسات النشطة حالياً.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeSessions.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
            لا توجد جلسات نشطة حالياً.
          </div>
        ) : (
          <>
            {activeSessions.length > 1 && (
              <Select
                value={selectedSessionId || activeSessions[0].id}
                onValueChange={setSelectedSessionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الجلسة" />
                </SelectTrigger>
                <SelectContent>
                  {activeSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.subjectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedSession && (
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedSession.subjectName}</p>
                      <p className="text-xs text-muted-foreground">
                        الكود: <span className="font-mono">{selectedSession.rotatingHash ?? "—"}</span>
                      </p>
                    </div>
                    <Badge variant="default">نشطة</Badge>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border/70">
                  <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/15 px-3 py-2">
                    <p className="text-sm font-medium">الطلاب المسجلون</p>
                    <Badge variant="outline">{sessionRecords.length} طالب</Badge>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 text-right font-medium">الطالب</th>
                        <th className="px-3 py-2 text-right font-medium">وقت التسجيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionRecords.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-3 py-5 text-center text-muted-foreground">
                            لا يوجد طلاب مسجلون في هذه الجلسة بعد.
                          </td>
                        </tr>
                      ) : (
                        sessionRecords.map((record) => (
                          <tr key={record.id} className="border-b border-border/50">
                            <td className="px-3 py-2">{record.studentName || record.studentId}</td>
                            <td className="px-3 py-2">{formatDateTime(record.submittedAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
