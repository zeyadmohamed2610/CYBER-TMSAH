import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { type useAcademicSchedule } from "../hooks/useAcademicSchedule";
import type { AcademicSchedule } from "../utils/academicSchedule";
import { ACADEMIC_DAYS, slotTime, type AcademicEntry } from "../utils/academicSchedule";
import { selectClass } from "../utils/scheduleEditor";
export function ScheduleEntryEditor({
  model,
  schedule,
  entry,
}: {
  model: ReturnType<typeof useAcademicSchedule>;
  schedule: AcademicSchedule;
  entry: AcademicEntry;
}) {
  const data = schedule;
  const settings = data.settings;
  const { busy, saveEntry, setDraft } = model;
  const draft = entry;
  const field = <K extends keyof AcademicEntry>(key: K, value: AcademicEntry[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  return (
    <div className="rounded-xl border border-primary/40 p-4 space-y-4">
      <h3 className="font-bold">{draft.id ? "تعديل الحصة" : "حصة جديدة"}</h3>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="entry-section">السكشن</Label>
          <select
            id="entry-section"
            className={selectClass}
            value={draft.section}
            onChange={(e) => field("section", Number(e.target.value))}
          >
            {Array.from({ length: 15 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="entry-day">اليوم</Label>
          <select
            id="entry-day"
            className={selectClass}
            value={draft.day_index}
            onChange={(e) => field("day_index", Number(e.target.value))}
          >
            {ACADEMIC_DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="entry-period">الحصة</Label>
          <select
            id="entry-period"
            className={selectClass}
            value={draft.period}
            onChange={(e) => field("period", Number(e.target.value))}
          >
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1} · {slotTime(settings.start_time, i + 1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="entry-subject">المادة</Label>
          <select
            id="entry-subject"
            className={selectClass}
            value={draft.subject_id}
            onChange={(e) => {
              field("subject_id", e.target.value);
              field("instructor_id", null);
              field("instructor_name", "");
            }}
          >
            <option value="">اختر المادة</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="entry-kind">نوع الحصة</Label>
          <select
            id="entry-kind"
            className={selectClass}
            value={draft.kind}
            onChange={(e) => {
              field("kind", e.target.value as "lecture" | "section");
              field("instructor_id", null);
              field("instructor_name", "");
              field("uses_rotation", false);
            }}
          >
            <option value="lecture">محاضرة</option>
            <option value="section">سكشن</option>
          </select>
        </div>
        <div>
          <Label htmlFor="entry-instructor">الدكتور / المعيد</Label>
          <select
            id="entry-instructor"
            className={selectClass}
            value={draft.instructor_id ?? ""}
            onChange={(e) => {
              field("instructor_id", e.target.value || null);
              field(
                "instructor_name",
                data.instructors.find((u) => u.id === e.target.value)?.name ?? "",
              );
            }}
          >
            <option value="">لم يُحدد بعد</option>
            {data.instructors
              .filter(
                (u) =>
                  u.role === (draft.kind === "lecture" ? "doctor" : "ta") &&
                  u.subjects.includes(draft.subject_id),
              )
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <Label htmlFor="entry-pattern">تكرار الحصة</Label>
          <select
            id="entry-pattern"
            className={selectClass}
            value={draft.week_pattern}
            onChange={(e) => field("week_pattern", Number(e.target.value))}
          >
            <option value="0">كل أسبوع</option>
            <option value="1">الأسبوع الأول فقط</option>
            <option value="2">الأسبوع الثاني فقط</option>
          </select>
        </div>
        <div>
          <Label htmlFor="entry-room">المكان الثابت</Label>
          <Input
            id="entry-room"
            value={draft.room}
            disabled={draft.uses_rotation}
            onChange={(e) => field("room", e.target.value)}
          />
        </div>
        {draft.kind === "section" && (
          <label className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={draft.uses_rotation}
              onChange={(e) => field("uses_rotation", e.target.checked)}
            />
            مكان يتغير بين الأسبوعين
          </label>
        )}
        {draft.uses_rotation && (
          <>
            <div>
              <Label htmlFor="entry-lab">المكان الأول</Label>
              <Input
                id="entry-lab"
                value={draft.lab_room}
                onChange={(e) => field("lab_room", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="entry-hall">المكان الثاني</Label>
              <Input
                id="entry-hall"
                value={draft.hall_room}
                onChange={(e) => field("hall_room", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="entry-lab-week">أسبوع المكان الأول</Label>
              <select
                id="entry-lab-week"
                className={selectClass}
                value={draft.lab_week}
                onChange={(e) => field("lab_week", Number(e.target.value))}
              >
                <option value="1">الأسبوع الأول</option>
                <option value="2">الأسبوع الثاني</option>
              </select>
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void saveEntry()}>
          حفظ الحصة
        </Button>
        <Button variant="outline" onClick={() => setDraft(null)}>
          إلغاء
        </Button>
      </div>
    </div>
  );
}
