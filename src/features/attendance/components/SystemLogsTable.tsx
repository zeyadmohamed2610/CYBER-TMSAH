import { useEffect, useState } from "react";
import { Loader2, ScrollText, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { DataTable, type DataTableColumn } from "./DataTable";
import { attendanceService } from "../services/attendanceService";
import { useToast } from "@/hooks/use-toast";
import type { SystemLogEntry } from "../types";
import { formatDateTime } from "../utils/rotatingSession";

export const SystemLogsTable = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    const result = await attendanceService.fetchSystemLogs();
    if (result.error) {
      setError(result.error);
    } else {
      setLogs(result.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleClearLogs = async () => {
    const result = await attendanceService.clearSystemLogs();
    if (result.error) {
      toast({ variant: "destructive", title: "خطأ", description: result.error });
    } else {
      toast({ title: "تم", description: "تم مسح جميع سجلات النظام بنجاح" });
      loadLogs();
    }
  };

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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-5 w-5" />}
            سجلات النظام
          </CardTitle>
          <ConfirmAction
            title="مسح سجلات النظام"
            description="هل أنت متأكد من مسح جميع سجلات النظام؟ لا يمكن التراجع عن هذا الإجراء."
            confirmLabel="مسح الكل"
            onConfirm={handleClearLogs}
          >
            {(trigger) => (
              <Button
                variant="destructive"
                size="sm"
                onClick={trigger}
                disabled={loading || logs.length === 0}
                className="h-8 gap-1 shadow-sm shadow-destructive/20"
              >
                <Trash2 className="h-4 w-4" />
                مسح السجلات
              </Button>
            )}
          </ConfirmAction>
        </div>
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
