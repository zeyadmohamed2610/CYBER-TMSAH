import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { ACADEMIC_DAYS, slotTime, type AcademicEntry } from "../utils/academicSchedule";
import type { Timetable } from "../utils/timetable";
import { cn } from "@/shared/lib/utils";

interface Props {
  model: Timetable;
  selectedDay: number | null;
  busy?: boolean;
  onEdit?: (entry: AcademicEntry) => void;
  onDelete?: (entry: AcademicEntry) => void;
}
export function ScheduleMatrix({ model, selectedDay, busy, onEdit, onDelete }: Props) {
  const { data, days, section, allSections } = model;
  const [small, setSmall] = useState(() => window.innerWidth < 640);
  const columns =
    selectedDay === null
      ? days
      : allSections
        ? Array.from({ length: 15 }, (_, i) => i + 1)
        : [section];
  const size = small ? (selectedDay === null ? 2 : 3) : selectedDay === null ? 7 : 5;
  const count = Math.max(1, Math.ceil(columns.length / size));
  const initialDay =
    model.search && model.lessons.length
      ? days.find((day) => model.lessons.some((lesson) => lesson.day === day))!
      : new Date(`${model.date}T00:00:00Z`).getUTCDay();
  const initialPage =
    selectedDay === null ? Math.floor(Math.max(0, days.indexOf(initialDay)) / size) : 0;
  const [page, setPage] = useState(initialPage);
  useEffect(() => {
    const resize = () => setSmall(window.innerWidth < 640);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const currentPage = Math.max(0, Math.min(page, count - 1));
  const visible = columns.slice(currentPage * size, (currentPage + 1) * size);
  const available = model.lessons.filter(
    (lesson) => selectedDay === null || lesson.day === selectedDay,
  );
  const last = Math.max(1, ...available.map((lesson) => lesson.period));
  const first = Math.min(last, ...available.map((lesson) => lesson.period));
  return (
    <section aria-label="مصفوفة الجدول" className="space-y-2">
      {count > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            السابق
          </Button>
          <p className="text-xs text-muted-foreground">
            {selectedDay === null ? "الأيام" : "السكاشن"}: {currentPage * size + 1}–
            {Math.min((currentPage + 1) * size, columns.length)} من {columns.length}
          </p>
          <Button
            variant="outline"
            disabled={currentPage === count - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            التالي
          </Button>
        </div>
      )}
      <table
        className="w-full table-fixed border-collapse text-xs"
        aria-label={
          selectedDay === null
            ? "مصفوفة الأسبوع حسب الوقت واليوم"
            : "مصفوفة اليوم حسب الوقت والسكشن"
        }
      >
        <caption className="sr-only">
          الحصص مرتبة حسب التوقيت؛ الأماكن والأسابيع حسب الجدول المعتمد.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-14 border border-border bg-muted/40 p-2">
              الوقت
            </th>
            {visible.map((column) => (
              <th scope="col" key={column} className="border border-border bg-muted/40 p-2">
                {selectedDay === null ? ACADEMIC_DAYS[column] : `سكشن ${column}`}
                {selectedDay === null && (
                  <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                    {model.dateForDay(column)} · أسبوع {model.cycleForDay(column)}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: last - first + 1 }, (_, i) => first + i).map((period) => (
            <tr key={period}>
              <th scope="row" className="border border-border p-1 align-top font-normal">
                <time dir="ltr">{slotTime(data.settings.start_time, period)}</time>
                <span className="block text-muted-foreground">–</span>
                <time dir="ltr">{slotTime(data.settings.start_time, period + 1)}</time>
              </th>
              {visible.map((column) => {
                const day = selectedDay ?? column;
                const lessons = model.getCell(
                  day,
                  period,
                  selectedDay === null ? undefined : column,
                );
                return (
                  <td key={column} className="border border-border p-1 align-top">
                    {data.settings.days_off.includes(day) ? (
                      <span className="text-muted-foreground">إجازة</span>
                    ) : lessons.length ? (
                      lessons.map((lesson) => {
                        return (
                          <article
                            key={lesson.key}
                            data-timing={lesson.timing}
                            className={cn(
                              "min-w-0 break-words rounded-lg border p-2 [&+article]:mt-1",
                              lesson.timing === "current"
                                ? "border-emerald-400/40 bg-emerald-500/10"
                                : lesson.next
                                  ? "border-primary/40 bg-primary/10"
                                  : "border-primary/20 bg-primary/5",
                            )}
                          >
                            <p className="font-bold leading-relaxed" dir="auto">
                              {lesson.subject}
                            </p>
                            <p className="mt-1 text-primary">
                              {lesson.kind === "lecture" ? "محاضرة" : "سكشن"} ·{" "}
                              {lesson.remote ? "مسجلة" : lesson.room || "المكان غير محدد"}
                            </p>
                            <p className="mt-1 text-muted-foreground" dir="auto">
                              {lesson.instructor || "المحاضر غير محدد"}
                            </p>
                            {selectedDay === null && allSections && (
                              <p className="mt-1 text-muted-foreground">
                                {lesson.sections.length === 15
                                  ? "كل السكاشن"
                                  : `سكاشن ${lesson.sections.join("، ")}`}
                              </p>
                            )}
                            {lesson.timing === "current" && (
                              <span className="text-xs font-semibold text-emerald-300">الآن</span>
                            )}
                            {lesson.next && (
                              <span className="text-xs font-semibold text-primary">القادمة</span>
                            )}
                            {lesson.timing === "finished" && (
                              <span className="text-xs text-muted-foreground">انتهى موعدها</span>
                            )}
                            {(onEdit || onDelete) && lesson.entry.id && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {onEdit && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    aria-label={`تعديل حصة ${lesson.subject}`}
                                    onClick={() => onEdit(lesson.entry)}
                                  >
                                    تعديل
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    className="text-destructive"
                                    aria-label={`حذف حصة ${lesson.subject}`}
                                    onClick={() => onDelete(lesson.entry)}
                                  >
                                    حذف
                                  </Button>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })
                    ) : (
                      <span aria-label="لا توجد حصة" className="text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!available.length && (
        <p role="status" className="text-sm text-muted-foreground">
          {selectedDay !== null && data.settings.days_off.includes(selectedDay)
            ? "إجازة حسب الجدول المعتمد."
            : model.search
              ? "لا توجد مواعيد مطابقة للبحث في العرض المختار."
              : "لا توجد حصص في العرض المختار."}
        </p>
      )}
    </section>
  );
}
