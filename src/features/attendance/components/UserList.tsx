import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trash2, Users, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

interface UserRecord {
  id: string;
  full_name: string;
  role: string;
  national_id?: string;
  email?: string;
  created_at: string;
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

  const [formData, setFormData] = useState({
    name: "",
    nationalId: "",
    email: "",
    password: "",
    subjectId: ""
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, role, national_id, auth_id, created_at")
      .eq("role", role)
      .order("full_name", { ascending: true });

    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      const filtered = search
        ? (data ?? []).filter(u => 
            u.full_name.toLowerCase().includes(search.toLowerCase()) || 
            (u.national_id && u.national_id.includes(search))
          )
        : (data ?? []) as UserRecord[];
      setUsers(filtered);
    }
    setLoading(false);
  }, [role, search, toast]);

  useEffect(() => {
    const timer = setTimeout(() => loadUsers(), 300);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => {
    if (role === "doctor" && showCreate) {
      supabase.from("subjects").select("id, name").order("name")
        .then(({ data }) => { if (data) setSubjects(data); });
    }
  }, [role, showCreate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.name.length < 5) {
      toast({ variant: "destructive", title: "خطأ", description: "الاسم يجب أن يكون 5 أحرف على الأقل" });
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
        email: role === "doctor" ? formData.email.trim().toLowerCase() : undefined,
        password: formData.password || "12345678",
        role: role,
        subjectId: role === "doctor" ? formData.subjectId : null
      },
    });

    if (res.error || res.data?.error) {
      toast({ variant: "destructive", title: "فشل الإنشاء", description: res.data?.error || res.error?.message });
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

  const getRoleLabel = () => {
    switch (role) {
      case "student": return "طالب";
      case "doctor": return "دكتور";
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
        {/* Add Form - Same style as TAManagementPanel */}
        {showCreate && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الاسم بالكامل</Label>
                <Input 
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
                    placeholder="doctor@university.edu" 
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
                  placeholder="أدخل كلمة المرور" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  disabled={submitting}
                  className="h-8 text-sm"
                  dir="ltr"
                />
              </div>

              {role === "doctor" && (
                <div>
                  <Label className="text-xs">المادة المسندة</Label>
                  <Select 
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

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`بحث بالاسم${role === "student" ? " أو الرقم القومي" : ""}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* Users List */}
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
                className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    role === "student" ? "bg-blue-500/20 text-blue-400" : 
                    role === "doctor" ? "bg-green-500/20 text-green-400" : 
                    "bg-cyan-500/20 text-cyan-400"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {user.national_id || user.email || user.id.split("-")[0]}
                    </p>
                  </div>
                </div>
                <ConfirmAction
                  title={`حذف ${getRoleLabel()}`}
                  description={`هل تريد حذف "${user.full_name}" نهائياً؟ لا يمكن التراجع.`}
                  confirmLabel="حذف"
                >
                  {(trigger) => (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={trigger} 
                      className="text-destructive h-8 w-8 hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </ConfirmAction>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}