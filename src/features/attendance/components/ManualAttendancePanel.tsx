import { useEffect, useState } from "react";
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface Student { id: string; full_name: string; national_id: string | null; }
interface Session { id: string; subject_name: string; section: string | null; is_active: boolean; created_at: string; }

export function ManualAttendancePanel() {
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [search, setSearch] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [sRes, sessRes] = await Promise.all([
        supabase.from("users").select("id, full_name, national_id").eq("role", "student").order("full_name"),
        supabase.from("sessions").select("id, is_active, created_at, subject_id, section").order("created_at", { ascending: false }).limit(50),
      ]);
      setStudents((sRes.data ?? []) as Student[]);

      const sessData = sessRes.data ?? [];
      if (sessData.length > 0) {
        const subjectIds = [...new Set(sessData.map((s: Record<string, unknown>) => s.subject_id).filter(Boolean))];
        const { data: subjects } = await supabase.from("subjects").select("id, name").in("id", subjectIds as string[]);
        const nameMap = new Map((subjects ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
        setSessions(sessData.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          subject_name: nameMap.get(s.subject_id as string) || "غير معروف",
          section: (s.section as string) ?? null,
          is_active: s.is_active as boolean,
          created_at: s.created_at as string,
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleAdd = async () => {
    if (!selectedStudent || !selectedSession) { toast.error("اختر طالب وجلسة"); return; }
    setAdding(true);
    setAdded(false);

    const { error } = await supabase.rpc("add_manual_attendance", {
      p_student_id: selectedStudent,
      p_session_id: selectedSession,
    });

    if (error) {
      toast.error("فشل: " + error.message);
    } else {
      setAdded(true);
      toast.success("تم تسجيل الحضور بنجاح");
      setTimeout(() => setAdded(false), 3000);
    }
    setAdding(false);
  };

  const filtered = students.filter(s =>
    s.full_name.includes(search) || (s.national_id && s.national_id.includes(search))
  );

  if (loading) {
    return (
      <Card dir="rtl">
        <CardContent className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span>جاري التحميل</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4 text-primary" />
          اضافة حضور يدوي
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">سجل حضور اي طالب في اي جلسة بدون اي تحقق</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>ابحث عن الطالب</Label>
          <Input placeholder="اسم الطالب او الرقم القومي..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>الطالب</Label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger><SelectValue placeholder="اختر طالب..." /></SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {filtered.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name} {s.national_id ? "(" + s.national_id + ")" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>الجلسة</Label>
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger><SelectValue placeholder="اختر جلسة..." /></SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {sessions.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-medium text-sm">{s.subject_name} {s.section ? `- ${s.section}` : ""}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("ar-EG")}
                      {s.is_active ? " (نشطة)" : ""}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleAdd} disabled={adding || !selectedStudent || !selectedSession} className="w-full gap-2">
          {added ? <CheckCircle2 className="h-4 w-4" /> : adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {added ? "تم التسجيل" : adding ? "جاري التسجيل" : "تسجيل الحضور"}
        </Button>
      </CardContent>
    </Card>
  );
}
