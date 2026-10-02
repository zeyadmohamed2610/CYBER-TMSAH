import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Download, Upload, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAttendanceAuth } from '../context/AttendanceAuthContext';
import { DEPARTMENTS } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ACADEMIC_DAYS, academicWeek, weekCycle, scheduleRoom, slotTime, type AcademicEntry, type AcademicSchedule, type AcademicSettings } from '../utils/academicSchedule';
import { exportScheduleWorkbook, readScheduleWorkbook } from '../utils/scheduleWorkbook';
import type { UniversityImport } from '../utils/universitySchedule';
import { ScheduleWeekView } from './ScheduleWeekView';
import { ExamSchedulePanel } from './ExamSchedulePanel';
import { AcademicScheduleSettings } from './AcademicScheduleSettings';
import { getFriendlyErrorMessage } from '@/lib/academicCopy';

const scheduleError = (message: string) => message.includes('schedule_changed') ? 'تغير الجدول أثناء المراجعة. أعد تحميله ثم ارفع الملف وراجع المعاينة مرة أخرى.'
  : message.includes('conflict: instructor') ? 'المحاضر لديه حصة أخرى في هذا الموعد.'
  : message.includes('conflict:') ? 'يوجد تعارض مع حصة أخرى لنفس السكشن في هذا الموعد.'
  : message.includes('permission_denied') ? 'هذا التعديل خارج صلاحيات حسابك أو قسمك.'
  : message.includes('instructor assignment') ? 'اختر دكتورًا أو معيدًا مسندًا لهذه المادة ونوع الحصة.'
  : message.includes('validation_error') || message.includes('check constraint') ? 'راجع المادة والسكشن والموعد وبيانات المكان قبل الحفظ.'
  : getFriendlyErrorMessage(message, 'تعذر تنفيذ الطلب. راجع البيانات وحاول مرة أخرى.');

