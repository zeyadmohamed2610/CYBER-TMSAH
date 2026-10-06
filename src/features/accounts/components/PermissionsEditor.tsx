import type { UserPermissions } from "@/features/auth/context/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/api/supabaseClient";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Users,
  Layers,
  BookOpenCheck,
  BarChart2,
  CheckCircle2,
  Shield,
  Loader2,
} from "lucide-react";

interface PermDef {
  key: keyof UserPermissions;
  label: string;
  description: string;
  icon: React.ElementType;
}

const PERMISSION_DEFS: PermDef[] = [
  {
    key: "schedule_access",
    label: "الجدول الدراسي",
    description: "عرض الجدول الأسبوعي والجدول اليومي",
    icon: CalendarDays,
  },
  {
    key: "manage_users",
    label: "إدارة المستخدمين",
    description: "إنشاء وتعديل وحذف الحسابات",
    icon: Users,
  },
  {
    key: "manage_departments",
    label: "إدارة الأقسام والمواد",
    description: "إنشاء وتعديل الأقسام والمواد الدراسية",
    icon: Layers,
  },
  {
    key: "manage_lectures",
    label: "إدارة المحاضرات",
    description: "إنشاء وإدارة المحاضرات والسكاشن",
    icon: BookOpenCheck,
  },
  {
    key: "view_reports",
    label: "سجلات الحضور والتقارير",
    description: "عرض وتصدير تقارير الحضور",
    icon: BarChart2,
  },
  {
    key: "manual_attendance",
    label: "التسجيل اليدوي للحضور",
    description: "تصحيح حالات الحضور يدوياً",
    icon: CheckCircle2,
  },
];

interface Props {
  userId: string;
  userName: string;
  userRole: string;
  currentPermissions: UserPermissions;
  onSaved: (newPermissions: UserPermissions, newRole: string) => void;
  onCancel: () => void;
}

export function PermissionsEditor({
  userId,
  userName,
  userRole,
  currentPermissions,
  onSaved,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<UserPermissions>(currentPermissions);
  const [saving, setSaving] = useState(false);

  const toggle = (key: keyof UserPermissions) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const grantedCount = PERMISSION_DEFS.filter((d) => draft[d.key]).length;
  const willPromote = userRole === "coordinator" && grantedCount === PERMISSION_DEFS.length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("update_user_permissions", {
        p_user_id: userId,
        p_permissions: draft,
      });
      if (error) throw new Error(error.message);
      const newRole = willPromote ? "owner" : userRole;
      toast.success(
        willPromote
          ? `تمت ترقية ${userName} إلى مالك المنصة تلقائياً لحصوله على جميع الصلاحيات`
          : `تم تحديث صلاحيات ${userName} بنجاح`,
      );
      onSaved(draft, newRole);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "تعذر تحديث الصلاحيات. أعد المحاولة.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h4 className="font-bold text-sm">
          صلاحيات{" "}
          <span className="text-primary">{userName}</span>
        </h4>
        <span className="text-[10px] text-muted-foreground">
          ({grantedCount}/{PERMISSION_DEFS.length} منحوح)
        </span>
      </div>

      {/* Promotion warning */}
      {willPromote && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          ⚠️ منح كل الصلاحيات لمنسق سيرفع رتبته تلقائياً إلى <strong>مالك المنصة</strong>
        </div>
      )}

      {/* Permission checkboxes */}
      <div className="grid gap-2 sm:grid-cols-2">
        {PERMISSION_DEFS.map(({ key, label, description, icon: Icon }) => {
          const granted = !!draft[key];
          return (
            <label
              key={key}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                granted
                  ? "border-primary/40 bg-primary/10"
                  : "border-border hover:border-primary/20 hover:bg-muted/30"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded accent-purple-500 cursor-pointer"
                checked={granted}
                onChange={() => toggle(key)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${granted ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-semibold ${granted ? "text-white" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{description}</p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          إلغاء
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/80 text-white font-bold"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />
          ) : (
            <Shield className="h-3.5 w-3.5 ml-1" />
          )}
          حفظ الصلاحيات
        </Button>
      </div>
    </div>
  );
}
