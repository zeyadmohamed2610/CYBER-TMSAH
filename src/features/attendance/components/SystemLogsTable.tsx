import { useEffect, useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "./DataTable";
import { attendanceService } from "../services/attendanceService";
import type { SystemLogEntry } from "../types";
import { formatDateTime } from "../utils/rotatingSession";

export const SystemLogsTable = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    attendanceService.fetchSystemLogs().then((result) => {
      if (result.error) {
        setError(result.error);
      } else {
        setLogs(result.data ?? []);
      }
      setLoading(false);
    });
  }, []);

  const columns: DataTableColumn<SystemLogEntry>[] = [
    {
      id: "action",
      header: "الحدث",
      cell: (row) => row.action,
    },
    {
      id: "actor",
      header: "المنفذ",
      cell: (row) => row.actorName || row.actorId || "—",
    },
    {
      id: "created-at",
      header: "الوقت",
      cell: (row) => formatDateTime(row.createdAt),
    },
  ];

  return (
    <Card className="bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-5 w-5" />}
          سجلات النظام
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <DataTable
            title=""
            caption={loading ? "جارٍ التحميل..." : "آخر 200 حدث في النظام."}
            columns={columns}
            rows={logs}
            getRowId={(row) => row.id}
            emptyMessage="لا توجد سجلات."
          />
        )}
      </CardContent>
    </Card>
  );
};