const selectClass = 'h-10 rounded-lg border border-input bg-background px-3 text-sm w-full';
const emptyEntry = (section: number): AcademicEntry => ({ section, day_index: 5, period: 1, subject_id: '', instructor_id: null, instructor_name: '', kind: 'lecture', week_pattern: 0, room: '', uses_rotation: false, lab_room: '', hall_room: '', lab_week: 1 });
export function AcademicSchedulePanel() {
  const { role } = useAttendanceAuth();
  const [department, setDepartment] = useState('cybersecurity');
  const [year, setYear] = useState('1');
  const [data, setData] = useState<AcademicSchedule | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AcademicSettings | null>(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState(1);
  const [view, setView] = useState(role === 'student' ? 'mine' : 'all');
  const [previewCycle, setPreviewCycle] = useState('auto');
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date()));
  const [draft, setDraft] = useState<AcademicEntry | null>(null);
  const [imported, setImported] = useState<AcademicEntry[]>([]);
  const [importReview, setImportReview] = useState<UniversityImport | null>(null);
  const [importRevision, setImportRevision] = useState<string | null>(null);
  const [management, setManagement] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setError('');
    setData(null);
    const result = await supabase.rpc('get_academic_schedule', { p_department: role === 'owner' ? department : null, p_year: role === 'student' ? null : year });
    if (version !== loadVersion.current) return;
    if (result.error) { setError(scheduleError(result.error.message)); setData(null); return; }
    const next = result.data as AcademicSchedule;
    next.settings.days_off ??= [];
    setData(next);
    setSettingsDraft(null);
    if (next.student_section && /^[1-9]$|^1[0-5]$/.test(next.student_section)) setSection(Number(next.student_section));
  }, [department, year, role]);
  useEffect(() => { void load(); setDraft(null); setImported([]); setImportReview(null); }, [load]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); try { await fn(); } catch (e) { toast.error(e instanceof Error ? scheduleError(e.message) : 'تعذر تنفيذ الطلب'); } finally { setBusy(false); }
  };
  const saveEntry = () => run(async () => {
    if (!data || !draft) return;
    const result = await supabase.rpc('save_academic_entry', { p_department: data.department, p_year: data.academic_year, p_entry: draft });
    if (result.error) throw new Error(result.error.message);
    setDraft(null); await load(); toast.success('تم حفظ الحصة');
  });
  const download = (template: boolean) => run(async () => {
    if (!data) return;
    const bytes = await exportScheduleWorkbook(data, template);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a'); link.href = url; link.download = template ? 'CYBER-TMSAH-template.xlsx' : `CYBER-TMSAH-${data.department}-${data.academic_year}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  if (error) return <div role="alert" className="rounded-xl border p-5">تعذر تحميل الجدول. {error}<Button onClick={() => void load()} variant="outline" className="mr-3">إعادة المحاولة</Button></div>;
  if (!data) return <p className="p-6">جاري تحميل الجدول...</p>;
  const settings = data.settings;
  const editableSettings = settingsDraft ?? settings;
  const actualWeek = academicWeek(date, settings.semester_start, settings.week_start_day);
  const cycle = previewCycle === 'auto' ? actualWeek ? weekCycle(actualWeek) : 1 : Number(previewCycle);
  const visibleEntries = data.entries.filter(e => e.section === section && (!e.week_pattern || e.week_pattern === cycle));
  const days = Array.from({ length: 7 }, (_, i) => (settings.week_start_day + i) % 7);
  const field = <K extends keyof AcademicEntry>(key: K, value: AcademicEntry[K]) => setDraft(prev => prev ? { ...prev, [key]: value } : prev);
  return <div dir="rtl" className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3"><h2 className="font-bold flex gap-2"><Calendar className="h-5 w-5 text-primary" />الجدول والامتحانات</h2>
      <div className="flex gap-2">
        {role === 'owner' && <select aria-label="قسم الجدول" disabled={busy || imported.length > 0} value={department} onChange={e => setDepartment(e.target.value)} className={selectClass}>{DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.nameAr}</option>)}</select>}
        {role !== 'student' && <select aria-label="الفرقة الدراسية" disabled={busy || imported.length > 0} value={year} onChange={e => setYear(e.target.value)} className={selectClass}>{[1, 2, 3, 4].map(y => <option key={y} value={y}>الفرقة {y}</option>)}</select>}
      </div>
    </div>
    <Tabs defaultValue="schedule" dir="rtl"><TabsList><TabsTrigger value="schedule">الجدول</TabsTrigger><TabsTrigger value="exams">الامتحانات</TabsTrigger></TabsList>
      <TabsContent value="schedule" className="space-y-5">
        {data.can_edit && <div className="flex gap-2" role="group" aria-label="عرض الجدول وإدارته"><Button variant={management ? 'outline' : 'default'} aria-pressed={!management} onClick={() => setManagement(false)}>عرض الجدول</Button><Button variant={management ? 'default' : 'outline'} aria-pressed={management} onClick={() => setManagement(true)}>إدارة الجدول</Button></div>}
        {!management && <ScheduleWeekView data={data} student={role === 'student'} section={section} view={view} date={date} cycle={cycle} actualWeek={actualWeek} previewCycle={previewCycle} onSection={setSection} onView={setView} onDate={setDate} onCycle={setPreviewCycle} />}
        {management && data.can_edit && <>
        <div className="rounded-2xl border p-4 space-y-3"><h3 className="font-bold">تحديث جدول الفرقة</h3><p className="text-sm text-muted-foreground">ارفع ملف الجامعة وراجع المواعيد قبل الاعتماد، أو أضف حصة يدويًا.</p>
          <div className="flex gap-2 flex-wrap"><Button variant="outline" disabled={busy} onClick={() => void download(false)}><Download className="h-4 w-4 ml-2" />تصدير Excel</Button>
            {data.can_edit && <><Button variant="outline" disabled={busy} onClick={() => void download(true)}>قالب الاستيراد</Button><label className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 cursor-pointer text-sm"><Upload className="h-4 w-4" />استيراد جدول الجامعة أو Excel<input type="file" accept=".xlsx" disabled={busy} className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(async () => { setImported([]); setImportReview(null); const review = await readScheduleWorkbook(await file.arrayBuffer(), data); setImported(review.entries); setImportReview(review); setImportRevision(data.revision ?? null); }); }} /></label><Button disabled={busy} onClick={() => setDraft(emptyEntry(section))}><Plus className="h-4 w-4 ml-2" />إضافة حصة</Button></>}
          </div>
        </div>
        <AcademicScheduleSettings value={editableSettings} saved={settings} busy={busy} onChange={setSettingsDraft} onReset={() => setSettingsDraft(null)} onSave={() => void run(async () => {
          const result = await supabase.rpc('save_academic_settings', { p_department: data.department, p_year: data.academic_year, p_settings: editableSettings });
          if (result.error) throw new Error(result.error.message);
          await load(); toast.success('تم حفظ إعدادات الجدول');
        })} />
        {draft && data.can_edit && <div className="rounded-xl border border-primary/40 p-4 space-y-4"><h3 className="font-bold">{draft.id ? 'تعديل الحصة' : 'حصة جديدة'}</h3><div className="grid sm:grid-cols-3 gap-3">
          <div><Label htmlFor="entry-section">السكشن</Label><select id="entry-section" className={selectClass} value={draft.section} onChange={e => field('section', Number(e.target.value))}>{Array.from({ length: 15 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></div>
          <div><Label htmlFor="entry-day">اليوم</Label><select id="entry-day" className={selectClass} value={draft.day_index} onChange={e => field('day_index', Number(e.target.value))}>{ACADEMIC_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
          <div><Label htmlFor="entry-period">الحصة</Label><select id="entry-period" className={selectClass} value={draft.period} onChange={e => field('period', Number(e.target.value))}>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i + 1}>{i + 1} · {slotTime(settings.start_time, i + 1)}</option>)}</select></div>
          <div><Label htmlFor="entry-subject">المادة</Label><select id="entry-subject" className={selectClass} value={draft.subject_id} onChange={e => { field('subject_id', e.target.value); field('instructor_id', null); field('instructor_name', ''); }}><option value="">اختر المادة</option>{data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><Label htmlFor="entry-kind">نوع الحصة</Label><select id="entry-kind" className={selectClass} value={draft.kind} onChange={e => { field('kind', e.target.value as 'lecture' | 'section'); field('instructor_id', null); field('instructor_name', ''); field('uses_rotation', false); }}><option value="lecture">محاضرة</option><option value="section">سكشن</option></select></div>
          <div><Label htmlFor="entry-instructor">الدكتور / المعيد</Label><select id="entry-instructor" className={selectClass} value={draft.instructor_id ?? ''} onChange={e => { field('instructor_id', e.target.value || null); field('instructor_name', data.instructors.find(u => u.id === e.target.value)?.name ?? ''); }}><option value="">لم يُحدد بعد</option>{data.instructors.filter(u => u.role === (draft.kind === 'lecture' ? 'doctor' : 'ta') && u.subjects.includes(draft.subject_id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div><Label htmlFor="entry-pattern">تكرار الحصة</Label><select id="entry-pattern" className={selectClass} value={draft.week_pattern} onChange={e => field('week_pattern', Number(e.target.value))}><option value="0">كل أسبوع</option><option value="1">الأسبوع الأول فقط</option><option value="2">الأسبوع الثاني فقط</option></select></div>
          <div><Label htmlFor="entry-room">المكان الثابت</Label><Input id="entry-room" value={draft.room} disabled={draft.uses_rotation} onChange={e => field('room', e.target.value)} /></div>
          {draft.kind === 'section' && <label className="flex gap-2 items-center"><input type="checkbox" checked={draft.uses_rotation} onChange={e => field('uses_rotation', e.target.checked)} />مكان يتغير بين الأسبوعين</label>}
          {draft.uses_rotation && <><div><Label htmlFor="entry-lab">المكان الأول</Label><Input id="entry-lab" value={draft.lab_room} onChange={e => field('lab_room', e.target.value)} /></div><div><Label htmlFor="entry-hall">المكان الثاني</Label><Input id="entry-hall" value={draft.hall_room} onChange={e => field('hall_room', e.target.value)} /></div><div><Label htmlFor="entry-lab-week">أسبوع المكان الأول</Label><select id="entry-lab-week" className={selectClass} value={draft.lab_week} onChange={e => field('lab_week', Number(e.target.value))}><option value="1">الأسبوع الأول</option><option value="2">الأسبوع الثاني</option></select></div></>}
        </div><div className="flex gap-2"><Button disabled={busy} onClick={() => void saveEntry()}>حفظ الحصة</Button><Button variant="outline" onClick={() => setDraft(null)}>إلغاء</Button></div></div>}
        {imported.length > 0 && <div className="rounded-xl border p-4 space-y-3"><h3 className="font-bold">معاينة الاستيراد · {imported.length} حصة</h3><p className="text-sm">{importReview?.format === 'university' ? `شيت ${importReview.sheet_name} · سيتم استبدال جدول الفرقة ${data.academic_year} بالكامل: حذف الحصص الحالية (${data.entries.length})، بما فيها إضافاتك اليدوية، واعتماد ${imported.length} حصة من الملف. بقية الفرق والامتحانات محفوظة. الحفظ كاملًا أو رفضه كاملًا عند وجود خطأ.` : 'سيتم تحديث الحصص المطابقة وإضافة الجديدة دون حذف بقية الجدول. الحفظ كاملًا أو رفضه كاملًا عند وجود تعارض.'}</p>{importReview?.warnings.map(warning => <p key={warning} className="text-sm text-amber-400">{warning}</p>)}{imported.some(e => e.instructor_name && !e.instructor_id) && <p className="text-sm text-amber-400">بعض أسماء المحاضرين للعرض فقط. لا يمنح الاستيراد حسابات أو صلاحيات؛ يمكنك ربط حساباتهم المسندة للمواد من تعديل الحصة لاحقًا.</p>}<div className="max-h-60 overflow-auto text-sm">{imported.slice(0, 50).map((entry, i) => <p key={i}>سكشن {entry.section} · {ACADEMIC_DAYS[entry.day_index]} · {slotTime(settings.start_time, entry.period)}–{slotTime(settings.start_time, entry.period + 1)} · {entry.room} · {data.subjects.find(s => s.id === entry.subject_id)?.name} · {entry.week_pattern ? `الأسبوع ${entry.week_pattern}` : 'كل أسبوع'}</p>)}</div><Button disabled={busy} onClick={() => void run(async () => { if (importReview?.format === 'university' && !importRevision) throw new Error('schedule_changed'); const result = importReview?.format === 'university' ? await supabase.rpc('replace_academic_schedule', { p_department: data.department, p_year: data.academic_year, p_entries: imported, p_expected_revision: importRevision }) : await supabase.rpc('import_academic_entries', { p_department: data.department, p_year: data.academic_year, p_entries: imported }); if (result.error) throw new Error(result.error.message); setImported([]); setImportReview(null); await load(); toast.success('تم اعتماد الجدول المستورد'); })}>اعتماد الاستيراد</Button><Button variant="outline" onClick={() => { setImported([]); setImportReview(null); }}>إلغاء</Button></div>}
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="manage-section">عرض سكشن</Label><select id="manage-section" className={selectClass} value={section} onChange={event => { setSection(Number(event.target.value)); setView('mine'); }}>{Array.from({length:15}, (_,index) => <option key={index} value={index+1}>سكشن {index+1}</option>)}</select></div><div><Label htmlFor="manage-week">الأسبوع</Label><select id="manage-week" className={selectClass} value={previewCycle} onChange={event => setPreviewCycle(event.target.value)}><option value="auto">الأسبوع الحالي</option><option value="1">الأسبوع الأول</option><option value="2">الأسبوع الثاني</option></select></div></div>
        {days.filter(day => visibleEntries.some(entry => entry.day_index === day)).map(day => <section key={day} className="rounded-xl border p-4"><h3 className="font-bold mb-3">{ACADEMIC_DAYS[day]} {settings.days_off.includes(day) && <span className="text-amber-400 text-sm">· إجازة</span>}</h3>
          {settings.days_off.includes(day) ? <p className="text-sm text-muted-foreground">هذا اليوم إجازة حسب الإعدادات. تبقى حصصه محفوظة لتظهر عند إلغاء الإجازة.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleEntries.filter(e => e.day_index === day).map(e => <article key={e.id} className="rounded-lg bg-muted/40 p-3 text-sm space-y-1"><p className="font-bold">{e.subject_name}</p><p>{e.kind === 'lecture' ? 'محاضرة' : 'سكشن'} · سكشن {e.section} · {slotTime(settings.start_time, e.period)}–{slotTime(settings.start_time, e.period + 1)}</p><p>{e.instructor_name || 'المحاضر لم يُحدد'}</p><p>{cycle ? scheduleRoom(e, cycle) || 'المكان لم يُحدد' : e.uses_rotation ? `الأسبوع ${e.lab_week}: ${e.lab_room} · الأسبوع الآخر: ${e.hall_room}` : e.room || 'المكان لم يُحدد'}</p>{/^O\.[LN]$/i.test(e.room.trim()) && <p>محاضرة مسجلة تُنشر في مجموعة الطلاب</p>}{e.week_pattern > 0 && <p>الأسبوع {e.week_pattern} فقط</p>}{data.can_edit && <div className="flex gap-2 pt-2"><Button size="sm" variant="outline" onClick={() => setDraft(e)}>تعديل</Button><Button size="sm" variant="outline" disabled={busy} aria-label={`حذف حصة ${e.subject_name}`} onClick={() => void run(async () => { const result = await supabase.rpc('delete_academic_entry', { p_id: e.id }); if (result.error) throw new Error(result.error.message); await load(); })}><Trash2 className="h-4 w-4" /></Button></div>}</article>)}{!visibleEntries.some(e => e.day_index === day) && <p className="text-sm text-muted-foreground">لا توجد حصص مضافة لهذا اليوم.</p>}</div>}
        </section>)}
        </>}
      </TabsContent>
      <TabsContent value="exams"><ExamSchedulePanel department={data.department} academicYear={data.academic_year} canEdit={data.can_edit} studentSection={data.student_section} /></TabsContent>
    </Tabs>
  </div>;
}
