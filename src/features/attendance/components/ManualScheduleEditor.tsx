import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ManualEntry {
  id: string;
  day: string;
  time_slot: string;
  subject: string;
  instructor: string;
  room: string;
  entry_type: "lecture" | "section";
  note: string;
}

const STORAGE_KEY = "cyber_manual_schedule";

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

function load(): ManualEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function save(items: ManualEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function ManualScheduleEditor() {
  const [entries, setEntries] = useState<ManualEntry[]>(load());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    day: "السبت",
    time_slot: "9:00 AM - 10:00 AM",
    subject: "",
    instructor: "",
    room: "",
    entry_type: "lecture" as "lecture" | "section",
    note: "",
  });

  const resetForm = () => {
    setForm({ day: "السبت", time_slot: "9:00 AM - 10:00 AM", subject: "", instructor: "", room: "", entry_type: "lecture", note: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.subject || !form.time_slot) {
      toast.error("الرجاء إدخال اسم المادة والوقت");
      return;
    }

    if (editingId) {
      const updated = entries.map(e => e.id === editingId ? { ...form, id: editingId } : e);
      save(updated);
      setEntries(updated);
      toast.success("تم التعديل بنجاح");
    } else {
      const newEntry: ManualEntry = { ...form, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      const updated = [...entries, newEntry];
      save(updated);
      setEntries(updated);
      toast.success("تمت الإضافة بنجاح");
    }
    resetForm();
  };

  const handleEdit = (entry: ManualEntry) => {
    setForm({ day: entry.day, time_slot: entry.time_slot, subject: entry.subject, instructor: entry.instructor, room: entry.room, entry_type: entry.entry_type, note: entry.note });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    save(updated);
    setEntries(updated);
    toast.success("تم الحذف");
  };

  return (
    <Card dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4 text-primary" />
            تعديلات يدوية على الجدول
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(!showForm); }} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            إضافة
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          استخدم هذا لتعديلات مؤقتة (تغيير قاعة، محاضر، إضافة محاضرة تعويضية) بدون تعديل Google Sheet
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">اليوم</Label>
                <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الوقت</Label>
                <Select value={form.time_slot} onValueChange={(v) => setForm({ ...form, time_slot: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:00 AM - 10:00 AM">الفترة الأولى (9:00-10:00)</SelectItem>
                    <SelectItem value="10:05 AM - 11:05 AM">الفترة الثانية (10:05-11:05)</SelectItem>
                    <SelectItem value="11:10 AM - 12:10 PM">الفترة الثالثة (11:10-12:10)</SelectItem>
                    <SelectItem value="12:15 PM - 1:15 PM">الفترة الرابعة (12:15-1:15)</SelectItem>
                    <SelectItem value="1:20 PM - 2:20 PM">الفترة الخامسة (1:20-2:20)</SelectItem>
                    <SelectItem value="2:25 PM - 3:25 PM">الفترة السادسة (2:25-3:25)</SelectItem>
                    <SelectItem value="3:30 PM - 4:30 PM">الفترة السابعة (3:30-4:30)</SelectItem>
                    <SelectItem value="4:35 PM - 5:35 PM">الفترة الثامنة (4:35-5:35)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">المادة</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="مثال: مبادئ الأمن السيبراني" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">المحاضر</Label>
                <Input value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} placeholder="مثال: د. سامح" className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">القاعة</Label>
                <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="G201" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">النوع</Label>
                <Select value={form.entry_type} onValueChange={(v) => setForm({ ...form, entry_type: v as "lecture" | "section" })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lecture">محاضرة</SelectItem>
                    <SelectItem value="section">سكشن</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ملاحظة</Label>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="محاضرة تعويضية" className="h-9 text-sm" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} size="sm" className="flex-1">
                {editingId ? "حفظ التعديل" : "إضافة"}
              </Button>
              <Button onClick={resetForm} size="sm" variant="outline">إلغاء</Button>
            </div>
          </div>
        )}

        {entries.length > 0 ? (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-border/50 p-3 bg-card/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">{entry.day}</span>
                    <span className="text-[10px] text-muted-foreground" dir="ltr">{entry.time_slot}</span>
                    {entry.entry_type === "section" && (
                      <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">سكشن</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-foreground mt-0.5">{entry.subject}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    {entry.instructor && <span>{entry.instructor}</span>}
                    {entry.room && <span>{entry.room}</span>}
                    {entry.note && <span className="text-amber-400">({entry.note})</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(entry)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !showForm && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              لا توجد تعديلات يدوية حالياً
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
