import { useState, useEffect, useCallback } from "react";
import {
  FolderKanban,
  Plus,
  BookOpen,
  Edit2,
  Trash2,
  Save,
  X,
  Users,
  Search,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { DEPARTMENTS, type DepartmentInfo } from "../types";

interface SubjectItem {
  id: string;
  name: string;
  department?: string;
  doctor_name?: string;
  created_at?: string;
}

const DEPARTMENTS_STORAGE_KEY = "cyber_departments_custom_names";

export const DepartmentsAndSubjectsPanel = () => {
  const [departments, setDepartments] = useState<DepartmentInfo[]>(() => {
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

  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptNameInput, setDeptNameInput] = useState("");

  const [selectedDept, setSelectedDept] = useState<DepartmentInfo | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [searchSubject, setSearchSubject] = useState("");

  // New Subject Form
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);

  // Edit Subject
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");

  // Load subjects for selected department
  const loadSubjects = useCallback(async (dept: DepartmentInfo) => {
    setLoadingSubjects(true);
    try {
      // Fetch subjects
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, doctor_name, department, created_at");

      if (error) {
        toast.error("فشل تحميل المواد الدراسية");
        setSubjects([]);
      } else {
        // Filter subjects belonging to this department, or unassigned ones
        const allSubjects = (data as SubjectItem[]) || [];
        const deptSubjects = allSubjects.filter(
          (s) => !s.department || s.department === dept.id
        );
        setSubjects(deptSubjects);
      }
    } catch {
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDept) {
      void loadSubjects(selectedDept);
    }
  }, [selectedDept, loadSubjects]);

  // Save modified department name
  const handleSaveDeptName = (deptId: string) => {
    if (!deptNameInput.trim()) {
      toast.error("يرجى إدخال اسم القسم");
      return;
    }

    setDepartments((prev) => {
      const updated = prev.map((d) =>
        d.id === deptId ? { ...d, nameAr: deptNameInput.trim() } : d
      );
      try {
        const map: Record<string, string> = {};
        updated.forEach((d) => {
          map[d.id] = d.nameAr;
        });
        localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(map));
      } catch {
        // ignore
      }
      return updated;
    });

    toast.success("تم تحديث اسم القسم بنجاح");
    setEditingDeptId(null);
  };

  // Add new subject
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      toast.error("يرجى كتابة اسم المادة الدراسية");
      return;
    }

    setAddingSubject(true);
    try {
      const { data, error } = await supabase
        .from("subjects")
        .insert({
          name: newSubjectName.trim(),
          doctor_name: "غير محدد",
          department: selectedDept?.id || null,
        })
        .select()
        .single();

      if (error) {
        toast.error(`فشل إضافة المادة: ${error.message}`);
      } else {
        toast.success(`تمت إضافة مادة "${newSubjectName}" بنجاح`);
        setSubjects((prev) => [data as SubjectItem, ...prev]);
        setNewSubjectName("");
        setShowAddSubject(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      toast.error(msg);
    } finally {
      setAddingSubject(false);
    }
  };

  // Update Subject Name
  const handleUpdateSubject = async (id: string) => {
    if (!editSubjectName.trim()) return;

    try {
      const { error } = await supabase
        .from("subjects")
        .update({ name: editSubjectName.trim() })
        .eq("id", id);

      if (error) {
        toast.error("فشل تعديل اسم المادة");
      } else {
        toast.success("تم تعديل اسم المادة بنجاح");
        setSubjects((prev) =>
          prev.map((s) => (s.id === id ? { ...s, name: editSubjectName.trim() } : s))
        );
        setEditingSubjectId(null);
      }
    } catch {
      toast.error("حدث خطأ أثناء التعديل");
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف مادة "${name}" نهائياً؟`)) return;

    try {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) {
        toast.error(`تعذر حذف المادة: ${error.message}`);
      } else {
        toast.success(`تم حذف مادة "${name}"`);
        setSubjects((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  const filteredSubjects = subjects.filter((s) =>
    s.name.toLowerCase().includes(searchSubject.trim().toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header Banner */}
      <div className="rounded-2xl border border-purple-500/25 bg-gradient-to-r from-purple-950/40 via-[#0B0F1D]/80 to-indigo-950/30 p-5 backdrop-blur-xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>الهيكل الأكاديمي</span>
          </div>
          <h2 className="text-xl font-black text-white">إدارة الأقسام والمواد الدراسية</h2>
          <p className="text-xs text-slate-400 mt-1">
            إدارة وتعديل الأقسام الـ 7 الأكاديمية وإضافة وحذف المواد وتسكين أعضاء هيئة التدريس
          </p>
        </div>
      </div>

      {/* Departments Grid (7 Departments) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {departments.map((dept, index) => {
          const isEditing = editingDeptId === dept.id;

          return (
            <div
              key={dept.id}
              className="group relative rounded-2xl border border-white/10 bg-[#0A0F1D]/80 p-5 backdrop-blur-xl hover:border-purple-500/40 hover:shadow-[0_12px_36px_rgba(147,51,234,0.18)] transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                    قسم #{index + 1}
                  </span>
                </div>

                {isEditing ? (
                  <div className="space-y-2 mb-3">
                    <Input
                      value={deptNameInput}
                      onChange={(e) => setDeptNameInput(e.target.value)}
                      className="h-9 text-xs bg-black/40 border-purple-500/50 text-white"
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => handleSaveDeptName(dept.id)}
                        className="h-7 px-2.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px]"
                      >
                        <Save className="w-3 h-3 ml-1" />
                        حفظ
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingDeptId(null)}
                        className="h-7 px-2 text-slate-400 text-[11px]"
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-white group-hover:text-purple-300 transition-colors">
                        {dept.nameAr}
                      </h3>
                      <button
                        onClick={() => {
                          setEditingDeptId(dept.id);
                          setDeptNameInput(dept.nameAr);
                        }}
                        className="text-slate-400 hover:text-white p-1 transition-colors"
                        title="تعديل اسم القسم"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5" dir="ltr">
                      {dept.nameEn}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button: View & Manage Subjects */}
              <Button
                onClick={() => setSelectedDept(dept)}
                className="w-full h-9 rounded-xl bg-purple-600/15 border border-purple-500/30 hover:bg-purple-600 hover:text-white text-purple-300 text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>إدارة المواد الدراسية</span>
              </Button>
            </div>
          );
        })}
      </div>

      {/* ── Modal / Drawer: Subjects of the Selected Department ── */}
      {selectedDept && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-up overflow-y-auto"
          dir="rtl"
        >
          <div className="relative w-full max-w-2xl my-auto rounded-3xl border border-purple-500/30 bg-[#0A0F1D]/95 backdrop-blur-2xl p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.85)] space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    مواد {selectedDept.nameAr}
                  </h3>
                  <p className="text-xs text-slate-400">
                    قائمة المقررات المسجلة وإمكانية إضافة وتعديل وحذف المقررات
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedDept(null);
                  setShowAddSubject(false);
                }}
                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchSubject}
                  onChange={(e) => setSearchSubject(e.target.value)}
                  placeholder="ابحث عن مادة..."
                  className="pr-9 h-10 rounded-xl bg-black/40 border-white/10 text-xs text-white placeholder:text-slate-500 focus:border-purple-500"
                />
              </div>

              <Button
                onClick={() => setShowAddSubject((v) => !v)}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(147,51,234,0.3)] flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مادة جديدة</span>
              </Button>
            </div>

            {/* Add Subject Inline Form */}
            {showAddSubject && (
              <form
                onSubmit={handleAddSubject}
                className="rounded-2xl border border-purple-500/40 bg-purple-950/20 p-4 space-y-3 animate-fade-up"
              >
                <h4 className="text-xs font-bold text-purple-300">إضافة مقرر دراسي جديد</h4>
                <div className="flex items-center gap-2">
                  <Input
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="اسم المادة (مثال: أمن شبكات، نظم تشغيل...)"
                    className="h-10 text-xs bg-black/40 border-white/15 text-white focus:border-purple-500"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={addingSubject}
                    className="h-10 px-5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shrink-0"
                  >
                    {addingSubject ? "جارٍ الإضافة..." : "حفظ المادة"}
                  </Button>
                </div>
              </form>
            )}

            {/* Subjects List */}
            <div className="max-h-[360px] overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
              {loadingSubjects ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  جارٍ تحميل المواد الدراسية...
                </div>
              ) : filteredSubjects.length === 0 ? (
                <div className="py-8 text-center rounded-2xl border border-dashed border-white/10 p-6 text-xs text-slate-400">
                  لا توجد مواد مسجلة لهذا القسم حالياً. يمكنك إضافة مادة جديدة من الزر أعلاه.
                </div>
              ) : (
                filteredSubjects.map((subject) => {
                  const isEditingThis = editingSubjectId === subject.id;

                  return (
                    <div
                      key={subject.id}
                      className="rounded-xl border border-white/10 bg-black/40 p-3.5 flex items-center justify-between gap-3 hover:border-purple-500/30 transition-all"
                    >
                      {isEditingThis ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={editSubjectName}
                            onChange={(e) => setEditSubjectName(e.target.value)}
                            className="h-8 text-xs bg-black/60 border-purple-500 text-white"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleUpdateSubject(subject.id)}
                            className="h-8 px-3 bg-purple-600 text-white text-xs"
                          >
                            حفظ
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingSubjectId(null)}
                            className="h-8 px-2 text-slate-400 text-xs"
                          >
                            إلغاء
                          </Button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white truncate">
                              {subject.name}
                            </span>
                            {subject.doctor_name && subject.doctor_name !== "غير محدد" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold shrink-0">
                                د. {subject.doctor_name}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {!isEditingThis && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              setEditingSubjectId(subject.id);
                              setEditSubjectName(subject.name);
                            }}
                            className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                            title="تعديل اسم المادة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubject(subject.id, subject.name)}
                            className="w-8 h-8 rounded-lg border border-rose-500/20 flex items-center justify-center text-rose-400 hover:bg-rose-500/15 transition-all"
                            title="حذف المادة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-white/10 flex justify-end">
              <Button
                variant="ghost"
                onClick={() => setSelectedDept(null)}
                className="text-xs text-slate-300 hover:text-white hover:bg-white/5"
              >
                إغلاق النافذة
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
