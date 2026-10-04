import { ScheduleMatrix } from "./ScheduleMatrix";
import { EmptyState } from "@/shared/components/EmptyState";
import { buildTimetable } from "../utils/timetable";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import {
  ACADEMIC_DAYS,
  weeklyScheduleCycle,
  type AcademicSchedule,
} from "../utils/academicSchedule";

interface Props {
  data: AcademicSchedule;
  student: boolean;
  section: number;
  view: string;
  date: string;
  cycle: number;
  actualWeek: number | null;
  previewCycle: string;
  now?: Date;
  clockSynced?: boolean;
  onToday?: () => void;
  onSection: (value: number) => void;
  onView: (value: string) => void;
  onDate: (value: string) => void;
  onCycle: (value: string) => void;
}
export function ScheduleTimetable({
  data,
  student,
  section,
  view,
  date,
  cycle,
  actualWeek,
  previewCycle,
  onSection,
  onView,
  onDate,
  onCycle,
  now,
  clockSynced,
  onToday,
}: Props) {
  const [dayChoice, setSelectedDay] = useState<number | null | "today">(null);
  const [search, setSearch] = useState("");
  const dateDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  const selectedDay = dayChoice === "today" ? dateDay : dayChoice;
  const model = buildTimetable({
    data,
    student,
    section,
    allSections: view === "all",
    date,
    previewCycle,
    query: search,
    now,
  });
  const { days, cycleForDay: dayCycle } = model;
  return (
    <section aria-label="مواعيد الأسبوع" className="space-y-3">
      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">
            {selectedDay === null
              ? "الجدول الأسبوعي"
              : selectedDay === dateDay
                ? "جدول اليوم"
                : `جدول ${ACADEMIC_DAYS[selectedDay]}`}
            {student && view === "mine" ? ` · سكشن ${data.student_section ?? "غير محدد"}` : ""}
          </h3>
          {now && (
            <span className="text-xs text-muted-foreground">
              <time dir="ltr">
                {new Intl.DateTimeFormat("ar-EG", {
                  timeZone: "Africa/Cairo",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }).format(now)}
              </time>{" "}
              · توقيت مصر{!clockSynced ? " · جارٍ ضبط الوقت" : ""}
            </span>
          )}
        </div>
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="نطاق أيام المصفوفة"
        >
          <select
            aria-label="أيام المصفوفة"
            value={dayChoice === null ? "week" : dayChoice}
            onChange={(event) =>
              setSelectedDay(
                event.target.value === "week"
                  ? null
                  : event.target.value === "today"
                    ? "today"
                    : Number(event.target.value),
              )
            }
            className="h-11 min-w-0 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="week">الأسبوع كاملًا</option>
            <option value="today">اليوم</option>
            {days.map((day) => (
              <option key={day} value={day}>
                {ACADEMIC_DAYS[day]}
                {data.settings.days_off.includes(day) ? " · إجازة" : ""}
              </option>
            ))}
          </select>
          {onToday && (
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedDay("today");
                onToday();
              }}
            >
              اليوم
            </Button>
          )}
          <span className="text-xs text-muted-foreground mr-auto">
            {actualWeek && previewCycle === "auto" ? `الأسبوع الدراسي ${actualWeek} · ` : ""}الأسبوع{" "}
            {selectedDay === null
              ? previewCycle === "auto"
                ? weeklyScheduleCycle(date, data)
                : cycle
              : dayCycle(selectedDay)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="اختيار الأسبوع">
          <select
            aria-label="الأسبوع"
            value={previewCycle}
            onChange={(event) => onCycle(event.target.value)}
            className="h-11 min-w-0 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="auto">الحالي</option>
            <option value="1">الأول</option>
            <option value="2">الثاني</option>
          </select>
          <select
            aria-label="نطاق عرض الجدول"
            value={view}
            onChange={(e) => onView(e.target.value)}
            className="h-11 min-w-0 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="mine">{student ? "جدول سكشني" : "سكشن محدد"}</option>
            <option value="all">كل السكاشن</option>
          </select>
          {!student && view === "mine" && (
            <select
              aria-label="السكشن"
              value={section}
              onChange={(e) => onSection(Number(e.target.value))}
              className="h-11 rounded-lg border bg-background px-2 text-sm"
            >
              {Array.from({ length: 15 }, (_, i) => (
                <option key={i} value={i + 1}>
                  سكشن {i + 1}
                </option>
              ))}
            </select>
          )}
        </div>
        {student && !data.student_section && (
          <p role="alert" className="text-amber-400 text-sm">
            لم يُحدد سكشن حسابك بعد. تواصل مع الإدارة، أو اختر كل السكاشن للاطلاع على المواعيد.
          </p>
        )}
        <div className="space-y-1">
          <Label htmlFor="schedule-search" className="sr-only">
            ابحث في المواعيد
          </Label>
          <div className="flex gap-2">
            <Input
              id="schedule-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="المادة أو المكان أو المحاضر"
            />
            {search && (
              <Button variant="outline" onClick={() => setSearch("")}>
                مسح
              </Button>
            )}
          </div>
        </div>
        <details>
          <summary className="text-sm text-muted-foreground cursor-pointer">
            عرض أسبوع بتاريخ آخر
          </summary>
          <div className="max-w-xs mt-3 space-y-2">
            <Label htmlFor="schedule-date">تاريخ العرض</Label>
            <Input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(event) => {
                onDate(event.target.value);
                onCycle("auto");
              }}
            />
          </div>
        </details>
      </div>
      {data.entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="الجدول لم يُنشر بعد"
          description="ستظهر المواعيد هنا بمجرد اعتمادها من إدارة القسم."
        />
      ) : student && !model.assigned && view === "mine" ? (
        <p role="status" className="text-sm text-muted-foreground">
          اختر كل السكاشن حتى تحدد الإدارة سكشن حسابك.
        </p>
      ) : (
        <ScheduleMatrix
          key={`${data.department}:${data.academic_year}:${selectedDay}:${view}:${section}:${previewCycle}:${date}:${search}`}
          model={model}
          selectedDay={selectedDay}
        />
      )}
    </section>
  );
}
