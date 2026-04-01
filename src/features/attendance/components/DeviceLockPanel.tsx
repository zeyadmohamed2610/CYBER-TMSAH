import { useEffect, useState } from "react";
import { Shield, Trash2, RefreshCw, Smartphone, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface StudentInfo {
  id: string;
  full_name: string;
  national_id: string | null;
  auth_id: string | null;
}

interface DeviceLock {
  student_auth_id: string;
  device_label: string;
  locked_at: string;
}

export function DeviceLockPanel() {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [locks, setLocks] = useState<DeviceLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [usersRes, locksRes] = await Promise.all([
      supabase.from("users").select("id, full_name, national_id, auth_id").eq("role", "student").order("full_name"),
      supabase.from("device_locks").select("student_auth_id, device_label, locked_at"),
    ]);
    setStudents((usersRes.data ?? []) as StudentInfo[]);
    setLocks((locksRes.data ?? []) as DeviceLock[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleUnlock = async (authId: string, name: string) => {
    const { error } = await supabase.from("device_locks").delete().eq("student_auth_id", authId);
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تم الإلغاء", description: "تم إلغاء قفل جهاز " + name });
      void load();
    }
  };

  const lockMap = new Map(locks.map(l => [l.student_auth_id, l]));
  const lockedCount = locks.length;

  const filtered = students.filter(s =>
    s.full_name.includes(search) || (s.national_id && s.national_id.includes(search))
  );

  return (
    <Card dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            قفل الأجهزة
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{lockedCount} مغلق</Badge>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={"h-3 w-3 " + (loading ? "animate-spin" : "")} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          الطالب يقفل جهازه بنفسه من لوحة التحكم. هنا يمكنك إلغاء القفل لو غير هاتفه.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ابحث باسم الطالب..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">جاري التحميل...</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filtered.map(student => {
              const lock = student.auth_id ? lockMap.get(student.auth_id) : null;
              const isLocked = !!lock;
              return (
                <div key={student.id} className={"flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors " + (isLocked ? "bg-primary/5 border-primary/30" : "bg-card border-border/50")}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 " + (isLocked ? "bg-primary/10" : "bg-muted")}>
                      <Smartphone className={"h-4 w-4 " + (isLocked ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{student.full_name}</p>
                      <p className="text-xs text-muted-foreground">{student.national_id ?? "—"}</p>
                      {isLocked && (
                        <p className="text-[10px] text-primary mt-0.5 truncate">
                          {lock.device_label} — {new Date(lock.locked_at).toLocaleDateString("ar-EG")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isLocked ? (
                      <Button size="sm" variant="ghost" className="text-xs text-destructive h-7" onClick={() => student.auth_id && handleUnlock(student.auth_id, student.full_name)}>
                        <Trash2 className="h-3 w-3 ml-1" />إلغاء القفل
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-xs">غير مغلق</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
