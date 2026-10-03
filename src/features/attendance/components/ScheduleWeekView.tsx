import { useState } from 'react';
import { CalendarDays, Clock3, MapPin, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACADEMIC_DAYS, cairoDate, scheduleCycle, weeklyScheduleCycle, weekStartDate, scheduleRoom, slotTime, type AcademicSchedule } from '../utils/academicSchedule';

interface Props {
  data: AcademicSchedule; student: boolean; section: number; view: string; date: string; cycle: number;
  actualWeek: number | null; previewCycle: string; now?: Date; clockSynced?: boolean; onToday?: () => void;
  onSection: (value: number) => void; onView: (value: string) => void;
  onDate: (value: string) => void; onCycle: (value: string) => void;
}
const timeLabel = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour! % 12 || 12}:${String(minute).padStart(2, '0')} ${hour! >= 12 ? 'م' : 'ص'}`;
};

export function ScheduleWeekView({ data, student, section, view, date, cycle, actualWeek, previewCycle, onSection, onView, onDate, onCycle, now, clockSynced, onToday }: Props) {
  const [dayChoice, setSelectedDay] = useState<number | null | 'today'>('today');
  const [search, setSearch] = useState('');
  const [expandedDays, setExpandedDays] = useState<number[]>([]);
  const query = search.trim().normalize('NFKC').toLocaleLowerCase();
  const dateDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  const selectedDay = dayChoice === 'today' ? dateDay : dayChoice;
  const dayDate = (day: number) => {
    const start = new Date(`${weekStartDate(date, data.settings.week_start_day)}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + (day - data.settings.week_start_day + 7) % 7);
    return start.toISOString().slice(0, 10);
  };
  const dayCycle = (day: number) => previewCycle === 'auto' ? scheduleCycle(dayDate(day), data) : cycle;
  const days = Array.from({ length: 7 }, (_, index) => (data.settings.week_start_day + index) % 7);
  const entries = data.entries.filter(entry => (view === 'all' || (!student || data.student_section) && entry.section === section)
    && (!entry.week_pattern || entry.week_pattern === dayCycle(entry.day_index))
    && (!query || [entry.subject_name ?? data.subjects.find(subject => subject.id === entry.subject_id)?.name, scheduleRoom(entry, dayCycle(entry.day_index)), entry.instructor_name].join(' ').normalize('NFKC').toLocaleLowerCase().includes(query)));
  const groupKey = (entry: typeof entries[number]) => JSON.stringify([entry.period,entry.subject_id,entry.kind,entry.instructor_id,entry.instructor_name,scheduleRoom(entry,dayCycle(entry.day_index))]);
  return <section aria-label="مواعيد الأسبوع" className="space-y-4">
    <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <div><h3 className="font-bold text-lg">{selectedDay === null ? 'الجدول الأسبوعي' : selectedDay === dateDay && (!now || cairoDate(now) === date) ? 'جدول اليوم' : `جدول ${ACADEMIC_DAYS[selectedDay]}`}{student && view === 'mine' ? ` · سكشن ${data.student_section ?? 'غير محدد'}` : ''}</h3><p className="text-sm text-muted-foreground mt-1">{actualWeek && previewCycle === 'auto' ? `الأسبوع الدراسي ${actualWeek} · ` : ''}{(selectedDay === null ? previewCycle === 'auto' ? weeklyScheduleCycle(date, data) : cycle : dayCycle(selectedDay)) === 1 ? 'مواعيد الأسبوع الأول' : 'مواعيد الأسبوع الثاني'} · كل حصة ساعة</p></div>
        <div className="flex gap-1 rounded-xl border p-1" role="group" aria-label="اختيار الأسبوع">
          {[{ value:'1', label:'الأول' }, { value:'2', label:'الثاني' }].map(item => <Button key={item.value} variant={previewCycle === item.value ? 'default' : 'ghost'} aria-pressed={previewCycle === item.value} className="min-h-11" onClick={() => onCycle(item.value)}>{item.label}</Button>)}
          <Button variant={previewCycle === 'auto' ? 'default' : 'ghost'} aria-pressed={previewCycle === 'auto'} className="min-h-11" onClick={() => onCycle('auto')}>الحالي</Button>
        </div>
      </div>
      {now && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 p-3"><div className="space-y-1"><p className="text-sm">{new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now)}</p><p className="font-bold tabular-nums" dir="ltr">{new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now)}</p><p className="text-xs text-muted-foreground">توقيت مصر{!clockSynced ? ' · جارٍ ضبط الوقت' : ''}</p></div><Button variant="outline" className="min-h-11" onClick={() => { setSelectedDay('today'); onToday?.(); }}>العودة لجدول اليوم</Button></div>}
      <div className="flex flex-wrap gap-2" role="group" aria-label="نطاق عرض الجدول">
        <Button variant={view === 'mine' ? 'default' : 'outline'} aria-pressed={view === 'mine'} onClick={() => onView('mine')}>{student ? 'جدول سكشني' : 'سكشن محدد'}</Button>
        <Button variant={view === 'all' ? 'default' : 'outline'} aria-pressed={view === 'all'} onClick={() => onView('all')}>كل السكاشن</Button>
        {!student && view === 'mine' && <select aria-label="السكشن" className="h-11 rounded-lg border bg-background px-3" value={section} onChange={event => onSection(Number(event.target.value))}>{Array.from({length:15}, (_, index) => <option key={index} value={index+1}>سكشن {index+1}</option>)}</select>}
      </div>
      {student && !data.student_section && <p role="alert" className="text-amber-400 text-sm">لم يُحدد سكشن حسابك بعد. تواصل مع الإدارة، أو اختر كل السكاشن للاطلاع على المواعيد.</p>}
      <div className="space-y-2"><Label htmlFor="schedule-search">ابحث في المواعيد</Label><div className="flex gap-2"><Input id="schedule-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="المادة أو المكان أو المحاضر" />{search && <Button variant="outline" onClick={() => setSearch('')}>مسح</Button>}</div></div>
      <details><summary className="text-sm text-muted-foreground cursor-pointer">عرض أسبوع بتاريخ آخر</summary><div className="max-w-xs mt-3 space-y-2"><Label htmlFor="schedule-date">تاريخ العرض</Label><Input id="schedule-date" type="date" value={date} onChange={event => { onDate(event.target.value); onCycle('auto'); }} /></div></details>
    </div>
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2" role="group" aria-label="أيام الجدول">
      <Button variant={selectedDay === null ? 'default' : 'outline'} aria-pressed={selectedDay === null} className="h-auto min-h-14 whitespace-normal" onClick={() => setSelectedDay(null)}>الأسبوع كاملًا</Button>
      {days.map(day => <Button key={day} variant={selectedDay === day ? 'default' : 'outline'} aria-pressed={selectedDay === day} className="h-auto min-h-14 flex-col gap-1 px-1" onClick={() => setSelectedDay(day)}><span>{ACADEMIC_DAYS[day]}</span><span className="text-xs">{data.settings.days_off.includes(day) ? 'إجازة' : `${new Set(entries.filter(entry => entry.day_index === day).map(groupKey)).size} موعد`}</span></Button>)}
    </div>
    {data.entries.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center"><CalendarDays className="h-9 w-9 text-primary mx-auto mb-3" /><h3 className="font-bold">الجدول لم يُنشر بعد</h3><p className="text-sm text-muted-foreground mt-2">ستظهر المواعيد هنا بمجرد اعتمادها من إدارة القسم.</p></div>
      : <div className="space-y-5">{days.filter(day => selectedDay === null ? entries.some(entry => entry.day_index === day) && !data.settings.days_off.includes(day) : selectedDay === day).map(day => {
        const groups = new Map<string, typeof entries>();
        entries.filter(entry => entry.day_index === day).sort((a,b) => a.period-b.period || a.section-b.section).forEach(entry => {
          const key = groupKey(entry);
          groups.set(key, [...(groups.get(key) ?? []), entry]);
        });
        const open = selectedDay !== null || Boolean(query) || expandedDays.includes(day);
        const heading = <><span>{ACADEMIC_DAYS[day]}</span><span className="text-sm font-normal text-muted-foreground">{dayDate(day)} · الأسبوع {dayCycle(day)} · {groups.size} موعد</span></>;
        const content = open && (data.settings.days_off.includes(day) ? <p className="rounded-xl border p-5 text-muted-foreground">إجازة حسب الجدول المعتمد.</p> : !groups.size ? <p className="rounded-xl border p-5 text-muted-foreground">لا توجد مواعيد لهذا اليوم في الأسبوع المختار.</p> : <div className="grid gap-3 xl:grid-cols-2">{[...groups.entries()].map(([key, group]) => {
            const entry = group[0]!; const room = scheduleRoom(entry, dayCycle(day)); const remote = /^O\.[LN]$/i.test(room.trim());
            return <article key={key} className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
              <div className="flex gap-3 items-start"><div className="rounded-xl bg-primary/10 px-3 py-2 text-primary shrink-0 text-center"><Clock3 aria-hidden="true" className="h-4 w-4 mx-auto mb-1" /><p className="font-bold text-sm">{timeLabel(slotTime(data.settings.start_time, entry.period))}</p><p className="text-xs mt-1">{timeLabel(slotTime(data.settings.start_time, entry.period+1))}</p></div><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground mb-1">{entry.kind === 'lecture' ? 'محاضرة' : 'سكشن'}</p><h4 className="font-bold break-words" dir="auto">{entry.subject_name ?? data.subjects.find(subject => subject.id === entry.subject_id)?.name}</h4>{view === 'all' && <p className="text-xs text-primary mt-2">{group.length === 15 ? 'كل السكاشن' : `السكاشن: ${[...new Set(group.map(item => item.section))].join('، ')}`}</p>}</div></div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><p className="flex items-center gap-2"><MapPin aria-hidden="true" className="h-4 w-4 text-primary shrink-0" />{remote ? 'محاضرة مسجلة' : room || 'المكان لم يُحدد'}</p><p className="flex items-center gap-2"><UserRound aria-hidden="true" className="h-4 w-4 text-muted-foreground shrink-0" />{entry.instructor_name || 'المحاضر لم يُحدد'}</p></div>{remote && <p className="text-xs text-muted-foreground">يُنشر الفيديو في مجموعة الطلاب.</p>}
            </article>;
          })}</div>);
        return selectedDay === null ? <details key={day} open={open} className="rounded-2xl border bg-card" onToggle={event => { if (query) return; const nextOpen = event.currentTarget.open; setExpandedDays(previous => nextOpen ? previous.includes(day) ? previous : [...previous, day] : previous.filter(value => value !== day)); }}><summary className="min-h-14 cursor-pointer p-4 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span className="inline-flex flex-wrap gap-x-3 gap-y-1">{heading}</span></summary><div className="p-3 sm:p-4 pt-0">{content}</div></details> : <section key={day} className="space-y-3"><h3 className="font-bold text-lg flex flex-wrap gap-3">{heading}</h3>{content}</section>;
      })}{!entries.some(entry => !data.settings.days_off.includes(entry.day_index) && (selectedDay === null || selectedDay === entry.day_index)) && query && <p role="status" className="rounded-2xl border p-6 text-center text-muted-foreground">لا توجد مواعيد مطابقة للبحث في العرض المختار.</p>}{selectedDay === null && !query && !entries.some(entry => !data.settings.days_off.includes(entry.day_index)) && <p className="rounded-2xl border p-8 text-center text-muted-foreground">لا توجد مواعيد للسكشن في الأسبوع المختار.</p>}</div>}
  </section>;
}
