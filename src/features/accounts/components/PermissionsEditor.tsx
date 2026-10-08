import type { UserPermissions } from "@/features/auth/context/AuthContext";
import { supabase } from "@/shared/api/supabaseClient";
import { Button } from "@/shared/components/ui/button";
import { CalendarDays, Loader2, Shield } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

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
  const [scheduleAccess, setScheduleAccess] = useState(currentPermissions.schedule_access === true);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const handleSave = async () => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    const permissions = { schedule_access: scheduleAccess };
    try {
      const { error } = await supabase.rpc("update_user_permissions", {
        p_user_id: userId,
        p_permissions: permissions,
      });
      if (error) throw error;
      toast.success("تم تحديث صلاحيات الجدول الدراسي");
      onSaved(permissions, userRole);
    } catch {
      toast.error("تعذر تحديث الصلاحيات. تحقق من اتصالك وصلاحية حسابك ثم أعد المحاولة.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return (
    <section
      dir="rtl"
      aria-label={`صلاحيات ${userName}`}
      className="w-full min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-background p-4 space-y-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Shield className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold break-words">صلاحيات {userName}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            صلاحيات الإدارة والحضور تحددها رتبة الحساب والمواد المسندة إليه. تعديل هذا الخيار لا
            يغيّر الرتبة.
          </p>
        </div>
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer">
        <CalendarDays className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="flex-1 min-w-0 text-sm">السماح بعرض الجدول الدراسي داخل نطاق الحساب</span>
        <input
          type="checkbox"
          checked={scheduleAccess}
          onChange={(event) => setScheduleAccess(event.target.checked)}
          disabled={saving}
          className="h-5 w-5 shrink-0 accent-purple-600"
        />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          إلغاء
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? "جارٍ الحفظ…" : "حفظ الصلاحيات"}
        </Button>
      </div>
    </section>
  );
}
