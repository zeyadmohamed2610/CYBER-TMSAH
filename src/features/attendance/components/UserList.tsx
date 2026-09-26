// src/features/attendance/components/UserList.tsx
import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Plus,
  Search,
  Trash2,
  Users,
  Loader2,
  X,
  Edit2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Building2,
  GraduationCap,
  BookOpen,
  Mail,
  UserCheck,
  Shield,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { DEPARTMENTS, ACADEMIC_YEARS, type DepartmentInfo } from "../types";

interface UserRecord {
  id: string;
  full_name: string;
  username?: string | null;
  email?: string | null;
  role: string;
  national_id?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  department?: string | null;
  academic_year?: string | null;
  section_number?: number | null;
  created_at?: string;
}

interface Subject {
  id: string;
  name: string;
}

const DEPARTMENTS_STORAGE_KEY = "cyber_departments_custom_names";

export function UserList({ role, title }: { role: string; title: string }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const DRAFT_KEY = `cyber_userlist_draft_${role}`;

  // Restore draft so switching to WhatsApp to copy data never loses the form or inputs
  const [showCreate, setShowCreate] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved).showCreate ?? false;
    } catch {
      // fallback
    }
    return false;
  });

  const [submitting, setSubmitting] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Departments list with customized names
  const [deptList, setDeptList] = useState<DepartmentInfo[]>(() => {
    try {
      const stored = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return DEPARTMENTS.map((dept) => ({
          ...dept,
          nameAr: parsed[dept.id] || dept.nameAr,
        }));
      }
    } catch {
      // fallback
    }
    return DEPARTMENTS;
  });

  // Manual User Creation Form Data with draft restore
  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) return parsed.formData;
      }
    } catch {
      // fallback
    }
    return {
      name: "",
      username: "",
      email: "",
      password: "",
      department: "cybersecurity",
      academicYear: "1",
      sectionNumber: "1",
      subjectId: "",
    };
  });

  // Persist draft to sessionStorage whenever user types or toggles the form
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ showCreate, formData }));
    } catch {
      // ignore
    }
  }, [showCreate, formData, DRAFT_KEY]);

  const resetFormAndDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setShowCreate(false);
    setFormData({
      name: "",
      username: "",
      email: "",
      password: "",
      department: "cybersecurity",
      academicYear: "1",
      sectionNumber: "1",
      subjectId: "",
    });
  }, [DRAFT_KEY]);

  // Edit Data
  const [editData, setEditData] = useState({
    name: "",
    department: "",
    academicYear: "",
    sectionNumber: "",
    subjectId: "",
  });

  // Load subjects
  useEffect(() => {
    supabase
      .from("subjects")
      .select("id, name")
      .then(({ data }) => {
        if (data) {
          const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, "ar"));
          setSubjects(sorted);
        }
      });
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("users")
        .select("id, full_name, username, email, role, national_id, subject_id, department, academic_year, section_number, created_at")
        .eq("role", role);

      if (debouncedSearch) {
        query = query.or(
          `full_name.ilike.%${debouncedSearch}%,username.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading users:", error);
        toast.error("فشل تحميل قائمة المستخدمين");
        setUsers([]);
      } else {
        const sortedData = (data ?? []).sort((a, b) =>
          a.full_name.localeCompare(b.full_name, "ar")
        );
        setUsers(sortedData as UserRecord[]);
      }
    } catch (err) {
      console.error(err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [role, debouncedSearch]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // Handle Manual User Creation (Consistent with Join Request requirements)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formData.name.trim();
    const trimmedUsername = formData.username.trim().toLowerCase();
    const trimmedEmail = formData.email.trim().toLowerCase();

    // Validation
    const nameParts = trimmedName.split(/\s+/).filter(Boolean);
    if (nameParts.length < 3) {
      toast.error("يرجى إدخال الاسم ثلاثياً أو رباعياً على الأقل");
      return;
    }

    if (!trimmedUsername || trimmedUsername.length < 3) {
      toast.error("اسم المستخدم يجب أن يكون 3 أحرف على الأقل بدون مسافات");
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      toast.error("اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط");
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("يرجى إدخال بريد إلكتروني صالح");
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    if ((role === "doctor" || role === "ta") && !formData.subjectId) {
      toast.error("يرجى اختيار المادة المسندة");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Try Direct RPC admin_create_user
      const { data: newUserId, error: rpcError } = await supabase.rpc("admin_create_user", {
        p_full_name: trimmedName,
        p_username: trimmedUsername,
        p_email: trimmedEmail,
        p_password: formData.password,
        p_role: role,
        p_department: formData.department,
        p_academic_year: role === "student" ? formData.academicYear : null,
        p_section_number: role === "student" ? parseInt(formData.sectionNumber) : null,
        p_subject_id: (role === "doctor" || role === "ta") && formData.subjectId ? formData.subjectId : null,
      });

      if (rpcError) {
        // Fallback: If RPC not found yet or error, insert join_request and approve it immediately
        console.warn("admin_create_user RPC failed, using auto-approval fallback:", rpcError);

        const { data: joinReq, error: joinErr } = await supabase
          .from("join_requests")
          .insert({
            full_name: trimmedName,
            username: trimmedUsername,
            email: trimmedEmail,
            password: formData.password,
            role: role,
            department: formData.department,
            academic_year: role === "student" ? formData.academicYear : null,
            section_number: role === "student" ? parseInt(formData.sectionNumber) : null,
            status: "pending",
          })
          .select("id")
          .single();

        if (joinErr) {
          if (joinErr.message.includes("duplicate") || joinErr.message.includes("username")) {
            toast.error("اسم المستخدم مسجل بالفعل. يرجى اختيار اسم مستخدم آخر.");
          } else {
            toast.error(`فشل إنشاء المستخدم: ${joinErr.message}`);
          }
          setSubmitting(false);
          return;
        }

        // Approve it immediately
        const { error: approveErr } = await supabase.rpc("approve_join_request", {
          p_request_id: joinReq.id,
          p_temp_password: formData.password,
        });

        if (approveErr) {
          toast.error(`تم إنشاء الطلب ولكن فشل التفعيل المباشر: ${approveErr.message}`);
        } else {
          toast.success(`تمت إضافة الحساب بنجاح لـ ${trimmedName} ✓`);
          resetFormAndDraft();
          void loadUsers();
        }
      } else {
        toast.success(`تمت إضافة الحساب بنجاح لـ ${trimmedName} ✓`);
        resetFormAndDraft();
        void loadUsers();
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error("حدث خطأ أثناء إنشاء المستخدم");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    const { error } = await supabase.rpc("delete_user_by_id", { p_user_id: userId });
    if (error) {
      toast.error(`فشل حذف المستخدم: ${error.message}`);
    } else {
      toast.success(`تم حذف "${name}" بنجاح`);
      setDeleteConfirm(null);
      void loadUsers();
    }
  };

  const startEdit = (user: UserRecord) => {
    setEditingId(user.id);
    setEditData({
      name: user.full_name,
      department: user.department || "cybersecurity",
      academicYear: user.academic_year || "1",
      sectionNumber: user.section_number ? String(user.section_number) : "1",
      subjectId: user.subject_id || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (userId: string) => {
    if (!editData.name || editData.name.trim().length < 3) {
      toast.error("الاسم يجب أن يكون 3 أحرف على الأقل");
      return;
    }
    setSubmitting(true);

    const updatePayload: Record<string, unknown> = {
      full_name: editData.name.trim(),
      department: editData.department,
    };

    if (role === "student") {
      updatePayload.academic_year = editData.academicYear;
      updatePayload.section_number = parseInt(editData.sectionNumber) || 1;
    } else if (role === "doctor" || role === "ta") {
      updatePayload.subject_id = editData.subjectId || null;
    }

    const { error } = await supabase.from("users").update(updatePayload).eq("id", userId);

    if (error) {
      toast.error("فشل تحديث البيانات: " + error.message);
    } else {
      toast.success("تم تحديث البيانات بنجاح ✓");
      setEditingId(null);
      void loadUsers();
    }
    setSubmitting(false);
  };

  const getDepartmentLabel = (deptId?: string | null) => {
    if (!deptId) return "الأمن السيبراني";
    const found = deptList.find((d) => d.id === deptId || d.nameAr === deptId || d.nameEn === deptId);
    return found ? found.nameAr : deptId;
  };

  const getRoleLabel = () => {
    switch (role) {
      case "student":
        return "طالب";
      case "doctor":
        return "دكتور";
      case "ta":
        return "معيد";
      case "coordinator":
        return "رئيس قسم (منسق برنامج)";
      default:
        return "مستخدم";
    }
  };

  return (
    <Card className="bg-card/70 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl" dir="rtl">
      <CardHeader className="p-5 border-b border-white/10 bg-white/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                {title}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {users.length}
                </span>
              </CardTitle>
              <p className="text-xs text-slate-400">إدارة حسابات {getRoleLabel()} والتحكم في بياناتهم</p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
            className={`gap-2 rounded-xl font-bold transition-all ${
              showCreate
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]"
            }`}
          >
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? "إغلاق النموذج" : "إضافة حساب يدوياً"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Manual Creation Form */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <UserCheck className="w-5 h-5 text-purple-400" />
              <h4 className="text-sm font-bold text-white">
                إضافة {getRoleLabel()} جديد (نفس بيانات طلب الانضمام)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">الاسم بالكامل (ثلاثي أو رباعي)*</Label>
                <Input
                  placeholder="مثال: أحمد محمد علي"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={submitting}
                  className="bg-black/50 border-white/10 text-white h-10 rounded-xl"
                  required
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">اسم المستخدم (بالإنجليزي)*</Label>
                <Input
                  placeholder="مثال: ahmed_ali"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={submitting}
                  className="bg-black/50 border-white/10 text-white h-10 rounded-xl dir-ltr text-left"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">البريد الإلكتروني*</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={submitting}
                  className="bg-black/50 border-white/10 text-white h-10 rounded-xl dir-ltr text-left"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">كلمة المرور (6 أحرف فأكثر)*</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="كلمة مرور الحساب"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={submitting}
                    className="bg-black/50 border-white/10 text-white h-10 rounded-xl pl-10 dir-ltr text-left"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">القسم الأكاديمي*</Label>
                <Select
                  value={formData.department}
                  onValueChange={(val) => setFormData({ ...formData, department: val })}
                  disabled={submitting}
                >
                  <SelectTrigger className="bg-black/50 border-white/10 text-white h-10 rounded-xl">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#120d1c] border-purple-500/30 text-white">
                    {deptList.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student specific: Academic Year & Section */}
              {role === "student" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">الفرقة الدراسية*</Label>
                    <Select
                      value={formData.academicYear}
                      onValueChange={(val) => setFormData({ ...formData, academicYear: val })}
                      disabled={submitting}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 text-white h-10 rounded-xl">
                        <SelectValue placeholder="اختر الفرقة" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#120d1c] border-purple-500/30 text-white">
                        {ACADEMIC_YEARS.map((y) => (
                          <SelectItem key={y.id} value={y.id}>
                            {y.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">رقم السكشن (1 - 10)*</Label>
                    <Select
                      value={formData.sectionNumber}
                      onValueChange={(val) => setFormData({ ...formData, sectionNumber: val })}
                      disabled={submitting}
                    >
                      <SelectTrigger className="bg-black/50 border-white/10 text-white h-10 rounded-xl">
                        <SelectValue placeholder="اختر السكشن" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#120d1c] border-purple-500/30 text-white">
                        {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((sec) => (
                          <SelectItem key={sec} value={sec}>
                            سكشن {sec}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Doctor / TA specific: Subject */}
              {(role === "doctor" || role === "ta") && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">المادة الدراسية المسندة*</Label>
                  <Select
                    value={formData.subjectId}
                    onValueChange={(val) => setFormData({ ...formData, subjectId: val })}
                    disabled={submitting}
                  >
                    <SelectTrigger className="bg-black/50 border-white/10 text-white h-10 rounded-xl">
                      <SelectValue placeholder="اختر المادة" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#120d1c] border-purple-500/30 text-white">
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFormAndDraft}
                className="text-slate-400 hover:text-white"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-10 px-6 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    جارٍ الإضافة...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 ml-1" />
                    حفظ الحساب
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="بحث بالاسم أو اسم المستخدم أو البريد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-black/40 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
          />
        </div>

        {/* Users List */}
        <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              <span>جارٍ تحميل المستخدمين...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white/[0.02] border border-white/5 rounded-2xl">
              <Users className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-300">
                {search ? "لا توجد نتائج مطابقة لبحثك." : `لا يوجد مستخدمون مسجلون في قائمة ${title} بعد.`}
              </p>
            </div>
          ) : (
            users.map((user, idx) => (
              <div
                key={user.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-4 transition-all ${
                  editingId === user.id
                    ? "bg-purple-950/40 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                    : "bg-card/50 hover:bg-card/80 border-white/10"
                }`}
              >
                {editingId === user.id ? (
                  /* Edit Mode */
                  <div className="flex-1 w-full space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400">الاسم:</Label>
                        <Input
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          className="bg-black/60 border-white/10 text-white h-9 text-xs rounded-lg"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-slate-400">القسم:</Label>
                        <Select
                          value={editData.department}
                          onValueChange={(val) => setEditData({ ...editData, department: val })}
                        >
                          <SelectTrigger className="bg-black/60 border-white/10 text-white h-9 text-xs rounded-lg">
                            <SelectValue placeholder="القسم" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#120d1c] border-purple-500/30 text-white">
                            {deptList.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {role === "student" && (
                        <>
                          <div>
                            <Label className="text-xs text-slate-400">الفرقة:</Label>
                            <Select
                              value={editData.academicYear}
                              onValueChange={(val) => setEditData({ ...editData, academicYear: val })}
                            >
                              <SelectTrigger className="bg-black/60 border-white/10 text-white h-9 text-xs rounded-lg">
                                <SelectValue placeholder="الفرقة" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#120d1c] border-purple-500/30 text-white">
                                {ACADEMIC_YEARS.map((y) => (
                                  <SelectItem key={y.id} value={y.id}>
                                    {y.nameAr}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs text-slate-400">السكشن:</Label>
                            <Select
                              value={editData.sectionNumber}
                              onValueChange={(val) => setEditData({ ...editData, sectionNumber: val })}
                            >
                              <SelectTrigger className="bg-black/60 border-white/10 text-white h-9 text-xs rounded-lg">
                                <SelectValue placeholder="السكشن" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#120d1c] border-purple-500/30 text-white">
                                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((sec) => (
                                  <SelectItem key={sec} value={sec}>
                                    سكشن {sec}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {(role === "doctor" || role === "ta") && (
                        <div>
                          <Label className="text-xs text-slate-400">المادة المسندة:</Label>
                          <Select
                            value={editData.subjectId}
                            onValueChange={(val) => setEditData({ ...editData, subjectId: val })}
                          >
                            <SelectTrigger className="bg-black/60 border-white/10 text-white h-9 text-xs rounded-lg">
                              <SelectValue placeholder="المادة" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#120d1c] border-purple-500/30 text-white">
                              {subjects.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        role === "student"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : role === "doctor"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : role === "coordinator"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{user.full_name}</span>

                        {/* Role Badge */}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" />
                          {getRoleLabel()}
                        </span>

                        {/* Department Badge */}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5" />
                          {getDepartmentLabel(user.department)}
                        </span>
                      </div>

                      {/* Sub-info: Username, email, academic info */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        {user.username && (
                          <span className="text-slate-300 font-mono text-[11px]" dir="ltr">
                            @{user.username}
                          </span>
                        )}
                        {user.email && (
                          <span className="text-slate-400 flex items-center gap-1 text-[11px]" dir="ltr">
                            <Mail className="w-3 h-3 text-slate-500" />
                            {user.email}
                          </span>
                        )}
                        {role === "student" && user.academic_year && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                            الفرقة {user.academic_year}
                          </span>
                        )}
                        {role === "student" && user.section_number && (
                          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[11px] text-slate-300">
                            سكشن {user.section_number}
                          </span>
                        )}
                        {(role === "doctor" || role === "ta") && user.subject_id && (
                          <span className="flex items-center gap-1 text-purple-300 font-medium">
                            <BookOpen className="w-3.5 h-3.5" />
                            {subjects.find((s) => s.id === user.subject_id)?.name || "مادة مسندة"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {editingId === user.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        className="h-8 px-2 text-slate-400 hover:text-white"
                      >
                        <X className="h-4 w-4 ml-1" />
                        إلغاء
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveEdit(user.id)}
                        disabled={submitting}
                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                      >
                        <CheckCircle className="h-4 w-4 ml-1" />
                        حفظ
                      </Button>
                    </>
                  ) : deleteConfirm?.id === user.id ? (
                    <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded-lg p-1">
                      <span className="text-[11px] text-red-300 px-1">تأكيد الحذف؟</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(null)}
                        className="h-7 w-7 text-slate-400 hover:text-white"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(user.id, user.full_name)}
                        className="h-7 w-7"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(user)}
                        className="h-8 w-8 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg"
                        title="تعديل البيانات"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm({ id: user.id, name: user.full_name })}
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                        title="حذف المستخدم"
                      >
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