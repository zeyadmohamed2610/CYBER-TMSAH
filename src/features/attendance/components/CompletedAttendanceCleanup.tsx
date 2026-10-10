import { supabase } from "@/shared/api/supabaseClient";
import { Button } from "@/shared/components/ui/button";
import { ConfirmAction } from "@/shared/components/ui/confirm-action";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
interface Props {
  mode: "units" | "sessions";
  lectureId?: string;
  subjectId?: string | undefined;
  onComplete: () => void | Promise<void>;
}
export function CompletedAttendanceCleanup({ mode, lectureId, subjectId, onComplete }: Props) {
  const [busy, setBusy] = useState(false),
    [count, setCount] = useState(0);
  const before = useRef<string | null>(null);
  const label = mode === "units" ? "حذف الحصص المنتهية" : "حذف الجلسات المنتهية";
  const params = { p_mode: mode, p_lecture_id: lectureId ?? null, p_subject_id: subjectId ?? null };
  const preview = async (open: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await supabase.rpc("cleanup_completed_attendance", {
        ...params,
        p_preview: true,
        p_before: null,
      });
      if (result.error) throw result.error;
      const summary = result.data as { count: number; before: string };
      if (!summary.count) {
        toast.info("لا توجد سجلات منتهية قابلة للحذف في نطاقك.");
        return;
      }
      before.current = summary.before;
      setCount(summary.count);
      open();
    } catch (error) {
      toast.error(
        getFriendlyErrorMessage(error instanceof Error ? error.message : "تعذر معاينة الحذف."),
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!before.current) return;
    setBusy(true);
    try {
      const result = await supabase.rpc("cleanup_completed_attendance", {
        ...params,
        p_preview: false,
        p_before: before.current,
      });
      if (result.error) throw result.error;
      toast.success(`تم حذف ${(result.data as { count: number }).count} من السجلات المنتهية.`);
      await onComplete();
    } catch (error) {
      toast.error(
        getFriendlyErrorMessage(error instanceof Error ? error.message : "تعذر إتمام الحذف."),
      );
    } finally {
      before.current = null;
      setBusy(false);
    }
  };
  return (
    <ConfirmAction
      title={label}
      description={`سيُحذف ${count} من ${mode === "units" ? "الحصص المنتهية وجلساتها" : "الجلسات المنتهية"} مع سجلات الحضور المرتبطة نهائيًا. صدّر ما تحتاجه أولًا. الجلسات النشطة وأرشيف الفصول المغلقة محفوظان.`}
      confirmLabel="حذف نهائي"
      detailed
      onConfirm={remove}
    >
      {(open) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void preview(open)}
          className="gap-2 text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          {busy ? "جارٍ المعاينة..." : label}
        </Button>
      )}
    </ConfirmAction>
  );
}
