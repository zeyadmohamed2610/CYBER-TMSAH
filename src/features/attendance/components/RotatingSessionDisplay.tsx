import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SessionSummary } from "../types";
import { formatDateTime } from "../utils/rotatingSession";

interface RotatingSessionDisplayProps {
  sessions: SessionSummary[];
}

export const RotatingSessionDisplay = ({ sessions }: RotatingSessionDisplayProps) => {
  const activeSession = useMemo(
    () => sessions.find((s) => s.isActive) ?? sessions[0] ?? null,
    [sessions],
  );

  if (!activeSession) {
    return (
      <Card className="bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">الجلسة النشطة</CardTitle>
          <CardDescription>لا توجد جلسات نشطة.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/25 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{activeSession.subjectName}</CardTitle>
          <Badge variant={activeSession.isActive ? "default" : "outline"}>
            {activeSession.isActive ? "نشطة" : "منتهية"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeSession.rotatingHash ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-primary/80">الكود المؤقت</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.35em] text-primary">
              {activeSession.rotatingHash}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">لا يوجد كود مؤقت للجلسة الحالية.</p>
        )}
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p>أنشئت: {formatDateTime(activeSession.createdAt)}</p>
          {activeSession.expiresAt && <p>تنتهي: {formatDateTime(activeSession.expiresAt)}</p>}
          <p>Session ID: {activeSession.id}</p>
        </div>
      </CardContent>
    </Card>
  );
};
