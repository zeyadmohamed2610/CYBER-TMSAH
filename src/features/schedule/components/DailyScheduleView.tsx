import { cn } from "@/shared/lib/utils";
import { Clock, MapPin, User2, Layers } from "lucide-react";
import { ACADEMIC_DAYS, slotTime, type AcademicSchedule } from "../utils/academicSchedule";
import { buildTimetable } from "../utils/timetable";

interface Props {
  data: AcademicSchedule;
  student: boolean;
  section: number;
  date: string;
  previewCycle: string;
  now?: Date;
}

/** Renders today's (or any chosen day's) lessons as sorted horizontal rows. */
export function DailyScheduleView({ data, student, section, date, previewCycle, now }: Props) {
  const model = buildTimetable({
    data,
    student,
    section,
    allSections: false,
    date,
    previewCycle,
    now,
  });

  // Determine which day we are showing
  const dateDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  const cycle = model.cycleForDay(dateDay);
  const isOff = data.settings.days_off.includes(dateDay);

  // Lessons for that day, sorted by period
  const todayLessons = model.lessons
    .filter((l) => l.day === dateDay)
    .sort((a, b) => a.period - b.period);

  const dayName = ACADEMIC_DAYS[dateDay];

  return (
    <section aria-label="الجدول اليومي" className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          جدول {dayName}
          {student && data.student_section
            ? ` · سكشن ${data.student_section}`
            : ""}
        </h3>
        <span className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
          أسبوع {cycle}
        </span>
      </div>

      {/* Holiday */}
      {isOff && (
        <p className="text-center text-sm text-muted-foreground py-8">
          إجازة حسب الجدول المعتمد.
        </p>
      )}

      {/* No lessons */}
      {!isOff && todayLessons.length === 0 && (
        <p role="status" className="text-center text-sm text-muted-foreground py-8">
          لا توجد حصص مجدولة لهذا اليوم.
        </p>
      )}

      {/* Lesson rows */}
      {!isOff && todayLessons.map((lesson) => {
        const isNow = lesson.timing === "current";
        const isNext = lesson.next;
        const isDone = lesson.timing === "finished";
        const weekTag = lesson.entry.week_pattern
          ? `أسبوع ${lesson.entry.week_pattern}`
          : null;
        // Lab / hall info for sections with rotation
        const hasRotation = lesson.entry.uses_rotation;
        const labRoom = lesson.entry.lab_room;
        const hallRoom = lesson.entry.hall_room;

        return (
          <article
            key={lesson.key}
            data-timing={lesson.timing}
            className={cn(
              "relative flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border p-4 transition-all",
              isNow
                ? "border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_12px_0_rgba(52,211,153,0.15)]"
                : isNext
                  ? "border-primary/50 bg-primary/10 shadow-[0_0_8px_0_rgba(168,85,247,0.12)]"
                  : isDone
                    ? "border-border/40 bg-muted/20 opacity-60"
                    : "border-border bg-card hover:bg-muted/30",
            )}
          >
            {/* Period + time column */}
            <div className="flex flex-row sm:flex-col items-center sm:items-center gap-3 sm:gap-1 sm:min-w-[4.5rem] sm:text-center">
              <span
                className={cn(
                  "text-2xl font-black tabular-nums",
                  isNow ? "text-emerald-400" : isNext ? "text-primary" : "text-muted-foreground",
                )}
              >
                {lesson.period}
              </span>
              <div className="text-[11px] text-muted-foreground leading-tight" dir="ltr">
                <time>{slotTime(data.settings.start_time, lesson.period)}</time>
                <span className="mx-1">—</span>
                <time>{slotTime(data.settings.start_time, lesson.period + 1)}</time>
              </div>
            </div>

            {/* Divider (desktop only) */}
            <div className="hidden sm:block w-px self-stretch bg-border/60 mx-1" />

            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-1.5">
              {/* Subject + kind badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm leading-snug" dir="auto">
                  {lesson.subject}
                </p>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-md border",
                    lesson.kind === "lecture"
                      ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/30",
                  )}
                >
                  {lesson.kind === "lecture" ? "محاضرة" : "سكشن"}
                </span>
                {weekTag && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border bg-purple-500/15 text-purple-300 border-purple-500/30">
                    {weekTag}
                  </span>
                )}
              </div>

              {/* Instructor */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User2 className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                <span dir="auto">{lesson.instructor || "المحاضر غير محدد"}</span>
              </div>

              {/* Room */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                {lesson.remote ? (
                  <span className="text-amber-300">محاضرة مسجلة</span>
                ) : hasRotation && (labRoom || hallRoom) ? (
                  <span>
                    <span className="text-emerald-300">معمل: {labRoom || "—"}</span>
                    <span className="mx-1.5 text-border">·</span>
                    <span className="text-blue-300">قاعة: {hallRoom || "—"}</span>
                    <span className="mr-1.5 text-[10px] text-muted-foreground">
                      (هذا الأسبوع: {cycle === lesson.entry.lab_week ? "معمل" : "قاعة"})
                    </span>
                  </span>
                ) : (
                  <span>{lesson.room || "المكان غير محدد"}</span>
                )}
              </div>

              {/* Sections (non-student view with multiple sections) */}
              {!student && lesson.sections.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Layers className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span>
                    {lesson.sections.length === 15
                      ? "كل السكاشن"
                      : `سكاشن: ${lesson.sections.join("، ")}`}
                  </span>
                </div>
              )}
            </div>

            {/* Status badge */}
            {isNow && (
              <span className="shrink-0 text-xs font-bold text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 self-start sm:self-center">
                الآن
              </span>
            )}
            {isNext && !isNow && (
              <span className="shrink-0 text-xs font-bold text-primary px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 self-start sm:self-center">
                القادمة
              </span>
            )}
            {isDone && (
              <span className="shrink-0 text-xs text-muted-foreground px-2 py-1 rounded-lg bg-muted/30 border border-border/40 self-start sm:self-center">
                انتهت
              </span>
            )}
          </article>
        );
      })}
    </section>
  );
}
