import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  ACADEMIC_DAYS,
  scheduleRoom,
  slotTime,
  type AcademicEntry,
  type AcademicSchedule,
} from "../utils/academicSchedule";

interface Props {
  data: AcademicSchedule;
  entries: AcademicEntry[];
  days: number[];
  selectedDay: number | null;
  section: number;
  allSections: boolean;
  cycleForDay: (day: number) => number;
}
export function ScheduleMatrix({
  data,
  entries,
  days,
  selectedDay,
  section,
  allSections,
  cycleForDay,
}: Props) {
  const [small, setSmall] = useState(() => window.innerWidth < 640);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const resize = () => setSmall(window.innerWidth < 640);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const columns =
    selectedDay === null
      ? days
      : allSections
        ? Array.from({ length: 15 }, (_, i) => i + 1)
        : [section];
  const size = small ? (selectedDay === null ? 2 : 3) : selectedDay === null ? 7 : 5;
  const count = Math.ceil(columns.length / size);
  const currentPage = Math.min(page, count - 1);
  const visible = columns.slice(currentPage * size, (currentPage + 1) * size);
  const available = entries.filter(
    (e) =>
      !data.settings.days_off.includes(e.day_index) &&
      (selectedDay === null || e.day_index === selectedDay),
  );
  const last = Math.max(1, ...available.map((e) => e.period));
  const first = Math.min(last, ...available.map((e) => e.period));
  const subject = (e: AcademicEntry) =>
    e.subject_name ?? data.subjects.find((s) => s.id === e.subject_id)?.name ?? "مادة غير محددة";
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
                const lessons = available.filter(
                  (e) =>
                    e.day_index === day &&
                    e.period === period &&
                    (selectedDay === null || e.section === column),
                );
                const groups = new Map<string, AcademicEntry[]>();
                for (const e of lessons) {
                  const key = JSON.stringify([
                    e.subject_id,
                    e.kind,
                    e.instructor_name,
                    e.instructor_id,
                    scheduleRoom(e, cycleForDay(day)),
                  ]);
                  groups.set(key, [...(groups.get(key) ?? []), e]);
                }
                return (
                  <td key={column} className="border border-border p-1 align-top">
                    {data.settings.days_off.includes(day) ? (
                      <span className="text-muted-foreground">إجازة</span>
                    ) : groups.size ? (
                      [...groups.entries()].map(([key, group]) => {
                        const e = group[0]!;
                        const room = scheduleRoom(e, cycleForDay(day));
                        return (
                          <div
                            key={key}
                            className="rounded-lg border border-primary/20 bg-primary/5 p-2 [&+div]:mt-1"
                          >
                            <p className="font-bold leading-relaxed" dir="auto">
                              {subject(e)}
                            </p>
                            <p className="mt-1 text-primary">
                              {e.kind === "lecture" ? "محاضرة" : "سكشن"} ·{" "}
                              {/^O\.[LN]$/i.test(room) ? "مسجلة" : room || "المكان غير محدد"}
                            </p>
                            <p className="mt-1 text-muted-foreground" dir="auto">
                              {e.instructor_name || "المحاضر غير محدد"}
                            </p>
                            {selectedDay === null && allSections && (
                              <p className="mt-1 text-muted-foreground">
                                {new Set(group.map((item) => item.section)).size === 15
                                  ? "كل السكاشن"
                                  : `سكاشن ${[...new Set(group.map((item) => item.section))].sort((a, b) => a - b).join("، ")}`}
                              </p>
                            )}
                          </div>
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
        <p className="text-sm text-muted-foreground">لا توجد حصص في العرض المختار.</p>
      )}
    </section>
  );
}
