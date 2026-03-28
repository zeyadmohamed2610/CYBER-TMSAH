import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Calendar, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface ScheduleEntry {
  id: string;
  section: number;
  day_of_week: string;
  time_slot: string;
  subject: string;
  instructor: string;
  room: string;
  entry_type: string;
  is_holiday: boolean;
  is_training: boolean;
}

const DAYS = [
  { value: "saturday", label: "السبت" },
  { value: "sunday", label: "الأحد" },
  { value: "monday", label: "الاثنين" },
  { value: "tuesday", label: "الثلاثاء" },
  { value: "wednesday", label: "الأربعاء" },
  { value: "thursday", label: "الخميس" },
  { value: "friday", label: "الجمعة" },
];

const TIME_SLOTS = [
  "09:00 - 10:00",
  "10:10 - 11:10",
  "11:20 - 12:20",
  "12:30 - 13:30",
  "13:40 - 14:40",
  "14:50 - 15:50",
  "16:00 - 17:00",
  "17:10 - 18:10",
];

const SECTIONS = Array.from({ length: 15 }, (_, i) => i + 1);

export function ScheduleEditor() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSection, setFilterSection] = useState("1");
  const [filterDay, setFilterDay] = useState("saturday");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    section: 1,
    day_of_week: "saturday",
    time_slot: "09:00 - 10:00",
    subject: "",
    instructor: "",
    room: "",
    entry_type: "lecture" as string,
    is_holiday: false,
    is_training: false,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("course_schedule")
      .select("*")
      .eq("section", parseInt(filterSection))
      .eq("day_of_week", filterDay)
      .order("sort_order", { ascending: true });
    setEntries((data ?? []) as ScheduleEntry[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [filterSection, filterDay]);

  const resetForm = () => {
    setForm({ section: parseInt(filterSection), day_of_week: filterDay, time_slot: "09:00 - 10:00", subject: "", instructor: "", room: "", entry_type: "lecture", is_holiday: false, is_training: false });
    setShowAdd(false);
    setEditId(null);
  };

  const handleAdd = async () => {
    const { error } = await supabase.rpc("add_schedule_entry", {
      p_section: form.section,
      p_day_of_week: form.day_of_week,
      p_time_slot: form.time_slot,
      p_subject: form.subject,
      p_instructor: form.instructor,
      p_room: form.room,
      p_entry_type: form.entry_type,
      p_is_holiday: form.is_holiday,
      p_is_training: form.is_training,
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Added", description: "Schedule entry added." });
      resetForm();
      await load();
    }
  };

  const handleEdit = async () => {
    if (!editId) return;
    const { error } = await supabase.rpc("update_schedule_entry", {
      p_id: editId,
      p_time_slot: form.time_slot,
      p_subject: form.subject,
      p_instructor: form.instructor,
      p_room: form.room,
      p_entry_type: form.entry_type,
      p_is_holiday: form.is_holiday,
      p_is_training: form.is_training,
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Updated", description: "Schedule entry updated." });
      resetForm();
      await load();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.rpc("delete_schedule_entry", { p_id: id });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Deleted", description: "Schedule entry deleted." });
      await load();
    }
  };

  const startEdit = (entry: ScheduleEntry) => {
    setEditId(entry.id);
    setForm({
      section: entry.section,
      day_of_week: entry.day_of_week,
      time_slot: entry.time_slot,
      subject: entry.subject,
      instructor: entry.instructor,
      room: entry.room,
      entry_type: entry.entry_type,
      is_holiday: entry.is_holiday,
      is_training: entry.is_training,
    });
    setShowAdd(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            Schedule Editor
          </CardTitle>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="gap-1">
            <Plus className="h-3 w-3" /> Add Entry
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs">Section</Label>
            <Select value={filterSection} onValueChange={setFilterSection}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SECTIONS.map((s) => <SelectItem key={s} value={String(s)}>Section {s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs">Day</Label>
            <Select value={filterDay} onValueChange={setFilterDay}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Add/Edit Form */}
        {(showAdd || editId) && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Time Slot</Label>
                <Select value={form.time_slot} onValueChange={(v) => setForm({ ...form, time_slot: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.entry_type} onValueChange={(v) => setForm({ ...form, entry_type: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lecture">Lecture</SelectItem>
                    <SelectItem value="section">Section</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Subject</Label>
                <Input className="h-8 text-sm" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject name" />
              </div>
              <div>
                <Label className="text-xs">Instructor</Label>
                <Input className="h-8 text-sm" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} placeholder="Instructor name" />
              </div>
              <div>
                <Label className="text-xs">Room</Label>
                <Input className="h-8 text-sm" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Room" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-3 w-3" /> Cancel
              </Button>
              <Button size="sm" onClick={editId ? handleEdit : handleAdd}>
                <Check className="h-3 w-3" /> {editId ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {/* Entries Table */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No entries for this section/day.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <Badge variant={entry.entry_type === "section" ? "secondary" : "outline"} className="shrink-0">
                  {entry.time_slot || "N/A"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{entry.subject || "Holiday / Training"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {entry.instructor} {entry.room ? `· ${entry.room}` : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(entry)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
