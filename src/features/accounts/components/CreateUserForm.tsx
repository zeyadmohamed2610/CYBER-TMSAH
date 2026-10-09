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
import { Eye, EyeOff, Loader2, Plus, UserCheck } from "lucide-react";
import type { useUserManagement } from "../hooks/useUserManagement";

interface Props {
  model: ReturnType<typeof useUserManagement>;
}
export function CreateUserForm({ model }: Props) {
  const {
    handleCreate,
    role,
    setRole,
    submitting,
    allowedRoles,
    getRoleLabel,
    formData,
    setFormData,
    showPassword,
    setShowPassword,
    deptList,
    viewerRole,
    managedDepartment,
    subjects,
    isDeptMatch,
    resetFormAndDraft,
  } = model;
  return (
    <form
      onSubmit={handleCreate}
      className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="space-y-2">
        <Label htmlFor="create-user-role">رتبة الحساب</Label>
        <select
          id="create-user-role"
          className="w-full h-11 rounded-lg border border-input bg-background px-3"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          disabled={submitting}
        >
          {allowedRoles.map((value) => (
            <option key={value} value={value}>
              {getRoleLabel(value)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 pb-2 border-b border-white/10">
        <UserCheck className="w-5 h-5 text-purple-400" />
        <h4 className="text-sm font-bold text-white">إضافة حساب جديد</h4>
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
          <Label className="text-xs text-slate-300">كلمة المرور (8 أحرف فأكثر)*</Label>
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
              <Label className="text-xs text-slate-300">رقم السكشن (1 - 15)*</Label>
              <Select
                value={formData.sectionNumber}
                onValueChange={(val) => setFormData({ ...formData, sectionNumber: val })}
                disabled={submitting}
              >
                <SelectTrigger className="bg-black/50 border-white/10 text-white h-10 rounded-xl">
                  <SelectValue placeholder="اختر السكشن" />
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

            {/* National ID - required for students */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">الرقم القومي (14 رقم)*</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={14}
                placeholder="مثال: 30110199901234"
                value={formData.nationalId}
                onChange={(e) =>
                  setFormData({ ...formData, nationalId: e.target.value.replace(/\D/g, "") })
                }
                disabled={submitting}
                className="bg-black/50 border-white/10 text-white h-10 rounded-xl dir-ltr text-left font-mono tracking-wider"
                required
              />
              {formData.nationalId.length > 0 && formData.nationalId.length !== 14 && (
                <p className="text-[11px] text-red-400">{formData.nationalId.length}/14 رقم</p>
              )}
              {formData.nationalId.length === 14 && (
                <p className="text-[11px] text-emerald-400">✓ الرقم صحيح</p>
              )}
            </div>
          </>
        )}

        {/* Doctor / TA / Coordinator specific: Subject (multi-select filtered by department) */}
        {(role === "doctor" || role === "ta" || role === "coordinator") && (
          <div className="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-3">
            <Label className="text-xs text-slate-300">
              المواد الدراسية المسندة {role === "coordinator" ? "(اختياري لمدرس القسم)" : "*"} (اختر
              مادة أو أكثر من قسمك)
            </Label>
            <div className="rounded-xl border border-white/10 bg-black/50 p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {subjects.filter((s) => isDeptMatch(s.department, formData.department)).length ===
              0 ? (
                <p className="text-xs text-slate-500 text-center py-2">
                  لا توجد مواد مسجلة لهذا القسم بعد. أضف مواد من تبويب الأقسام.
                </p>
              ) : (
                subjects
                  .filter((s) => isDeptMatch(s.department, formData.department))
                  .map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2.5 cursor-pointer group hover:bg-purple-500/10 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-white/20 bg-black/40 accent-purple-500 cursor-pointer"
                        checked={formData.subjectIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              subjectIds: [...formData.subjectIds, s.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              subjectIds: formData.subjectIds.filter((id: string) => id !== s.id),
                            });
                          }
                        }}
                        disabled={submitting}
                      />
                      <span className="text-xs text-slate-200 group-hover:text-white transition-colors">
                        {s.name}
                      </span>
                    </label>
                  ))
              )}
            </div>
            {formData.subjectIds.length > 0 && (
              <p className="text-[11px] text-purple-400">
                ✓ تم اختيار {formData.subjectIds.length} مادة
              </p>
            )}
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
  );
}
