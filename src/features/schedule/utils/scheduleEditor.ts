import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { type AcademicEntry } from "../utils/academicSchedule";
export const scheduleError = (message: string) =>
  message.includes("schedule_changed")
    ? "تغير الجدول أثناء المراجعة. أعد تحميله ثم ارفع الملف وراجع المعاينة مرة أخرى."
    : message.includes("conflict: instructor")
      ? "المحاضر لديه حصة أخرى في هذا الموعد."
      : message.includes("conflict:")
        ? "يوجد تعارض مع حصة أخرى لنفس السكشن في هذا الموعد."
        : message.includes("permission_denied")
          ? "هذا التعديل خارج صلاحيات حسابك أو قسمك."
          : message.includes("instructor assignment")
            ? "اختر دكتورًا أو معيدًا مسندًا لهذه المادة ونوع الحصة."
            : message.includes("validation_error") || message.includes("check constraint")
              ? "راجع المادة والسكشن والموعد وبيانات المكان قبل الحفظ."
              : getFriendlyErrorMessage(message, "تعذر تنفيذ الطلب. راجع البيانات وحاول مرة أخرى.");
export const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm w-full";
export const emptyEntry = (section: number): AcademicEntry => ({
  section,
  day_index: 5,
  period: 1,
  subject_id: "",
  instructor_id: null,
  instructor_name: "",
  kind: "lecture",
  week_pattern: 0,
  room: "",
  uses_rotation: false,
  lab_room: "",
  hall_room: "",
  lab_week: 1,
});
