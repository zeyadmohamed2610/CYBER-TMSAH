import { scheduleService } from "@/features/schedule/services/scheduleService";
import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { type useAcademicSchedule } from "../hooks/useAcademicSchedule";
import type { AcademicSchedule } from "../utils/academicSchedule";
import { ACADEMIC_DAYS, slotTime } from "../utils/academicSchedule";
import { scheduleDiff } from "../utils/scheduleDiff";
export function ScheduleImportReview({
  model,
  schedule,
}: {
  model: ReturnType<typeof useAcademicSchedule>;
  schedule: AcademicSchedule;
}) {
  const data = schedule;
  const { imported, importReview, busy, run, importRevision, setImported, setImportReview, load } =
    model;
  const settings = data.settings;
  const changes = scheduleDiff(data.entries, imported);
  const [visibleCount, setVisibleCount] = useState(50);
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-bold">معاينة الاستيراد · {imported.length} حصة</h3>
      {importReview?.file_name && (
        <p className="text-sm break-words">الملف: {importReview.file_name}</p>
      )}
      {importReview?.format === "university" && (
        <p className="text-sm text-muted-foreground">
          تمت قراءة {importReview.source_cells} خلية من ورقة {importReview.sheet_name} وتوزيع
          المواعيد على السكاشن المحددة في الملف.
        </p>
      )}
      {importReview?.format === "university" && (
        <p className="text-sm">
          جديدة: {changes.added} · محذوفة: {changes.removed} · معدّلة: {changes.changed} · دون
          تغيير: {changes.unchanged}
        </p>
      )}
      <p className="text-sm">
        {importReview?.format === "university"
          ? `شيت ${importReview.sheet_name} · سيتم استبدال جدول الفرقة ${data.academic_year} بالكامل: حذف الحصص الحالية (${data.entries.length})، بما فيها إضافاتك اليدوية، واعتماد ${imported.length} حصة من الملف. بقية الفرق والامتحانات محفوظة. الحفظ كاملًا أو رفضه كاملًا عند وجود خطأ.`
          : "سيتم تحديث الحصص المطابقة وإضافة الجديدة دون حذف بقية الجدول. الحفظ كاملًا أو رفضه كاملًا عند وجود تعارض."}
      </p>
      {importReview?.warnings.map((warning) => (
        <p key={warning} className="text-sm text-amber-400">
          {warning}
        </p>
      ))}
      {imported.some((e) => e.instructor_name && !e.instructor_id) && (
        <p className="text-sm text-amber-400">
          بعض أسماء المحاضرين للعرض فقط. لا يمنح الاستيراد حسابات أو صلاحيات؛ يمكنك ربط حساباتهم
          المسندة للمواد من تعديل الحصة لاحقًا.
        </p>
      )}
      <div className="max-h-60 overflow-y-auto text-sm break-words">
        {imported.slice(0, visibleCount).map((entry, i) => (
          <p key={i}>
            سكشن {entry.section} · {ACADEMIC_DAYS[entry.day_index]} ·{" "}
            {slotTime(importReview?.start_time ?? settings.start_time, entry.period)}–
            {slotTime(importReview?.start_time ?? settings.start_time, entry.period + 1)} ·{" "}
            {entry.room} · {data.subjects.find((s) => s.id === entry.subject_id)?.name} ·{" "}
            {entry.week_pattern ? `الأسبوع ${entry.week_pattern}` : "كل أسبوع"}
            {importReview?.places[i] && (
              <span className="text-muted-foreground"> · خلية {importReview.places[i]!.cell}</span>
            )}
          </p>
        ))}
      </div>
      {visibleCount < imported.length && (
        <Button variant="outline" onClick={() => setVisibleCount((count) => count + 50)}>
          عرض المزيد من المواعيد ({visibleCount} من {imported.length})
        </Button>
      )}
      <Button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            if (importReview?.format === "university" && !importRevision)
              throw new Error("schedule_changed");
            const result =
              importReview?.format === "university"
                ? await scheduleService.replace({
                    p_department: data.department,
                    p_year: data.academic_year,
                    p_entries: imported.map((entry) => ({
                      ...entry,
                      source_start_time: importReview.start_time,
                    })),
                    p_expected_revision: importRevision,
                  })
                : await scheduleService.importEntries({
                    p_department: data.department,
                    p_year: data.academic_year,
                    p_entries: imported,
                  });
            if (result.error) throw new Error(result.error.message);
            setImported([]);
            setImportReview(null);
            await load();
            toast.success("تم اعتماد الجدول المستورد");
          })
        }
      >
        اعتماد الاستيراد
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          setImported([]);
          setImportReview(null);
        }}
      >
        إلغاء
      </Button>
    </div>
  );
}
