import { ScheduleMatrix } from "./ScheduleMatrix";
import { DailyScheduleView } from "./DailyScheduleView";
import { buildTimetable } from "../utils/timetable";
import { useState } from "react";
import { DEPARTMENTS } from "@/features/academics/types";
import { scheduleService } from "@/features/schedule/services/scheduleService";
import { ScheduleSkeleton } from "@/shared/components/Loading";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Calendar, Download, Lock, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { academicWeek } from "../utils/academicSchedule";
import { emptyEntry, selectClass } from "../utils/scheduleEditor";
import { readScheduleWorkbook } from "../utils/scheduleWorkbook";
import { AcademicCycleControl } from "./AcademicCycleControl";
import { AcademicScheduleSettings } from "./AcademicScheduleSettings";
import { ExamSchedulePanel } from "./ExamSchedulePanel";
import { ScheduleEntryEditor } from "./ScheduleEntryEditor";
import { ScheduleImportReview } from "./ScheduleImportReview";
import { ScheduleVersions } from "./ScheduleVersions";
import { useAcademicSchedule } from "../hooks/useAcademicSchedule";
import { useAuth } from "@/features/auth/context/AuthContext";
import { canViewSchedule } from "@/features/auth/utils/roleAccess";

export function AcademicSchedulePanel() {
  const { role } = useAuth();
  const model = useAcademicSchedule();
  const [activeTab, setActiveTab] = useState("schedule");
  // Inner tab: "daily" | "weekly"
  const [viewTab, setViewTab] = useState<"daily" | "weekly">("daily");

  const {
    error,
    load,
    data,
    settingsDraft,
    date,
    previewCycle,
    section,
    setDraft,
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

  // ── Access Guard ─────────────────────────────────────────────────────────
  if (!canViewSchedule(role)) {
    return (
      <section
        dir="rtl"
        className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-10 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/40 border border-border">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-base">الجدول غير متاح</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            ليس لديك صلاحية لعرض الجدول الدراسي. تواصل مع مالك المنصة لمنحك هذه الصلاحية.
          </p>
        </div>
      </section>
    );
  }

  // ── Department/Year picker (owner & coordinator only) ─────────────────────
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
  const isStudent = role === "student";

  return (
    <div dir="rtl" className="space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            الجدول والامتحانات
          </h2>
          <div className="flex min-w-0 flex-wrap gap-2">
            {(role === "owner" || availableDepartments.length > 1) && (
              <select
                aria-label="قسم الجدول"
                disabled={busy || imported.length > 0}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-11 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
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
                className="h-11 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>
                    الفرقة {y}
                  </option>
                ))}
              </select>
            )}
          </div>

          <TabsList className="sm:ms-auto">
            <TabsTrigger value="schedule">الجدول</TabsTrigger>
            <TabsTrigger value="exams">الامتحانات</TabsTrigger>
          </TabsList>
          {data.can_edit && activeTab === "schedule" && (
            <Button
              variant={management ? "default" : "outline"}
              aria-pressed={management}
              onClick={() => setManagement(!management)}
            >
              {management ? "عرض الجدول" : "إدارة الجدول"}
            </Button>
          )}
        </div>

        {/* ── SCHEDULE TAB ── */}
        <TabsContent value="schedule" className="space-y-3">
          {!management && (
            <>
              {/* ── Daily / Weekly inner tabs ── */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Daily / Weekly switcher */}
                <div
                  className="flex rounded-xl border border-border overflow-hidden"
                  role="group"
                  aria-label="طريقة عرض الجدول"
                >
                  <button
                    type="button"
                    onClick={() => setViewTab("daily")}
                    className={`px-4 py-2 text-xs font-semibold transition-colors ${
                      viewTab === "daily"
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-muted/40"
                    }`}
                    aria-pressed={viewTab === "daily"}
                  >
                    اليومي
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab("weekly")}
                    className={`px-4 py-2 text-xs font-semibold transition-colors border-r border-border ${
                      viewTab === "weekly"
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-muted/40"
                    }`}
                    aria-pressed={viewTab === "weekly"}
                  >
                    الأسبوعي
                  </button>
                </div>

                {/* Week cycle selector + date */}
                <div className="flex items-center gap-2 flex-wrap">
                  {actualWeek && previewCycle === "auto" && (
                    <span className="text-xs text-muted-foreground">
                      الأسبوع الدراسي {actualWeek}
                    </span>
                  )}
                  <select
                    aria-label="الأسبوع"
                    value={previewCycle}
                    onChange={(e) => setPreviewCycle(e.target.value)}
                    className="h-9 min-w-0 rounded-lg border bg-background px-2 text-xs"
                  >
                    <option value="auto">الأسبوع الحالي</option>
                    <option value="1">الأسبوع الأول</option>
                    <option value="2">الأسبوع الثاني</option>
                  </select>

                  {/* Section filter (non-student only in weekly view) */}
                  {!isStudent && viewTab === "weekly" && (
                    <>
                      <select
                        aria-label="نطاق عرض الجدول"
                        value={view}
                        onChange={(e) => setView(e.target.value)}
                        className="h-9 min-w-0 rounded-lg border bg-background px-2 text-xs"
                      >
                        <option value="mine">سكشن محدد</option>
                        <option value="all">كل السكاشن</option>
                      </select>
                      {view === "mine" && (
                        <select
                          aria-label="السكشن"
                          value={section}
                          onChange={(e) => setSection(Number(e.target.value))}
                          className="h-9 rounded-lg border bg-background px-2 text-xs"
                        >
                          {Array.from({ length: 15 }, (_, i) => (
                            <option key={i} value={i + 1}>
                              سكشن {i + 1}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  )}

                  {/* Today button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => {
                      setCustomDate(null);
                      setPreviewCycle("auto");
                    }}
                  >
                    اليوم
                  </Button>

                  {/* Custom date picker */}
                  <details className="relative text-xs">
                    <summary className="cursor-pointer text-xs text-muted-foreground h-9 inline-flex items-center px-2 rounded-lg border bg-background">
                      تاريخ
                    </summary>
                    <div className="absolute left-0 top-11 z-10 rounded-xl border bg-card p-3 shadow-lg space-y-1">
                      <Label htmlFor="schedule-date-panel" className="text-xs">
                        تاريخ العرض
                      </Label>
                      <input
                        id="schedule-date-panel"
                        type="date"
                        value={date}
                        onChange={(e) => {
                          setCustomDate(e.target.value || null);
                          setPreviewCycle("auto");
                        }}
                        className="rounded-lg border bg-background px-2 py-1 text-xs w-40"
                      />
                    </div>
                  </details>

                  {now && (
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {new Intl.DateTimeFormat("ar-EG", {
                        timeZone: "Africa/Cairo",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }).format(now)}
                      {!synced ? " · جارٍ ضبط الوقت" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Student section warning */}
              {isStudent && !data.student_section && (
                <p role="alert" className="text-amber-400 text-sm">
                  لم يُحدد سكشن حسابك بعد. تواصل مع الإدارة.
                </p>
              )}

              {/* ── Daily view ── */}
              {viewTab === "daily" && (
                <DailyScheduleView
                  key={`daily:${data.department}:${data.academic_year}:${date}:${previewCycle}:${section}`}
                  data={data}
                  student={isStudent}
                  section={section}
                  date={date}
                  previewCycle={previewCycle}
                  now={now}
                />
              )}

              {/* ── Weekly matrix view ── */}
              {viewTab === "weekly" && (
                <ScheduleMatrix
                  key={`weekly:${data.department}:${data.academic_year}:${view}:${section}:${previewCycle}:${date}`}
                  model={buildTimetable({
                    data,
                    student: isStudent,
                    section,
                    allSections: view === "all",
                    date,
                    previewCycle,
                    now,
                  })}
                  selectedDay={null}
                />
              )}
            </>
          )}

          {/* ── Management panel (owner / coordinator only) ── */}
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
              <ScheduleMatrix
                key={`manage:${data.department}:${data.academic_year}:${section}:${previewCycle}:${date}`}
                model={buildTimetable({
                  data,
                  student: false,
                  section,
                  allSections: false,
                  date,
                  previewCycle,
                })}
                selectedDay={null}
                busy={busy}
                onEdit={setDraft}
                onDelete={(entry) =>
                  void run(async () => {
                    const result = await scheduleService.deleteEntry({ p_id: entry.id });
                    if (result.error) throw new Error(result.error.message);
                    await load();
                  })
                }
              />
            </>
          )}
        </TabsContent>

        {/* ── EXAMS TAB ── */}
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
