import { DEPARTMENTS } from "@/features/academics/types";
import { scheduleService } from "@/features/schedule/services/scheduleService";
import { ScheduleSkeleton } from "@/shared/components/Loading";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Calendar, Download, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  ACADEMIC_DAYS,
  academicWeek,
  scheduleCycle,
  scheduleRoom,
  slotTime,
} from "../utils/academicSchedule";
import { emptyEntry, selectClass } from "../utils/scheduleEditor";
import { readScheduleWorkbook } from "../utils/scheduleWorkbook";
import { AcademicCycleControl } from "./AcademicCycleControl";
import { AcademicScheduleSettings } from "./AcademicScheduleSettings";
import { ExamSchedulePanel } from "./ExamSchedulePanel";
import { ScheduleEntryEditor } from "./ScheduleEntryEditor";
import { ScheduleImportReview } from "./ScheduleImportReview";
import { ScheduleWeekView } from "./ScheduleWeekView";
import { ScheduleVersions } from "./ScheduleVersions";

import { useAcademicSchedule } from "../hooks/useAcademicSchedule";
export function AcademicSchedulePanel() {
  const model = useAcademicSchedule();
  const {
    error,
    load,
    data,
    settingsDraft,
    date,
    previewCycle,
    section,
    setDraft,
    role,
    busy,
    imported,
    department,
    availableDepartments,
    setDepartment,
    setYear,
    year,
    management,
    setManagement,
    view,
    setSection,
    setView,
    setCustomDate,
    setPreviewCycle,
    now,
    synced,
    download,
    run,
    setImported,
    setImportReview,
    setImportRevision,
    today,
    setSettingsDraft,
    draft,
  } = model;
  if ((role === "owner" || role === "coordinator") && !year)
    return (
      <section dir="rtl" className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold">الجدول والامتحانات</h2>
        <p className="text-sm text-muted-foreground">
          {role === "owner"
            ? "اختر القسم والفرقة الدراسية لعرض الجدول أو إدارته."
            : "اختر الفرقة الدراسية لعرض جدول قسمك أو إدارته."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(role === "owner" || availableDepartments.length > 1) && (
            <label className="space-y-2 text-sm">
              القسم
              <select
                aria-label="قسم الجدول"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={`${selectClass} w-full`}
              >
                {DEPARTMENTS.filter(
                  (d) => role === "owner" || availableDepartments.includes(d.id),
                ).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameAr}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-2 text-sm">
            الفرقة الدراسية
            <select
              aria-label="الفرقة الدراسية"
              value=""
              onChange={(e) => setYear(e.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="" disabled>
                اختر الفرقة
              </option>
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  الفرقة {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    );
  if (error)
    return (
      <div role="alert" className="rounded-xl border p-5">
        تعذر تحميل الجدول. {error}
        <Button onClick={() => void load()} variant="outline" className="mr-3">
          إعادة المحاولة
        </Button>
      </div>
    );
  if (!data)
    return (
      <div role="status" aria-label="جارٍ تحميل الجدول">
        <ScheduleSkeleton />
      </div>
    );
  const settings = data.settings;
  const editableSettings = settingsDraft ?? settings;
  const actualWeek = academicWeek(date, settings.semester_start, settings.week_start_day);
  const cycle = previewCycle === "auto" ? scheduleCycle(date, data) : Number(previewCycle);
  const visibleEntries = data.entries.filter(
    (e) => e.section === section && (!e.week_pattern || e.week_pattern === cycle),
  );
  const days = Array.from({ length: 7 }, (_, i) => (settings.week_start_day + i) % 7);

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-bold flex gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          الجدول والامتحانات
        </h2>
        <div className="flex flex-wrap gap-2">
          {(role === "owner" || availableDepartments.length > 1) && (
            <select
              aria-label="قسم الجدول"
              disabled={busy || imported.length > 0}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={selectClass}
            >
              {DEPARTMENTS.filter(
                (d) => role === "owner" || availableDepartments.includes(d.id),
              ).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameAr}
                </option>
              ))}
            </select>
          )}
          {role !== "student" && (
            <select
              aria-label="الفرقة الدراسية"
              disabled={busy || imported.length > 0}
              value={data.academic_year}
              onChange={(e) => setYear(e.target.value)}
              className={selectClass}
            >
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  الفرقة {y}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <Tabs defaultValue="schedule" dir="rtl">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger className="flex-1 sm:flex-none" value="schedule">
            الجدول
          </TabsTrigger>
          <TabsTrigger className="flex-1 sm:flex-none" value="exams">
            الامتحانات
          </TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="space-y-5">
          {data.can_edit && (
            <div className="flex gap-2" role="group" aria-label="عرض الجدول وإدارته">
              <Button
                variant={management ? "outline" : "default"}
                aria-pressed={!management}
                onClick={() => setManagement(false)}
              >
                عرض الجدول
              </Button>
              <Button
                variant={management ? "default" : "outline"}
                aria-pressed={management}
                onClick={() => setManagement(true)}
              >
                إدارة الجدول
              </Button>
            </div>
          )}
          {!management && (
            <ScheduleWeekView
              data={data}
              student={role === "student"}
              section={section}
              view={view}
              date={date}
              cycle={cycle}
              actualWeek={actualWeek}
              previewCycle={previewCycle}
              onSection={setSection}
              onView={setView}
              onDate={(value) => setCustomDate(value || null)}
              onCycle={setPreviewCycle}
              now={now}
              clockSynced={synced}
              onToday={() => {
                setCustomDate(null);
                setPreviewCycle("auto");
              }}
            />
          )}
          {management && data.can_edit && (
            <>
              <div className="rounded-2xl border p-4 space-y-3">
                <h3 className="font-bold">تحديث جدول الفرقة</h3>
                <p className="text-sm text-muted-foreground">
                  ارفع ملف الجامعة الأصلي بصيغة Excel كما هو، دون إعادة تنسيقه أو فك الخلايا
                  المدمجة. سنقرأ ورقة الفرقة {data.academic_year} فقط، ثم نعرض المواعيد والأسابيع
                  والأماكن للمراجعة قبل الاعتماد.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" disabled={busy} onClick={() => void download(false)}>
                    <Download className="h-4 w-4 ml-2" />
                    تصدير Excel
                  </Button>
                  {data.can_edit && (
                    <>
                      <Button variant="outline" disabled={busy} onClick={() => void download(true)}>
                        قالب الاستيراد
                      </Button>
                      <label className="relative inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 cursor-pointer text-sm focus-within:ring-2 focus-within:ring-primary">
                        <Upload className="h-4 w-4" />
                        {busy ? "جارٍ قراءة الملف…" : "رفع جدول الجامعة أو Excel"}
                        <input
                          type="file"
                          accept=".xlsx"
                          disabled={busy}
                          aria-label="رفع ملف جدول الجامعة"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file)
                              void run(async () => {
                                setImported([]);
                                setImportReview(null);
                                const review = await readScheduleWorkbook(
                                  await file.arrayBuffer(),
                                  data,
                                );
                                setImported(review.entries);
                                setImportReview({ ...review, file_name: file.name });
                                setImportRevision(data.revision ?? null);
                              });
                          }}
                        />
                      </label>
                      <Button disabled={busy} onClick={() => setDraft(emptyEntry(section))}>
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة حصة
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  الحد الأقصى 5 ميجابايت · يمكنك رفع ملف يحتوي على الفرق الأربع. اعتماد نسخة الجامعة
                  يستبدل جدول الفرقة المختارة فقط، ويحافظ على بقية الفرق والامتحانات.
                </p>
              </div>
              {role === "owner" && (
                <AcademicCycleControl
                  key={`${data.department}:${data.academic_year}`}
                  data={data}
                  today={today}
                  busy={busy}
                  onSave={(onDate, chosenCycle, scope) =>
                    void run(async () => {
                      const result = await scheduleService.saveCycle({
                        p_department: data.department,
                        p_year: data.academic_year,
                        p_date: onDate,
                        p_cycle: chosenCycle,
                        p_scope: scope,
                      });
                      if (result.error) throw new Error(result.error.message);
                      await load();
                      toast.success("تم تحديث المواعيد المعروضة للجميع");
                    })
                  }
                />
              )}
              <AcademicScheduleSettings
                value={editableSettings}
                saved={settings}
                busy={busy}
                onChange={setSettingsDraft}
                onReset={() => setSettingsDraft(null)}
                onSave={() =>
                  void run(async () => {
                    const result = await scheduleService.saveSettings({
                      p_department: data.department,
                      p_year: data.academic_year,
                      p_settings: editableSettings,
                    });
                    if (result.error) throw new Error(result.error.message);
                    await load();
                    toast.success("تم حفظ إعدادات الجدول");
                  })
                }
              />
              {draft && data.can_edit && (
                <ScheduleEntryEditor model={model} schedule={data} entry={draft} />
              )}
              <ScheduleVersions schedule={data} busy={busy} run={run} load={load} />
              {imported.length > 0 && <ScheduleImportReview model={model} schedule={data} />}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="manage-section">عرض سكشن</Label>
                  <select
                    id="manage-section"
                    className={selectClass}
                    value={section}
                    onChange={(event) => {
                      setSection(Number(event.target.value));
                      setView("mine");
                    }}
                  >
                    {Array.from({ length: 15 }, (_, index) => (
                      <option key={index} value={index + 1}>
                        سكشن {index + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="manage-week">الأسبوع</Label>
                  <select
                    id="manage-week"
                    className={selectClass}
                    value={previewCycle}
                    onChange={(event) => setPreviewCycle(event.target.value)}
                  >
                    <option value="auto">الأسبوع الحالي</option>
                    <option value="1">الأسبوع الأول</option>
                    <option value="2">الأسبوع الثاني</option>
                  </select>
                </div>
              </div>
              {days
                .filter((day) => visibleEntries.some((entry) => entry.day_index === day))
                .map((day) => (
                  <section key={day} className="rounded-xl border p-4">
                    <h3 className="font-bold mb-3">
                      {ACADEMIC_DAYS[day]}{" "}
                      {settings.days_off.includes(day) && (
                        <span className="text-amber-400 text-sm">· إجازة</span>
                      )}
                    </h3>
                    {settings.days_off.includes(day) ? (
                      <p className="text-sm text-muted-foreground">
                        هذا اليوم إجازة حسب الإعدادات. تبقى حصصه محفوظة لتظهر عند إلغاء الإجازة.
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {visibleEntries
                          .filter((e) => e.day_index === day)
                          .map((e) => (
                            <article
                              key={e.id}
                              className="rounded-lg bg-muted/40 p-3 text-sm space-y-1"
                            >
                              <p className="font-bold">{e.subject_name}</p>
                              <p>
                                {e.kind === "lecture" ? "محاضرة" : "سكشن"} · سكشن {e.section} ·{" "}
                                {slotTime(settings.start_time, e.period)}–
                                {slotTime(settings.start_time, e.period + 1)}
                              </p>
                              <p>{e.instructor_name || "المحاضر لم يُحدد"}</p>
                              <p>
                                {cycle
                                  ? scheduleRoom(e, cycle) || "المكان لم يُحدد"
                                  : e.uses_rotation
                                    ? `الأسبوع ${e.lab_week}: ${e.lab_room} · الأسبوع الآخر: ${e.hall_room}`
                                    : e.room || "المكان لم يُحدد"}
                              </p>
                              {/^O\.[LN]$/i.test(e.room.trim()) && (
                                <p>محاضرة مسجلة تُنشر في مجموعة الطلاب</p>
                              )}
                              {e.week_pattern > 0 && <p>الأسبوع {e.week_pattern} فقط</p>}
                              {data.can_edit && (
                                <div className="flex gap-2 pt-2">
                                  <Button size="sm" variant="outline" onClick={() => setDraft(e)}>
                                    تعديل
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    aria-label={`حذف حصة ${e.subject_name}`}
                                    onClick={() =>
                                      void run(async () => {
                                        const result = await scheduleService.deleteEntry({
                                          p_id: e.id,
                                        });
                                        if (result.error) throw new Error(result.error.message);
                                        await load();
                                      })
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </article>
                          ))}
                        {!visibleEntries.some((e) => e.day_index === day) && (
                          <p className="text-sm text-muted-foreground">
                            لا توجد حصص مضافة لهذا اليوم.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                ))}
            </>
          )}
        </TabsContent>
        <TabsContent value="exams">
          <ExamSchedulePanel
            department={data.department}
            academicYear={data.academic_year}
            canEdit={data.can_edit}
            studentSection={data.student_section}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
