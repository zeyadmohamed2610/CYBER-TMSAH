import { useEffect, useState } from "react";
import { Monitor, Trash2, RefreshCw, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface Student {
  id: string;
  full_name: string;
  national_id: string | null;
  auth_id: string | null;
}

const DESKTOP_ALLOWED_KEY = "cyber_desktop_allowed";

function loadDesktopAllowed(): string[] {
  try { return JSON.parse(localStorage.getItem(DESKTOP_ALLOWED_KEY) || "[]"); }
  catch { return []; }
}

function saveDesktopAllowed(ids: string[]): void {
  localStorage.setItem(DESKTOP_ALLOWED_KEY, JSON.stringify(ids));
}

export function StudentDevicesPanel() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [desktopAllowed, setDesktopAllowed] = useState<string[]>(loadDesktopAllowed());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, full_name, national_id, auth_id")
      .eq("role", "student")
      .order("full_name");
    setStudents((data ?? []) as Student[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const toggleDesktop = (authId: string | null, name: string) => {
    if (!authId) {
      toast({ variant: "destructive", title: "خطأ", description: "هذا الطالب ليس لديه معرف مصادقة." });
      return;
    }
    const current = loadDesktopAllowed();
    if (current.includes(authId)) {
      const updated = current.filter(id => id !== authId);
      saveDesktopAllowed(updated);
      setDesktopAllowed(updated);
      toast({ title: "تم الإلغاء", description: "تم إلغاء صلاحية الدخول من أي جهاز لـ " + name });
    } else {
      const updated = [...current, authId];
      saveDesktopAllowed(updated);
      setDesktopAllowed(updated);
      toast({ title: "تم التفعيل", description: name + " يمكنه الآن تسجيل الحضور من أي جهاز" });
    }
  };

  const filtered = students.filter(s =>
    s.full_name.includes(search) || (s.national_id && s.national_id.includes(search))
  );

  const enabledCount = desktopAllowed.length;

  return (
    <div className="space-y-6">
      <Card dir="rtl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Monitor className="h-4 w-4 text-primary" />
              ربط الأجهزة
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{enabledCount} مفعل</Badge>
              <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={"h-3 w-3 " + (loading ? "animate-spin" : "")} />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            فعّل لطالب الدخول من أي جهاز (لابتوب/تابلت) لتسجيل الحضور حتى لو معندوش هاتف
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="ابحث باسم الطالب أو الرقم القومي..." value={search} onChange={e => setSearch(e.target.value)} />

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا يوجد طلاب</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map(student => {
                const isEnabled = student.auth_id && desktopAllowed.includes(student.auth_id);
                return (
                  <div key={student.id} className={"flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors " + (isEnabled ? "bg-primary/5 border-primary/30" : "bg-card border-border/50")}>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground">{student.full_name}</p>
                      <p className="text-xs text-muted-foreground">{student.national_id ?? "بدون رقم قومي"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isEnabled ? (
                        <>
                          <Badge className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                            <Shield className="h-3 w-3 mr-1" />مفعل
                          </Badge>
                          <Button size="sm" variant="ghost" className="text-xs text-destructive h-7" onClick={() => toggleDesktop(student.auth_id, student.full_name)}>
                            <Trash2 className="h-3 w-3 ml-1" />إلغاء
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => toggleDesktop(student.auth_id, student.full_name)}>
                          تفعيل
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
