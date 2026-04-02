import { useEffect, useState } from "react";
import { UserPlus, Loader2, CheckCircle2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface Student { id: string; full_name: string; national_id: string | null; }
interface Session { 
  id: string; 
  subject_name: string; 
  subject_id: string;
  section: string | null; 
  is_active: boolean; 
  created_at: string; 
}

export function ManualAttendancePanel() {
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [sRes, sessRes] = await Promise.all([
        supabase.from("users").select("id, full_name, national_id").eq("role", "student"),
        supabase.from("sessions").select("id, is_active, created_at, subject_id, section").limit(50),
      ]);
      
      const studentsData = (sRes.data ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
      setStudents(studentsData as Student[]);

      const sessData = sessRes.data ?? [];
      const sortedSessions = [...sessData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (sortedSessions.length > 0) {
        const subjectIds = [...new Set(sessData.map((s: Session) => s.subject_id).filter(Boolean))];
        const { data: subjects } = await supabase.from("subjects").select("id, name").in("id", subjectIds as string[]);
        const nameMap = new Map((subjects ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
        setSessions(sessData.map((s: Session) => ({
          id: s.id,
          subject_name: nameMap.get(s.subject_id) || "غير معروف",
          subject_id: s.subject_id,
          section: s.section ?? null,
          is_active: s.is_active,
          created_at: s.created_at,
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

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) || 
    (s.national_id && s.national_id.includes(search))
  );

  if (loading) {
    return (
      <Card dir="rtl" className="glass-card">
        <CardContent className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span>جاري التحميل</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir="rtl" className="glass-card shadow-lg border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <UserCheck className="h-6 w-6 text-primary" />
          تسجيل حضور يدوي
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">سجل حضور اي طالب في اي جلسة يدوياً.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Student selection with search */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">اختيار الطالب</Label>
            <div className="space-y-2">
              <Input
                placeholder="بحث عن طالب..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-xs"
              />
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="h-12 rounded-xl border-primary/20 bg-background/50">
                  <SelectValue placeholder="اختر الطالب من القائمة..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredStudents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">لا يوجد نتائج</div>
                  ) : filteredStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-bold">{s.full_name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{s.national_id || "بدون رقم قومي"}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">الجلسة</Label>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger className="h-12 rounded-xl border-primary/20 bg-background/50">
                <SelectValue placeholder="اختر جلسة..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
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
        </div>

        <Button onClick={handleAdd} disabled={adding || !selectedStudent || !selectedSession} className="w-full h-12 rounded-xl gap-2 shadow-lg shadow-primary/20">
          {added ? <CheckCircle2 className="h-5 w-5" /> : adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
          {added ? "تم التسجيل" : adding ? "جاري التسجيل" : "إضافة الحضور"}
        </Button>
      </CardContent>
    </Card>
  );
}
