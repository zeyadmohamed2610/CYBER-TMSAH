import { useEffect, useState, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Plus, Trash2, Users, Loader2, Edit2, Save, XCircle, CheckCircle, Info, BookOpen, Search, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface TaUser {
  id: string;
  full_name: string;
  national_id: string | null;
  subject_id: string;
  subject_name?: string;
}

interface Subject { id: string; name: string; }

export function TAManagementPanel() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tas, setTas] = useState<TaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", email: "", subjectId: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, name: string} | null>(null);

  const [form, setForm] = useState({ name: "", email: "", password: "", subjectId: "" });
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: subjs } = await supabase.from("subjects").select("id, name");
    const sortedSubjs = (subjs ?? []).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    setSubjects(sortedSubjs as Subject[]);

    const { data: taData, error: taError } = await supabase
      .from("users")
      .select("id, full_name, national_id, subject_id")
      .eq("role", "ta");

    if (taError) {
      console.error("Error loading TAs:", taError);
    }

    const taList: TaUser[] = [];
    const subjectIds = [...new Set((taData ?? []).map((ta: Record<string, unknown>) => ta.subject_id as string).filter(Boolean))];
    let subjectNameMap = new Map<string, string>();
    if (subjectIds.length > 0) {
      const { data: subjsData } = await supabase.from("subjects").select("id, name").in("id", subjectIds);
      subjectNameMap = new Map((subjsData ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
    }
    for (const ta of (taData ?? [])) {
      const subjectName = subjectNameMap.get(ta.subject_id as string);

      taList.push({
        id: ta.id as string,
        full_name: ta.full_name as string,
        national_id: (ta.national_id as string) ?? null,
        subject_id: ta.subject_id as string,
        subject_name: subjectName ?? "غير معروف"
      });
    }
    
    // Sort alphabetically by Arabic name
    taList.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
    
    setTas(taList);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredTas = tas.filter(ta => 
    ta.full_name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

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
      setDeleteConfirm(null);
      await load();
    }
  };

  const startEdit = (ta: TaUser) => {
    setEditingId(ta.id);
    setEditData({
      name: ta.full_name,
      email: "",
      subjectId: ta.subject_id
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ name: "", email: "", subjectId: "" });
  };

  const saveEdit = async () => {
    if (!editData.name || editData.name.length < 5) {
      toast({ variant: "destructive", title: "خطأ", description: "الاسم يجب أن يكون 5 أحرف على الأقل" });
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.rpc("update_user", {
      p_user_id:    editingId,
      p_full_name:  editData.name.trim(),
      p_subject_id: editData.subjectId || null,
    });

    if (error) {
      toast({ variant: "destructive", title: "فشل التعديل", description: error.message });
    } else {
      toast({ title: "تم التعديل ✓", description: `تم تعديل بيانات ${editData.name} بنجاح.` });
      setEditingId(null);
      await load();
    }
    setSubmitting(false);
  };

  const tasBySubject = subjects.map((s) => ({
    ...s,
    tas: filteredTas.filter((t) => t.subject_id === s.id),
  })).filter((group) => group.tas.length > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            إدارة المعيدين ({tas.length})
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1">
            <Plus className="h-3 w-3" /> {showAdd ? "إغلاق" : "إضافة معيد"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showAdd && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الاسم</Label>
                <Input id="taName" name="taName" className="h-8 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="م. اسم المعيد" />
              </div>
              <div>
                <Label className="text-xs">البريد الإلكتروني</Label>
                <Input id="taEmail" name="taEmail" className="h-8 text-sm" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ta@university.edu" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">كلمة المرور</Label>
                <div className="relative">
                  <Input id="taPassword" name="taPassword" className="h-8 text-sm pr-10" type={showPassword ? "text" : "password"} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8+ أحرف" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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

        <div className="relative">
          <Input
            id="taSearch"
            name="taSearch"
            placeholder="بحث عن معيد بالاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : tasBySubject.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد معيدين بعد.</p>
        ) : (
          <div className="space-y-4">
            {tasBySubject.map((group) => (
              <div key={group.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <p className="font-medium text-sm">{group.name}</p>
                  <Badge variant="secondary" className="mr-auto">{group.tas.length}</Badge>
                </div>
                <div className="space-y-2">
                  {group.tas.map((ta, idx) => (
                    <div 
                      key={ta.id} 
                      className={`flex items-center justify-between rounded-lg p-3 transition-colors ${
                        editingId === ta.id 
                          ? "bg-primary/10 border border-primary" 
                          : "bg-muted/30 border-transparent"
                      }`}
                    >
                      {editingId === ta.id ? (
                        <div className="flex-1 space-y-2">
                           <Input 
                             id="editTaName"
                             name="editTaName"
                             value={editData.name}
                             onChange={e => setEditData({...editData, name: e.target.value})}
                             className="h-8 text-sm"
                             placeholder="الاسم"
                           />
                 <Select 
                   value={editData.subjectId} 
                   onValueChange={val => setEditData({...editData, subjectId: val})}
                 >
                             <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="المادة" /></SelectTrigger>
                             <SelectContent>
                               {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                             </SelectContent>
                           </Select>
                         </div>
                        ) : deleteConfirm?.id === ta.id ? (
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{ta.full_name}</p>
                            <p className="text-xs text-muted-foreground">{ta.subject_name}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{ta.full_name}</p>
                            <p className="text-xs text-muted-foreground">{ta.subject_name}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {editingId === ta.id ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-8 w-8">
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={saveEdit} disabled={submitting} className="h-8 w-8 text-green-500">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : deleteConfirm?.id === ta.id ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(null)} className="h-8 w-8 text-muted-foreground">
                              <XCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTa(ta.id, ta.full_name)} className="h-8 w-8 text-destructive">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => startEdit(ta)} className="h-7 w-7 text-primary">
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({id: ta.id, name: ta.full_name})} className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
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