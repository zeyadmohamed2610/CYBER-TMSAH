import { ACADEMIC_YEARS } from "@/features/academics/types";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  BookOpen,
  Building2,
  CheckCircle,
  Edit2,
  GraduationCap,
  Mail,
  Loader2,
  Shield,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type { useUserManagement } from "../hooks/useUserManagement";
import type { UserRecord } from "../types/management";

interface Props {
  model: ReturnType<typeof useUserManagement>;
  user: UserRecord;
  idx: number;
}
export function UserRow({ model, user, idx }: Props) {
  const {
    editingId,
    editData,
    setEditData,
    deptList,
    viewerRole,
    managedDepartment,
    subjects,
    isDeptMatch,
    currentPage,
    setSelectedUserForDetails,
    getRoleLabel,
    getDepartmentLabel,
    userSubjects,
    cancelEdit,
    saveEdit,
    submitting,
    deleteConfirm,
    deletingId,
    setDeleteConfirm,
    handleDelete,
    startEdit,
  } = model;
  return (
    <div
      key={user.id}
      data-user-id={user.id}
      className={`user-row flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl sm:rounded-none border sm:border-x-0 sm:border-t-0 p-4 transition-colors ${
        editingId === user.id
          ? "bg-primary/5 border-primary/40"
          : "bg-card hover:bg-muted/30 border-border"
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

            {(user.role === "doctor" || user.role === "ta") && viewerRole === "owner" ? (
              <fieldset className="space-y-2">
                <legend className="text-xs text-slate-400">الأقسام المسندة</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {deptList.map((d) => (
                    <label
                      key={d.id}
                      className="flex min-h-11 items-center gap-2 rounded-lg border p-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={editData.departments.includes(d.id)}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            departments: e.target.checked
                              ? [...editData.departments, d.id]
                              : editData.departments.filter((id) => id !== d.id),
                            subjectIds: e.target.checked
                              ? editData.subjectIds
                              : editData.subjectIds.filter(
                                  (id) => subjects.find((s) => s.id === id)?.department !== d.id,
                                ),
                          })
                        }
                      />
                      {d.nameAr}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
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
                    {deptList
                      .filter((d) => viewerRole !== "coordinator" || d.id === managedDepartment)
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nameAr}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {user.role === "student" && (
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
                      {Array.from({ length: 15 }, (_, i) => String(i + 1)).map((sec) => (
                        <SelectItem key={sec} value={sec}>
                          سكشن {sec}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-slate-400">الرقم القومي (14 رقم):</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="14 رقماً"
                    value={editData.nationalId}
                    onChange={(e) =>
                      setEditData({ ...editData, nationalId: e.target.value.replace(/\D/g, "") })
                    }
                    className="bg-black/60 border-white/10 text-white h-9 text-xs rounded-lg font-mono dir-ltr text-left"
                  />
                </div>
              </>
            )}

            {(user.role === "doctor" || user.role === "ta" || user.role === "coordinator") && (
              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-400">المواد المسندة:</Label>
                <div className="rounded-lg border border-white/10 bg-black/40 p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar mt-1">
                  {subjects
                    .filter((s) =>
                      viewerRole === "owner" && (user.role === "doctor" || user.role === "ta")
                        ? editData.departments.some((d) => isDeptMatch(s.department, d))
                        : isDeptMatch(
                            s.department,
                            viewerRole === "coordinator" ? managedDepartment : editData.department,
                          ),
                    )
                    .map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-purple-500/10 rounded px-1.5 py-1 transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded accent-purple-500 cursor-pointer"
                          checked={editData.subjectIds.includes(s.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditData({
                                ...editData,
                                subjectIds: [...editData.subjectIds, s.id],
                              });
                            } else {
                              setEditData({
                                ...editData,
                                subjectIds: editData.subjectIds.filter((id) => id !== s.id),
                              });
                            }
                          }}
                        />
                        <span className="text-[11px] text-slate-200">{s.name}</span>
                      </label>
                    ))}
                  {subjects.filter((s) => isDeptMatch(s.department, editData.department)).length ===
                    0 && (
                    <p className="text-[11px] text-slate-500 text-center py-1">
                      لا توجد مواد لهذا القسم
                    </p>
                  )}
                </div>
                {editData.subjectIds.length > 0 && (
                  <p className="text-[11px] text-purple-400 mt-1">
                    ✓ {editData.subjectIds.length} مادة محددة
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Display Mode */
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
              user.role === "student"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : user.role === "doctor"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : user.role === "coordinator"
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            }`}
          >
            {(currentPage - 1) * 25 + idx + 1}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedUserForDetails(user)}
                className="font-bold text-white text-sm break-words hover:text-purple-300 hover:underline transition-colors text-start cursor-pointer inline-flex items-center gap-1.5 group"
                title="عرض الملف والتفاصيل الكاملة لهذا الحساب"
              >
                <span>{user.full_name}</span>
                <span className="text-[10px] text-purple-400/80 group-hover:text-purple-300 font-normal">
                  (عرض الملف)
                </span>
              </button>

              {/* Role Badge */}
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" />
                {getRoleLabel(user.role)}
              </span>

              {/* Department Badge */}
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5" />
                {(viewerRole === "owner" && user.departments?.length
                  ? user.departments
                  : [viewerRole === "coordinator" ? managedDepartment : user.department]
                )
                  .map((d) => getDepartmentLabel(d))
                  .join("، ")}
              </span>
            </div>

            {/* Sub-info: Username, email, academic info */}
            <div className="flex items-center gap-x-3 gap-y-1 text-sm text-muted-foreground flex-wrap">
              {user.username && (
                <span className="text-slate-300 font-mono text-[11px]" dir="ltr">
                  @{user.username}
                </span>
              )}
              {user.email && (
                <span
                  className="text-muted-foreground flex items-center gap-1 text-xs break-all"
                  dir="ltr"
                >
                  <Mail className="w-3 h-3 text-slate-500" />
                  {user.email}
                </span>
              )}
              {user.role === "student" && user.academic_year && (
                <span className="flex items-center gap-1 text-slate-300">
                  <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                  الفرقة {user.academic_year}
                </span>
              )}
              {user.role === "student" && user.section_number && (
                <span className="px-1.5 py-0.5 rounded bg-white/5 text-[11px] text-slate-300">
                  سكشن {user.section_number}
                </span>
              )}
              {user.role === "student" && (
                <span
                  className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-mono"
                  dir="ltr"
                >
                  {user.national_id || "غير مسجل"}
                </span>
              )}
              {(user.role === "doctor" || user.role === "ta" || user.role === "coordinator") && (
                <div className="flex items-center gap-1 flex-wrap">
                  <BookOpen className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  {(
                    userSubjects[user.id] ??
                    (user.subject_id
                      ? [
                          {
                            id: user.subject_id,
                            name:
                              subjects.find((s) => s.id === user.subject_id)?.name || "مادة مسندة",
                          },
                        ]
                      : [])
                  ).length === 0 ? (
                    <span className="text-slate-500 text-[11px]">لم تُسند له مواد</span>
                  ) : (
                    (
                      userSubjects[user.id] ??
                      (user.subject_id
                        ? [
                            {
                              id: user.subject_id,
                              name:
                                subjects.find((s) => s.id === user.subject_id)?.name ||
                                "مادة مسندة",
                            },
                          ]
                        : [])
                    ).map((s) => (
                      <span
                        key={s.id}
                        className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/20"
                      >
                        {s.name}
                      </span>
                    ))
                  )}
                </div>
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
              aria-label="إلغاء الحذف"
              disabled={deletingId !== null}
              className="h-11 w-11 text-slate-400 hover:text-white"
            >
              <XCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => handleDelete(user.id, user.full_name)}
              aria-label="تأكيد حذف المستخدم"
              disabled={deletingId !== null}
              className="h-11 w-11"
            >
              {deletingId === user.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => startEdit(user)}
              className="h-11 w-11 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg"
              aria-label="تعديل البيانات"
              title="تعديل البيانات"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            {(viewerRole === "owner" || (user.departments?.length ?? 1) <= 1) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteConfirm({ id: user.id, name: user.full_name })}
                className="h-11 w-11 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                aria-label="حذف المستخدم"
                title="حذف المستخدم"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
