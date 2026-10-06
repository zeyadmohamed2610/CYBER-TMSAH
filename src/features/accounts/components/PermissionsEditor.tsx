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
  Check,
} from "lucide-react";

interface PermDef {
  key: keyof UserPermissions;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const PERMISSION_DEFS: PermDef[] = [
  {
    key: "schedule_access",
    label: "الجدول الدراسي",
    description: "عرض الجدول الأسبوعي واليومي",
    icon: CalendarDays,
    color: "blue",
  },
  {
    key: "manage_users",
    label: "إدارة المستخدمين",
    description: "إنشاء وتعديل وحذف الحسابات",
    icon: Users,
    color: "purple",
  },
  {
    key: "manage_departments",
    label: "الأقسام والمواد",
    description: "إنشاء وتعديل الأقسام والمواد",
    icon: Layers,
    color: "cyan",
  },
  {
    key: "manage_lectures",
    label: "إدارة المحاضرات",
    description: "إنشاء وإدارة المحاضرات",
    icon: BookOpenCheck,
    color: "emerald",
  },
  {
    key: "view_reports",
    label: "سجلات الحضور",
    description: "عرض وتصدير تقارير الحضور",
    icon: BarChart2,
    color: "amber",
  },
  {
    key: "manual_attendance",
    label: "التسجيل اليدوي",
    description: "تصحيح حالات الحضور يدوياً",
    icon: CheckCircle2,
    color: "rose",
  },
];

const colorMap: Record<string, { bg: string; border: string; icon: string; check: string }> = {
  blue:    { bg: "bg-blue-500/15",    border: "border-blue-500/40",    icon: "text-blue-400",    check: "bg-blue-500"    },
  purple:  { bg: "bg-purple-500/15",  border: "border-purple-500/40",  icon: "text-purple-400",  check: "bg-purple-500"  },
  cyan:    { bg: "bg-cyan-500/15",    border: "border-cyan-500/40",    icon: "text-cyan-400",    check: "bg-cyan-500"    },
  emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/40", icon: "text-emerald-400", check: "bg-emerald-500" },
  amber:   { bg: "bg-amber-500/15",   border: "border-amber-500/40",   icon: "text-amber-400",   check: "bg-amber-500"   },
  rose:    { bg: "bg-rose-500/15",    border: "border-rose-500/40",    icon: "text-rose-400",    check: "bg-rose-500"    },
};

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
          ? `تمت ترقية ${userName} إلى مالك المنصة تلقائياً`
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
    <div
      dir="rtl"
      className="rounded-2xl border border-white/10 bg-[#0f0f1a] shadow-xl overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8 bg-white/[0.03]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none">
              صلاحيات{" "}
              <span className="text-primary">{userName}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {grantedCount} من {PERMISSION_DEFS.length} صلاحيات ممنوحة
            </p>
          </div>
        </div>

        {/* Progress pills */}
        <div className="hidden sm:flex items-center gap-1">
          {PERMISSION_DEFS.map((d) => (
            <div
              key={d.key}
              className={`h-1.5 w-5 rounded-full transition-all ${
                draft[d.key] ? colorMap[d.color].check : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Promotion warning ── */}
      {willPromote && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
          <span className="text-base">⚠️</span>
          منح كل الصلاحيات للمنسق سيرفع رتبته تلقائياً إلى{" "}
          <strong>مالك المنصة</strong>
        </div>
      )}

      {/* ── Permission grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4">
        {PERMISSION_DEFS.map(({ key, label, description, icon: Icon, color }) => {
          const granted = !!draft[key];
          const c = colorMap[color];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`group relative flex items-start gap-3 rounded-xl border p-3.5 text-right transition-all duration-150 cursor-pointer w-full
                ${granted
                  ? `${c.bg} ${c.border} shadow-sm`
                  : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15"
                }`}
              aria-pressed={granted}
            >
              {/* Icon */}
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors
                  ${granted ? `${c.bg} ${c.border}` : "bg-white/5 border-white/10"}`}
              >
                <Icon className={`h-4.5 w-4.5 ${granted ? c.icon : "text-muted-foreground"}`} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-snug ${granted ? "text-white" : "text-muted-foreground"}`}>
                  {label}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                  {description}
                </p>
              </div>

              {/* Custom checkbox */}
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all
                  ${granted
                    ? `${c.check} border-transparent`
                    : "border-white/20 bg-transparent group-hover:border-white/40"
                  }`}
              >
                {granted && <Check className="h-3 w-3 text-white stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-2 border-t border-white/8 bg-white/[0.02] px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
          className="text-muted-foreground hover:text-white"
        >
          إلغاء
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-white font-bold gap-2 min-w-[130px]"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
          {saving ? "جارٍ الحفظ…" : "حفظ الصلاحيات"}
        </Button>
      </div>
    </div>
  );
}
