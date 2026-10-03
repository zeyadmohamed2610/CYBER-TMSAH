import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { learningRequest } from "../services";
import type { AttendanceCase, Overview } from "../types";
import { CaseAttachment } from "./CaseAttachment";

const labels = {
  excuse: "عذر غياب",
  appeal: "مراجعة تسجيل الحضور",
  device: "مشكلة في الجهاز",
  connection: "مشكلة اتصال",
};
const states = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
function ReviewCase({
  item,
  run,
}: {
  item: AttendanceCase;
  run: (operation: () => Promise<unknown>) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        سبب القرار
        <textarea
          className="mt-2 w-full rounded-lg border bg-background p-3"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={3}
          maxLength={1000}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {(["approved", "rejected"] as const).map((status) => (
          <Button
            key={status}
            variant={status === "approved" ? "default" : "outline"}
            disabled={reason.trim().length < 3}
            onClick={() =>
              run(() =>
                learningRequest("academic_case", {
                  p_action: "decide",
                  p_payload: { id: item.id, version: item.version, status, reason },
                }),
              )
            }
          >
            {status === "approved" ? "قبول الطلب" : "رفض الطلب"}
          </Button>
        ))}
      </div>
    </div>
  );
}
export function CasesPanel({
  data,
  student,
  run,
}: {
  data: Overview;
  student: boolean;
  run: (operation: () => Promise<unknown>) => void;
}) {
  return (
    <section className="space-y-4">
      {student && data.absences.length > 0 && (
        <form
          className="rounded-2xl border bg-card p-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = Object.fromEntries(new FormData(form));
            run(async () => {
              await learningRequest("academic_case", { p_action: "create", p_payload: values });
              form.reset();
            });
          }}
        >
          <h3 className="font-bold">طلب مراجعة أو تقديم عذر</h3>
          <label className="block text-sm">
            الحصة
            <select name="unit_id" className="mt-2 w-full rounded-lg border bg-background p-2">
              {data.absences.map((item) => (
                <option key={item.unit_id} value={item.unit_id}>
                  {item.subject_name} · {item.lecture_date} · {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            نوع الطلب
            <select name="request_type" className="mt-2 w-full rounded-lg border bg-background p-2">
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            اشرح السبب
            <textarea
              name="reason"
              required
              minLength={5}
              maxLength={2000}
              className="mt-2 w-full rounded-lg border bg-background p-3"
            />
          </label>
          <p className="text-sm text-muted-foreground">
            إرسال الطلب لا يسجل حضورك تلقائيًا. يراجعه المسؤول وتظهر النتيجة هنا.
          </p>
          <Button type="submit">إرسال الطلب</Button>
        </form>
      )}
      {data.cases.length === 0 && (
        <p className="rounded-2xl border p-5 text-muted-foreground">
          لا توجد طلبات مراجعة لهذا الفصل.
        </p>
      )}
      {data.cases.map((item) => (
        <article key={item.id} className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <h3 className="font-bold">
              {item.subject_name} · {labels[item.request_type]}
            </h3>
            <span>{states[item.status]}</span>
          </div>
          {!student && <p>{item.student_name}</p>}
          <p className="whitespace-pre-wrap break-words text-sm">{item.reason}</p>
          <CaseAttachment item={item} student={student} run={run} />
          {item.decision_reason && (
            <p className="text-sm text-muted-foreground">سبب القرار: {item.decision_reason}</p>
          )}
          {!student && item.status === "pending" && <ReviewCase item={item} run={run} />}
        </article>
      ))}
    </section>
  );
}
