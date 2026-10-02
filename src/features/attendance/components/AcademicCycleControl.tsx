import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { scheduleCycle, weeklyScheduleCycle, weekStartDate, type AcademicSchedule } from '../utils/academicSchedule';

interface Props { data: AcademicSchedule; today: string; busy: boolean; onSave: (date: string, cycle: number | null, scope: string) => void }
export function AcademicCycleControl({ data, today, busy, onSave }: Props) {
  const [scope, setScope] = useState('week');
  const [date, setDate] = useState(today);
  const [cycle, setCycle] = useState<number | null>(() => weeklyScheduleCycle(today, data));
  const chooseScope = (next: string) => {
    setScope(next);
    if (date) setCycle(next === 'week' ? weeklyScheduleCycle(date, data) : scheduleCycle(date, data));
  };
  return <section className="rounded-2xl border bg-card p-4 sm:p-5 space-y-4" aria-label="تحديد الأسبوع المعروض">
    <div><h3 className="font-bold">تحديد الأسبوع المعروض</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">اختر الأسبوع الأول أو الثاني للجميع، أو استثنِ يومًا واحدًا.</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="نطاق تغيير الأسبوع">
      <Button disabled={busy} aria-pressed={scope === 'week'} variant={scope === 'week' ? 'default' : 'outline'} onClick={() => chooseScope('week')}>تحديد الأسبوع</Button>
      <Button disabled={busy} aria-pressed={scope === 'day'} variant={scope === 'day' ? 'default' : 'outline'} onClick={() => chooseScope('day')}>استثناء يوم</Button>
    </div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 min-w-0"><Label htmlFor="cycle-date">{scope === 'week' ? 'تاريخ داخل الأسبوع المطلوب' : 'اليوم المطلوب'}</Label><Input id="cycle-date" type="date" dir="ltr" disabled={busy} className="h-12 min-w-0 text-base" value={date} onChange={event => { setDate(event.target.value); if (event.target.value) setCycle(scope === 'week' ? weeklyScheduleCycle(event.target.value, data) : scheduleCycle(event.target.value, data)); }} /></div>
      <div className="space-y-2"><p className="text-sm font-medium">المواعيد التي ستظهر</p><div className="flex gap-2" role="group" aria-label="الأسبوع المعتمد">{[1, 2].map(value => <Button key={value} disabled={busy} className="min-h-12 flex-1" aria-pressed={cycle === value} variant={cycle === value ? 'default' : 'outline'} onClick={() => setCycle(value)}>الأسبوع {value === 1 ? 'الأول' : 'الثاني'}</Button>)}</div></div>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed">{scope === 'week' ? 'يبدأ التناوب من الأسبوع المختار، ثم يتبدّل تلقائيًا كل أسبوع. الاستثناءات اليومية تبقى كما حددتها.' : 'يتغير هذا التاريخ وحده؛ بقية الأيام تتبع تناوب الأسبوع تلقائيًا.'}</p>
    <div className="flex flex-col gap-2 sm:flex-row"><Button className="min-h-12" disabled={busy || !date || cycle === null} onClick={() => onSave(scope === 'week' ? weekStartDate(date, data.settings.week_start_day) : date, cycle, scope)}>اعتماد للجميع</Button>
      <Button className="min-h-12" variant="outline" disabled={busy || !date} onClick={() => onSave(date, null, scope)}>{scope === 'day' ? 'إلغاء استثناء هذا اليوم' : 'العودة لحساب بداية الدراسة'}</Button></div>
    {!!Object.keys(data.cycles?.days ?? {}).length && <details className="border-t pt-3"><summary className="cursor-pointer text-sm">الاستثناءات اليومية المحفوظة</summary><ul className="mt-3 space-y-2">{Object.entries(data.cycles!.days).sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => <li key={day} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{day} · الأسبوع {value}</span><Button size="sm" variant="outline" disabled={busy} aria-label={`إلغاء استثناء ${day}`} onClick={() => onSave(day, null, 'day')}>إلغاء الاستثناء</Button></li>)}</ul></details>}
  </section>;
}
