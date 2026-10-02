import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { getFriendlyErrorMessage } from '@/lib/academicCopy';
import { toast } from 'sonner';
import { DEPARTMENTS } from '../types';
import { useAttendanceAuth } from '../context/AttendanceAuthContext';

interface SubjectItem { id: string; name: string; doctor_name: string | null }

export function DepartmentsAndSubjectsPanel() {
  const { role, user } = useAttendanceAuth();
  const canEdit = role === 'owner' || role === 'coordinator';
  const [department, setDepartment] = useState<string | null>(role === 'owner' ? 'cybersecurity' : null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<{ id?: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (role === 'owner' || !user?.id) return;
    let active = true;
    void supabase.from('users').select('department').eq('auth_id', user.id).maybeSingle().then(({ data, error: failure }) => {
      if (!active) return;
      if (failure || !data?.department) { setError('لم يُحدد قسم حسابك بعد. تواصل مع الإدارة.'); setLoading(false); }
      else setDepartment(data.department);
    });
    return () => { active = false; };
  }, [role, user?.id]);
  const load = useCallback(async () => {
    if (!department) return;
    const version = ++requestVersion.current;
    setLoading(true); setSubjects([]); setError('');
    const { data, error: failure } = await supabase.from('subjects').select('id, name, doctor_name').eq('department', department).order('name');
    if (version !== requestVersion.current) return;
    if (failure) setError(getFriendlyErrorMessage(failure.message, 'تعذر تحميل المواد. حاول مرة أخرى.'));
    else setSubjects(data ?? []);
    setLoading(false);
  }, [department]);
  const invalidateRequests = useCallback(() => { requestVersion.current++; }, []);
  useEffect(() => { setDraft(null); setSearch(''); void load(); return invalidateRequests; }, [load, invalidateRequests]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !department || !draft?.name.trim()) return;
    setBusy(true);
    try {
      const payload = { name: draft.name.trim() };
      const result = draft.id
        ? await supabase.from('subjects').update(payload).eq('id', draft.id).eq('department', department).select('id').single()
        : await supabase.from('subjects').insert({ ...payload, department, doctor_name: 'غير محدد' }).select('id').single();
      if (result.error) throw result.error;
      setDraft(null); await load(); toast.success('تم حفظ المادة');
    } catch (failure) { toast.error(getFriendlyErrorMessage(failure instanceof Error ? failure.message : String((failure as {message?:string})?.message ?? ''), 'تعذر حفظ المادة.')); }
    finally { setBusy(false); }
  };
  const remove = async (subject: SubjectItem) => {
    if (!canEdit || !confirm(`حذف مادة «${subject.name}»؟`)) return;
    setBusy(true);
    const result = await supabase.from('subjects').delete().eq('id', subject.id).eq('department', department!).select('id').single();
    if (result.error) toast.error(getFriendlyErrorMessage(result.error.message, 'تعذر حذف المادة.'));
    else { await load(); toast.success('تم حذف المادة'); }
    setBusy(false);
  };
  const displayed = subjects.filter(subject => subject.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <section dir="rtl" className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />{canEdit ? 'الأقسام والمواد' : 'موادي الدراسية'}</h2><p className="text-sm text-muted-foreground mt-1">{DEPARTMENTS.find(item => item.id === department)?.nameAr ?? 'مواد قسمك الدراسي'}</p></div>
      {canEdit && <Button disabled={!department || busy} onClick={() => setDraft({ name: '' })}><Plus className="h-4 w-4 ml-2" />إضافة مادة جديدة</Button>}
    </header>
    <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border p-4">
      {role === 'owner' && <div className="space-y-2"><Label htmlFor="subjects-department">القسم</Label><select id="subjects-department" value={department ?? ''} disabled={busy} onChange={event => setDepartment(event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3">{DEPARTMENTS.map(item => <option key={item.id} value={item.id}>{item.nameAr}</option>)}</select></div>}
      <div className="space-y-2"><Label htmlFor="subjects-search">البحث عن مادة</Label><div className="relative"><Search aria-hidden="true" className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="subjects-search" className="h-11 pr-10" value={search} onChange={event => setSearch(event.target.value)} placeholder="اكتب اسم المادة" /></div></div>
    </div>
    {draft && canEdit && <form onSubmit={event => void save(event)} className="rounded-2xl border border-primary/40 p-4 space-y-3"><Label htmlFor="subject-name">{draft.id ? 'تعديل اسم المادة' : 'اسم المادة الجديدة'}</Label><Input id="subject-name" autoFocus required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} disabled={busy} /><div className="flex gap-2"><Button disabled={busy} type="submit">حفظ المادة</Button><Button disabled={busy} variant="outline" type="button" onClick={() => setDraft(null)}>إلغاء</Button></div></form>}
    {error ? <div role="alert" className="rounded-xl border p-4">{error}{department && <Button variant="outline" onClick={() => void load()}>إعادة المحاولة</Button>}</div>
      : loading ? <p role="status" className="p-6 text-muted-foreground">جارٍ تحميل المواد...</p>
      : displayed.length === 0 ? <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">{search ? 'لا توجد مادة بهذا الاسم.' : 'لا توجد مواد مسجلة لهذا القسم حاليًا.'}</p>
      : <div className="grid gap-3 md:grid-cols-2">{displayed.map(subject => <article key={subject.id} className="flex items-start gap-3 rounded-2xl border bg-card p-4"><BookOpen aria-hidden="true" className="h-5 w-5 text-primary shrink-0 mt-1" /><div className="flex-1 min-w-0"><h3 className="font-semibold break-words" dir="auto">{subject.name}</h3>{subject.doctor_name && subject.doctor_name !== 'غير محدد' && <p className="text-sm text-muted-foreground mt-1">{subject.doctor_name}</p>}</div>{canEdit && <div className="flex gap-1"><Button disabled={busy} variant="ghost" size="icon" aria-label={`تعديل ${subject.name}`} onClick={() => setDraft({ id: subject.id, name: subject.name })}><Edit2 className="h-4 w-4" /></Button><Button disabled={busy} variant="ghost" size="icon" aria-label={`حذف ${subject.name}`} onClick={() => void remove(subject)}><Trash2 className="h-4 w-4 text-rose-400" /></Button></div>}</article>)}</div>}
    {!loading && !error && <p className="text-sm text-muted-foreground">{displayed.length} مادة{search ? ` من ${subjects.length}` : ''}</p>}
  </section>;
}
