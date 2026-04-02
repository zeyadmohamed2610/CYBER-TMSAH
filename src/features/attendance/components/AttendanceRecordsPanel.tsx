import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface AttendanceRecord {
  id: string;
  student_name: string;
  subject_name: string;
  session_id: string;
  submitted_at: string;
  ip_address: string | null;
  section: string | null;
}

export const AttendanceRecordsPanel = () => {
  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("attendance")
        .select("id, created_at, ip_address, session_id, student_id, section, sessions(subject_id, subjects(name)), users!attendance_student_id_fkey(full_name)")
        .limit(200);

      const sortedData = (data ?? []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const mapped: AttendanceRecord[] = sortedData.map((row: Record<string, unknown>) => {
        const session = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
        const subject = session && (Array.isArray((session as Record<string, unknown>).subjects) ? ((session as Record<string, unknown>).subjects as Record<string, unknown>[])[0] : (session as Record<string, unknown>).subjects);
        const student = Array.isArray(row.users) ? row.users[0] : row.users;
        return {
          id: row.id as string,
          student_name: (student as Record<string, unknown>)?.full_name as string ?? "—",
          subject_name: (subject as Record<string, unknown>)?.name as string ?? "—",
          session_id: row.session_id as string,
          submitted_at: row.created_at as string,
          ip_address: (row.ip_address as string) ?? null,
          section: (row.section as string) ?? null,
        };
      });
      setRecords(mapped);
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل السجلات." });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (error) throw error;
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "تم الحذف", description: "تم حذف السجل بنجاح." });
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل حذف السجل." });
    }
    setDeleting(null);
  };

  const handleDeleteAll = async () => {
    setDeleting("all");
    try {
      const { error } = await supabase.from("attendance").delete().neq("id", "");
      if (error) throw error;
      setRecords([]);
      toast({ title: "تم الحذف", description: "تم حذف جميع السجلات." });
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل حذف السجلات." });
    }
    setDeleting(null);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r) =>
      r.student_name.toLowerCase().includes(q) ||
      r.subject_name.toLowerCase().includes(q) ||
      (r.section && r.section.toLowerCase().includes(q))
    );
  }, [records, search]);

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-5 w-5" />}
            سجلات الحضور ({records.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="بحث باسم أو مادة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm pr-9 w-48"
              />
            </div>
            {records.length > 0 && (
              <ConfirmAction
                title="حذف جميع السجلات"
                description="هل تريد حذف جميع سجلات الحضور؟ لا يمكن التراجع."
                confirmLabel="حذف الكل"
                onConfirm={handleDeleteAll}
              >
                {(trigger) => (
                  <Button variant="destructive" size="sm" className="h-8 gap-1" onClick={trigger} disabled={deleting === "all"}>
                    <Trash2 className="h-3 w-3" /> حذف الكل
                  </Button>
                )}
              </ConfirmAction>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {loading ? "جاري التحميل..." : "لا توجد سجلات."}
          </p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filtered.map((record) => (
              <div key={record.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{record.student_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px]">{record.subject_name}</Badge>
                    {record.section && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{record.section}</Badge>}
                    <span className="text-[10px] text-muted-foreground" dir="ltr">
                      {new Date(record.submitted_at).toLocaleString("en-GB")}
                    </span>
                  </div>
                </div>
                <ConfirmAction
                  title="حذف السجل"
                  description={`هل تريد حذف سجل "${record.student_name}"؟`}
                  confirmLabel="حذف"
                  onConfirm={() => handleDelete(record.id)}
                >
                  {(trigger) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={trigger}
                      disabled={deleting === record.id}
                    >
                      {deleting === record.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  )}
                </ConfirmAction>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
