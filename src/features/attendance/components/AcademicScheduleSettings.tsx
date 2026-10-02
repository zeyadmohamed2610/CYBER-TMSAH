import { CalendarDays, Check, ChevronDown, Clock3, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACADEMIC_DAYS, type AcademicSettings } from '../utils/academicSchedule';

interface Props {
  value: AcademicSettings;
  saved: AcademicSettings;
  busy: boolean;
  onChange: (value: AcademicSettings) => void;
  onReset: () => void;
  onSave: () => void;
}

export function AcademicScheduleSettings({ value, saved, busy, onChange, onReset, onSave }: Props) {
  const dirty = value.semester_start !== saved.semester_start
    || value.week_start_day !== saved.week_start_day
    || value.start_time.slice(0, 5) !== saved.start_time.slice(0, 5)
    || ACADEMIC_DAYS.some((_, day) => value.days_off.includes(day) !== saved.days_off.includes(day));
  const days = Array.from({ length: 7 }, (_, index) => (value.week_start_day + index) % 7);
  const controlClass = 'h-12 min-w-0 w-full rounded-xl text-base';

  return <details className="group overflow-hidden rounded-2xl border bg-card" data-testid="academic-settings">
    <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5 [&::-webkit-details-marker]:hidden">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block font-bold leading-relaxed">إعدادات بداية الدراسة والإجازات</span><span className="mt-1 block text-sm text-muted-foreground">اضبط بداية الأسبوع ومواعيد الدراسة وأيام الإجازة.</span></span>
      <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <form className="border-t" onSubmit={event => { event.preventDefault(); if (dirty && !busy) onSave(); }}>
      <fieldset disabled={busy} className="min-w-0 space-y-6 p-4 disabled:opacity-60 sm:p-5">
        <legend className="sr-only">مواعيد الدراسة وأيام الإجازة</legend>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0 space-y-2"><Label htmlFor="semester-start" className="text-sm font-semibold">بداية الدراسة</Label>
            <Input id="semester-start" type="date" dir="ltr" className={controlClass} aria-describedby="semester-start-help" value={value.semester_start ?? ''} onChange={event => onChange({ ...value, semester_start: event.target.value || null })} />
            <p id="semester-start-help" className="text-xs leading-relaxed text-muted-foreground">من هذا التاريخ يبدأ حساب الأسبوع الأول والثاني.</p>
          </div>
          <div className="min-w-0 space-y-2"><Label htmlFor="week-start" className="text-sm font-semibold">أول يوم في الأسبوع</Label>
            <select id="week-start" className={`${controlClass} border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} aria-describedby="week-start-help" value={value.week_start_day} onChange={event => onChange({ ...value, week_start_day: Number(event.target.value) })}>
              {ACADEMIC_DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
            <p id="week-start-help" className="text-xs leading-relaxed text-muted-foreground">يُرتّب الجدول بدايةً من اليوم الذي تختاره.</p>
          </div>
          <div className="min-w-0 space-y-2"><Label htmlFor="day-start" className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />بداية أول حصة</Label>
            <Input id="day-start" type="time" dir="ltr" required className={controlClass} aria-describedby="day-start-help" value={value.start_time.slice(0, 5)} onChange={event => onChange({ ...value, start_time: event.target.value })} />
            <p id="day-start-help" className="text-xs leading-relaxed text-muted-foreground">مدة كل حصة ساعة، وتبدأ الحصص التالية بعدها.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div><h4 id="days-off-heading" className="font-semibold">أيام الدراسة والإجازة</h4><p id="days-off-help" className="mt-1 text-sm leading-relaxed text-muted-foreground">اضغط على أي يوم لجعله إجازة أو يوم دراسة.</p></div>
          <div role="group" aria-labelledby="days-off-heading" aria-describedby="days-off-help" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {days.map(day => {
              const off = value.days_off.includes(day);
              return <button key={day} type="button" aria-pressed={off} aria-label={`${ACADEMIC_DAYS[day]}: ${off ? 'إجازة' : 'يوم دراسة'}`} onClick={() => onChange({ ...value, days_off: off ? value.days_off.filter(index => index !== day) : [...value.days_off, day] })}
                className={`relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait ${off ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'}`}>
                <span className="font-semibold">{ACADEMIC_DAYS[day]}</span><span className="flex items-center gap-1 text-xs">{off && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{off ? 'إجازة' : 'يوم دراسة'}</span>
              </button>;
            })}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">حصص يوم الإجازة تبقى محفوظة، وتظهر مجددًا عند تحويله إلى يوم دراسة.</p>
        </div>
      </fieldset>
      <div className="flex flex-col gap-3 border-t bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p role="status" className={`text-sm ${dirty ? 'text-primary' : 'text-muted-foreground'}`}>{busy ? 'جارٍ حفظ الإعدادات…' : dirty ? 'لديك تغييرات لم تُحفظ' : 'الإعدادات الحالية محفوظة'}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {dirty && <Button type="button" variant="outline" disabled={busy} className="min-h-12 rounded-xl" onClick={onReset}><RotateCcw className="ml-2 h-4 w-4" aria-hidden="true" />التراجع عن التغييرات</Button>}
          <Button type="submit" disabled={busy || !dirty} className="min-h-12 rounded-xl">{busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="ml-2 h-4 w-4" aria-hidden="true" />}{busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</Button>
        </div>
      </div>
    </form>
  </details>;
}
