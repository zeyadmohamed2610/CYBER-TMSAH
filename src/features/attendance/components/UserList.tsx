import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trash2, Users, Loader2, X, Edit2, Save, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

interface UserRecord {
  id: string;
  full_name: string;
  role: string;
  national_id?: string;
  subject_id?: string;
  created_at?: string;
}

interface Subject { id: string; name: string; }

export function UserList({ role, title }: { role: string; title: string }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", nationalId: "", email: "", subjectId: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, name: string} | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    nationalId: "",
    email: "",
    password: "",
    subjectId: ""
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("users")
        .select("id, full_name, role, national_id, subject_id")
        .eq("role", role);

      if (search) {
        if (role === "student") {
          query = query.ilike("full_name", `%${search}%`);
        } else {
          query = query.ilike("full_name", `%${search}%`);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading users:", error);
        toast({ variant: "destructive", title: "خطأ", description: error.message });
        setUsers([]);
      } else {
        const sortedData = (data ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
        setUsers(sortedData);
      }
    } catch (err) {
      console.error("Exception loading users:", err);
      setUsers([]);
    }
    setLoading(false);
  }, [role, search, toast]);

  useEffect(() => {
    const timer = setTimeout(() => loadUsers(), 300);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => {
    if ((role === "doctor" || role === "ta") && showCreate) {
      supabase.from("subjects").select("id, name")
        .then(({ data }) => { 
          if (data) {
            const sorted = data.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
            setSubjects(sorted); 
          }
        });
    }
  }, [role, showCreate]);

  useEffect(() => {
    if (role === "doctor" && subjects.length === 0) {
      supabase.from("subjects").select("id, name")
        .then(({ data }) => {
          if (data) {
            const sorted = data.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
            setSubjects(sorted);
          }
        });
    }
  }, [role, subjects.length]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.name.length < 5) {
      toast({ variant: "destructive", title: "خطأ", description: "الاسم يجب أن يكون 5 أحرف على الأقل" });
      return;
    }
    if ((role === "doctor" || role === "ta") && !formData.subjectId) {
      toast({ variant: "destructive", title: "خطأ", description: "يرجى اختيار المادة" });
      return;
    }
    if (role === "student" && (!formData.nationalId || formData.nationalId.length !== 14)) {
      toast({ variant: "destructive", title: "خطأ", description: "الرقم القومي يجب أن يكون 14 رقم" });
      return;
    }
    if ((role === "doctor" || role === "ta") && (!formData.email || !formData.email.includes("@"))) {
      toast({ variant: "destructive", title: "خطأ", description: "يرجى إدخال بريد إلكتروني صحيح" });
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
        name: formData.name.trim(),
        national_id: role === "student" ? formData.nationalId : undefined,
        email: (role === "doctor" || role === "ta") ? formData.email.trim().toLowerCase() : undefined,
        password: formData.password || "12345678",
        role: role,
        subject_id: role === "doctor" || role === "ta" ? formData.subjectId : null
      },
    });

    // Debug: log everything
    console.log("Full response:", res);
    console.log("Status:", res.error ? "error" : "success");
    console.log("Data:", res.data);
    console.log("Error:", res.error);
    console.log("Response keys:", Object.keys(res));

    // Try to get more info from the error
    const errorInfo = res.error ? 
      (res.error.message || res.error.toString()) : 
      (res.data?.error || "unknown");
    
    alert(`Status: ${res.error ? 'ERROR' : 'OK'}\nError: ${errorInfo}\nData: ${JSON.stringify(res.data, null, 2)}`);

    if (res.error || res.data?.error) {
      let errorMsg = "خطأ غير معروف";
      if (res.data?.error) {
        errorMsg = res.data.error;
      } else if (res.error) {
        errorMsg = res.error.message || res.error.toString();
      }
      if (res.data?.details) {
        errorMsg += ` (${JSON.stringify(res.data.details)})`;
      }
      toast({ variant: "destructive", title: "فشل الإنشاء", description: errorMsg });
    } else {
      toast({ title: "تم الإضافة ✓", description: `تم إضافة ${formData.name} بنجاح.` });
      setFormData({ name: "", nationalId: "", email: "", password: "", subjectId: "" });
      setShowCreate(false);
      loadUsers();
    }
    setSubmitting(false);
  };

  const handleDelete = async (userId: string, name: string) => {
    const { error } = await supabase.rpc("delete_user_by_id", { p_user_id: userId });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تم الحذف", description: `تم حذف "${name}" نهائياً.` });
      loadUsers();
    }
  };

  const startEdit = (user: UserRecord) => {
    setEditingId(user.id);
    setEditData({
      name: user.full_name,
      nationalId: user.national_id || "",
      email: "",
      subjectId: user.subject_id || ""
    });
    if ((role === "doctor" || role === "ta") && subjects.length === 0) {
      supabase.from("subjects").select("id, name").order("name")
        .then(({ data }) => { if (data) setSubjects(data); });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ name: "", nationalId: "", email: "", subjectId: "" });
  };

  const saveEdit = async () => {
    if (!editData.name || editData.name.length < 5) {
      toast({ variant: "destructive", title: "خطأ", description: "الاسم يجب أن يكون 5 أحرف على الأقل" });
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.rpc("update_user", {
      p_user_id:     editingId,
      p_full_name:   editData.name.trim(),
      p_national_id: role === "student" ? editData.nationalId || null : null,
      p_subject_id:  (role === "doctor" || role === "ta") ? editData.subjectId || null : null,
    });

    if (error) {
      toast({ variant: "destructive", title: "فشل التعديل", description: error.message });
    } else {
      toast({ title: "تم التعديل ✓", description: `تم تعديل بيانات ${editData.name} بنجاح.` });
      setEditingId(null);
      loadUsers();
    }
    setSubmitting(false);
  };

  const getRoleLabel = () => {
    switch (role) {
      case "student": return "طالب";
      case "doctor": return "دكتور";
      case "ta": return "معيد";
      default: return "مستخدم";
    }
  };

  return (
    <Card className="bg-card/90">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {title} ({users.length})
          </CardTitle>
          <Button 
            size="sm" 
            variant={showCreate ? "secondary" : "default"}
            onClick={() => setShowCreate(!showCreate)} 
            className="gap-1"
          >
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? "إغلاق" : "إضافة جديد"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreate && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الاسم بالكامل</Label>
                <Input 
                  id="name"
                  name="name"
                  placeholder="أدخل الاسم الرباعي" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  disabled={submitting}
                  className="h-8 text-sm"
                />
              </div>
              
              {role === "student" ? (
                <div>
                  <Label className="text-xs">الرقم القومي (14 رقم)</Label>
                  <Input 
                    id="nationalId"
                    name="nationalId"
                    placeholder="299..." 
                    value={formData.nationalId}
                    onChange={e => setFormData({...formData, nationalId: e.target.value})}
                    disabled={submitting}
                    className="h-8 text-sm"
                    dir="ltr"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">البريد الإلكتروني</Label>
                  <Input 
                    type="email"
                    id="email"
                    name="email"
                    placeholder={role === "ta" ? "ta@university.edu" : "doctor@university.edu"} 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    disabled={submitting}
                    className="h-8 text-sm"
                    dir="ltr"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">كلمة المرور</Label>
                <Input 
                  type="password"
                  id="password"
                  name="password"
                  placeholder="أدخل كلمة المرور" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  disabled={submitting}
                  className="h-8 text-sm"
                  dir="ltr"
                />
              </div>

              {(role === "doctor" || role === "ta") && (
                <div>
                  <Label className="text-xs">المادة المسندة</Label>
                  <Select 
                    id="create-user-subject"
                    value={formData.subjectId} 
                    onValueChange={val => setFormData({...formData, subjectId: val})}
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="اختر مادة" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>إلغاء</Button>
              <Button size="sm" onClick={handleCreate} disabled={submitting} className="gap-1">
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                {submitting ? "جاري الإضافة..." : "حفظ"}
              </Button>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            name="search"
            placeholder={`بحث بالاسم${role === "student" ? " أو الرقم القومي" : ""}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {search ? "لا توجد نتائج للبحث." : `لا يوجد ${getRoleLabel()}ين بعد.`}
            </p>
          ) : (
            users.map((user, idx) => (
              <div 
                key={user.id} 
                className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  editingId === user.id 
                    ? "bg-primary/10 border-primary" 
                    : "bg-muted/30 hover:bg-muted/50 border-transparent"
                }`}
              >
                {editingId === user.id ? (
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs w-12">الاسم:</Label>
                      <Input 
                        id="editName"
                        name="editName"
                        value={editData.name}
                        onChange={e => setEditData({...editData, name: e.target.value})}
                        className="h-8 text-sm flex-1"
                        placeholder="الاسم"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {role === "student" && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs w-16">الرقم:</Label>
                          <Input 
                            id="editNationalId"
                            name="editNationalId"
                            value={editData.nationalId}
                            onChange={e => setEditData({...editData, nationalId: e.target.value})}
                            className="h-8 text-xs flex-1"
                            placeholder="الرقم القومي"
                            dir="ltr"
                          />
                        </div>
                      )}
                      {(role === "doctor" || role === "ta") && (
                          <Select 
                            id="edit-user-subject"
                            value={editData.subjectId} 
                            onValueChange={val => setEditData({...editData, subjectId: val})}
                          >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="المادة" /></SelectTrigger>
                          <SelectContent>
                            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      role === "student" ? "bg-blue-500/20 text-blue-400" : 
                      role === "doctor" ? "bg-green-500/20 text-green-400" : 
                      "bg-cyan-500/20 text-cyan-400"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate text-right">{user.full_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-xs font-muted-foreground">{user.id.split("-")[0]}</span>
                        {user.national_id && (
                          <>
                            <span className="text-muted-foreground/50">|</span>
                            <span className="font-mono" dir="ltr">{user.national_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-1 shrink-0">
                  {editingId === user.id ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-8 w-8">
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={saveEdit} disabled={submitting} className="h-8 w-8 text-green-500">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </>
                  ) : deleteConfirm?.id === user.id ? (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setDeleteConfirm(null)} 
                        className="h-8 w-8 text-muted-foreground"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(user.id, user.full_name)} 
                        className="h-8 w-8 text-destructive"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(user)} className="h-8 w-8 text-primary" title="تعديل">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({id: user.id, name: user.full_name})} className="text-destructive h-8 w-8 hover:bg-destructive/10" title="حذف">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}