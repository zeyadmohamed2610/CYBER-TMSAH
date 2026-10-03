import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { learningRequest } from "../services";
import type { Overview } from "../types";

export function TermManager({
  data,
  run,
}: {
  data: Overview;
  run: (operation: () => Promise<unknown>) => void;
}) {
  const selected = data.terms.find((term) => term.id === data.selected_term);
  const changeTerm = (action: "close" | "activate") => {
    const message =
      action === "close"
        ? "إغلاق الفصل يحفظ النتائج ويوقف تعديل حضور هذا الفصل. هل تريد المتابعة؟"
        : "بدء الفصل الجديد يفرغ الجدول الحالي والامتحانات بعد أرشفتها. هل تريد المتابعة؟";
    if (window.confirm(message))
      run(() =>
        learningRequest("academic_term", {
          p_department: data.department,
          p_action: action,
          p_payload: { id: selected?.id },
        }),
      );
  };
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <h3 className="font-bold">الفصول الدراسية</h3>
      <p className="text-sm text-muted-foreground">
        النتائج القديمة تحتفظ بفرقة الطالب وسكشنه وقت الحضور. راجع الطلبات المعلقة قبل إغلاق الفصل.
      </p>
      {selected?.status === "active" && (
        <Button variant="outline" onClick={() => changeTerm("close")}>
          إغلاق {selected.name} وأرشفة نتائجه
        </Button>
      )}
      {selected?.status === "draft" && (
        <Button
          onClick={() => changeTerm("activate")}
          disabled={data.terms.some((term) => term.status === "active")}
        >
          بدء هذا الفصل
        </Button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const values = Object.fromEntries(new FormData(form));
          run(async () => {
            await learningRequest("academic_term", {
              p_department: data.department,
              p_action: "create",
              p_payload: values,
            });
            form.reset();
          });
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className="text-sm">
          اسم الفصل
          <Input name="name" required maxLength={120} placeholder="مثال: الفصل الأول" />
        </label>
        <label className="text-sm">
          العام الجامعي
          <Input name="academic_year_label" maxLength={80} placeholder="مثال: 2026 / 2027" />
        </label>
        <label className="text-sm">
          تاريخ البداية (اختياري)
          <Input name="starts_on" type="date" />
        </label>
        <label className="text-sm">
          تاريخ النهاية (اختياري)
          <Input name="ends_on" type="date" />
        </label>
        <Button type="submit">إضافة فصل للتحضير</Button>
      </form>
    </section>
  );
}
