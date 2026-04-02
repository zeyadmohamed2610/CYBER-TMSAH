import { useEffect, useState } from "react";
import { Plus, Trash2, Users, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface TaUser {
  id: string;
  auth_id: string;
  full_name: string;
  national_id: string | null;
  subject_id: string;
  subject_name?: string;
}

interface Subject { id: string; name: string; }

const ALL_SECTIONS = Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);

export function TAManagementPanel() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tas, setTas] = useState<TaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Create TA form
  const [form, setForm] = useState({ name: "", email: "", password: "", subjectId: "" });

  // Section assignment form
  const [assignSubject, setAssignSubject] = useState("");
  const [assignTa, setAssignTa] = useState("");
  const [assignSections, setAssignSections] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);

    // Load subjects
    const { data: subjs } = await supabase.from("subjects").select("id, name").order("name");
    setSubjects((subjs ?? []) as Subject[]);

    // Load all TAs with their subject info
    const { data: taData } = await supabase
      .from("users")
      .select("id, auth_id, full_name, national_id, subject_id")
      .eq("role", "ta")
      .order("full_name");

    // Batch fetch subject names to avoid N+1 queries
    const taList: TaUser[] = [];
    const subjectIds = [...new Set((taData ?? []).map((ta: Record<string, unknown>) => ta.subject_id as string).filter(Boolean))];
    let subjectNameMap = new Map<string, string>();
    if (subjectIds.length > 0) {
      const { data: subjects } = await supabase.from("subjects").select("id, name").in("id", subjectIds);
      subjectNameMap = new Map((subjects ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
    }
    for (const ta of (taData ?? [])) {
      taList.push({
        id: ta.id as string,
        auth_id: ta.auth_id as string,
        full_name: ta.full_name as string,
        national_id: (ta.national_id as string) ?? null,
        subject_id: ta.subject_id as string,
        subject_name: subjectNameMap.get(ta.subject_id as string) ?? "غير معروف",
      });
    }
    setTas(taList);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleCreateTa = async () => {
    if (!form.name || !form.email || !form.password || !form.subjectId) {
      toast({ variant: "destructive", title: "خطأ", description: "جميع الحقول مطلوبة." });
      return;
    }
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast({ variant: "destructive", title: "خطأ", description: "انتهت الجلسة." });
      setSubmitting(false);
      return;
    }

    const res = await supabase.functions.invoke("createUser", {
      body: {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: "ta",
        subject_id: form.subjectId,
      },
    });

    if (res.error || res.data?.error) {
      toast({ variant: "destructive", title: "فشل", description: res.data?.error || res.error?.message });
    } else {
      toast({ title: "تم الإنشاء", description: `تم إنشاء المعيد "${form.name}".` });
      setForm({ name: "", email: "", password: "", subjectId: "" });
      setShowAdd(false);
      await load();
    }
    setSubmitting(false);
  };

  const handleDeleteTa = async (taId: string, name: string) => {
    const { error } = await supabase.rpc("delete_user_by_id", { p_user_id: taId });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تم الحذف", description: `تم حذف المعيد "${name}".` });
      await load();
    }
  };

  const handleAssignSections = async () => {
    if (!assignTa || assignSections.length === 0) {
      toast({ variant: "destructive", title: "خطأ", description: "اختر المعيد والأقسام." });
      return;
    }

    // Store section assignments in course_materials teaching_assistants as structured data
    // Format: "م. اسم المعيد|سكشن 1|سكشن 2"
    const ta = tas.find((t) => t.id === assignTa);
    if (!ta) return;

    const taEntry = `م. ${ta.full_name}|${assignSections.join("|")}`;

    // Add to the subject's teaching_assistants array in course_materials
    const { data: mat } = await supabase
      .from("course_materials")
      .select("teaching_assistants")
      .eq("slug", assignSubject)
      .maybeSingle();

    const currentTAs = (mat?.teaching_assistants as string[]) ?? [];
    // Remove old entry for this TA if exists
    const filtered = currentTAs.filter((t) => !t.startsWith(`م. ${ta.full_name}|`));
    filtered.push(taEntry);

    const { error } = await supabase
      .from("course_materials")
      .update({ teaching_assistants: filtered })
      .eq("slug", assignSubject);

    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تم التعيين", description: `تم تعيين ${ta.full_name} إلى ${assignSections.length} أقسام.` });
      setAssignTa("");
      setAssignSections([]);
    }
  };

  const toggleSection = (section: string) => {
    setAssignSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
  };

  // Group TAs by subject
  const tasBySubject = subjects.map((s) => ({
    ...s,
    tas: tas.filter((t) => t.subject_id === s.id),
  })).filter((s) => s.tas.length > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            إدارة المعيدين
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1">
            <Plus className="h-3 w-3" /> إنشاء معيد
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create TA Form */}
        {showAdd && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الاسم</Label>
                <Input className="h-8 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="م. اسم المعيد" />
              </div>
              <div>
                <Label className="text-xs">البريد الإلكتروني</Label>
                <Input className="h-8 text-sm" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ta@university.edu" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">كلمة المرور</Label>
                <Input className="h-8 text-sm" type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8+ أحرف" />
              </div>
              <div>
                <Label className="text-xs">المادة الأساسية</Label>
                <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>إلغاء</Button>
              <Button size="sm" onClick={handleCreateTa} disabled={submitting}>
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} إنشاء
              </Button>
            </div>
          </div>
        )}

        {/* Section Assignment */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">تعيين الأقسام</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">المادة</Label>
              <Select value={assignSubject} onValueChange={setAssignSubject}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="المادة" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.name.toLowerCase().replace(/\s+/g, "-")}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">المعيد</Label>
              <Select value={assignTa} onValueChange={setAssignTa}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر المعيد" /></SelectTrigger>
                <SelectContent>
                  {tas.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name} ({t.subject_name})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">الأقسام</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {ALL_SECTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSection(s)}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                      assignSections.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {s.replace("سكشن ", "")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAssignSections} disabled={!assignTa || assignSections.length === 0}>
              تعيين الأقسام
            </Button>
          </div>
        </div>

        {/* TAs by Subject */}
        {loading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : tasBySubject.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد معيدين بعد.</p>
        ) : (
          <div className="space-y-4">
            {tasBySubject.map((group) => (
              <div key={group.id} className="rounded-lg border bg-card p-4">
                <p className="font-medium text-sm mb-3">{group.name}</p>
                <div className="space-y-2">
                  {group.tas.map((ta) => (
                    <div key={ta.id} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ta.full_name}</p>
                        <p className="text-xs text-muted-foreground font-mono" dir="ltr">{ta.national_id ?? "—"}</p>
                      </div>
                      <ConfirmAction
                        title="حذف المعيد"
                        description={`هل تريد حذف المعيد "${ta.full_name}" نهائياً؟ لا يمكن التراجع.`}
                        confirmLabel="حذف"
                        onConfirm={() => handleDeleteTa(ta.id, ta.full_name)}
                      >
                        {(trigger) => (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={trigger}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </ConfirmAction>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
