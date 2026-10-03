import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { learningRequest } from "../services";
import type { Overview } from "../types";

export function RulesEditor({
  data,
  run,
}: {
  data: Overview;
  run: (operation: () => Promise<unknown>) => void;
}) {
  const [subject, setSubject] = useState(data.subjects[0]?.id ?? "");
  const [kind, setKind] = useState("lecture");
  const existing = data.rules.find((rule) => rule.subject_id === subject && rule.kind === kind);
  const active = data.terms.find((term) => term.id === data.selected_term)?.status === "active";
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <h3 className="font-bold">سياسة الغياب</h3>
      <p className="text-sm text-muted-foreground">
        الحقول الفارغة تعني أن الحد غير مفعّل. لا تفرض المنصة حرمانًا تلقائيًا.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          المادة
          <select
            className="w-full rounded-lg border bg-background p-2"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          >
            {data.subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          نوع الحصة
          <select
            className="w-full rounded-lg border bg-background p-2"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="lecture">محاضرة</option>
            <option value="section">سكشن</option>
          </select>
        </label>
      </div>
      <form
        key={`${subject}:${kind}:${existing?.max_absences}:${existing?.warning_absences}:${existing?.max_percent}:${existing?.warning_percent}:${existing?.excuse_mode}`}
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget));
          run(() =>
            learningRequest("academic_rule", {
              p_department: data.department,
              p_payload: { ...values, term_id: data.selected_term, subject_id: subject, kind },
            }),
          );
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: "warning_absences", label: "تنبيه عند عدد مرات غياب", max: undefined },
              { key: "max_absences", label: "الحد المعتمد لعدد الغياب", max: undefined },
              { key: "warning_percent", label: "تنبيه عند نسبة غياب (%)", max: 100 },
              { key: "max_percent", label: "الحد المعتمد لنسبة الغياب (%)", max: 100 },
            ] as const
          ).map((field) => (
            <label key={field.key} className="text-sm space-y-2 block">
              {field.label}
              <Input
                name={field.key}
                type="number"
                min="1"
                max={field.max}
                step="1"
                defaultValue={existing?.[field.key] ?? ""}
                placeholder="غير مفعّل"
                disabled={!active}
              />
            </label>
          ))}
        </div>
        <label className="block text-sm">
          احتساب العذر المقبول
          <select
            name="excuse_mode"
            defaultValue={existing?.excuse_mode ?? ""}
            disabled={!active}
            className="mt-2 w-full rounded-lg border bg-background p-2"
          >
            <option value="">لم تُحدّد السياسة بعد</option>
            <option value="exclude">استبعاده من إجمالي الحصص المحتسبة</option>
            <option value="count_absent">احتسابه ضمن الغياب</option>
          </select>
        </label>
        <Button type="submit" disabled={!active || !subject}>
          حفظ السياسة
        </Button>
      </form>
    </section>
  );
}
