import { useEffect, useState } from "react";
import { BookPlus, Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { subjectService } from "../services/subjectService";
import type { Subject } from "../types";

export const SubjectManagementPanel = () => {
  const { toast } = useToast();
  const [subjects, setSubjects]   = useState<Subject[]>([]);
  const [loading, setLoading]     = useState(true);

  // New subject form
  const [newName,   setNewName]   = useState("");
  const [newDoctor, setNewDoctor] = useState("");
  const [adding, setAdding]       = useState(false);

  // Inline edit state
  const [editId,     setEditId]   = useState<string | null>(null);
  const [editName,   setEditName] = useState("");
  const [editDoctor, setEditDoctor] = useState("");
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await subjectService.fetchSubjects();
    if (res.data) setSubjects(res.data);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAdding(true);
    const res = await subjectService.createSubject(newName, newDoctor);
    if (res.error) toast({ variant: "destructive", title: "فشل الإضافة", description: res.error });
    else {
      toast({ title: "تمت إضافة المادة ✓" });
      setNewName(""); setNewDoctor("");
      if (res.data) setSubjects(prev => [...prev, res.data!].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setAdding(false);
  };

  const startEdit = (s: Subject) => {
    setEditId(s.id); setEditName(s.name); setEditDoctor(s.doctor_name);
  };

  const cancelEdit = () => setEditId(null);

  const handleSave = async (id: string) => {
    setSaving(true);
    const res = await subjectService.updateSubject(id, editName, editDoctor);
    if (res.error) toast({ variant: "destructive", title: "فشل التعديل", description: res.error });
    else {
      toast({ title: "تم التعديل ✓" });
      setSubjects(prev => prev.map(s => s.id === id ? res.data! : s));
      setEditId(null);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل تريد حذف مادة "${name}"؟ لا يمكن التراجع.`)) return;
    const res = await subjectService.deleteSubject(id);
    if (res.error) toast({ variant: "destructive", title: "فشل الحذف", description: res.error });
    else {
      toast({ title: "تم حذف المادة" });
      setSubjects(prev => prev.filter(s => s.id !== id));
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Add new subject */}
      <Card className="border-primary/30 bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookPlus className="h-4 w-4" />إضافة مادة جديدة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>اسم المادة</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="مبادئ الأمن السيبراني" required disabled={adding} />
              </div>
              <div className="space-y-1">
                <Label>اسم الدكتور</Label>
                <Input value={newDoctor} onChange={e => setNewDoctor(e.target.value)}
                  placeholder="دكتور سامح مصطفي" required disabled={adding} />
              </div>
            </div>
            <Button type="submit" disabled={adding || !newName.trim() || !newDoctor.trim()} size="sm">
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookPlus className="h-3 w-3" />}
              إضافة
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Subjects list */}
      <Card className="border-primary/30 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">المواد المسجلة ({subjects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
          ) : subjects.length === 0 ? (
            <Alert><AlertDescription>لا توجد مواد بعد. أضف مادة من الأعلى.</AlertDescription></Alert>
          ) : (
            <ul className="space-y-2">
              {subjects.map((s) => (
                <li key={s.id} className="rounded-lg border bg-muted/20 p-3">
                  {editId === s.id ? (
                    // Inline edit mode
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input value={editName} onChange={e => setEditName(e.target.value)}
                          placeholder="اسم المادة" disabled={saving} />
                        <Input value={editDoctor} onChange={e => setEditDoctor(e.target.value)}
                          placeholder="اسم الدكتور" disabled={saving} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => handleSave(s.id)} disabled={saving}>
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          حفظ
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                          <X className="h-3 w-3" />إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.doctor_name || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="font-mono text-xs hidden sm:flex">
                          {s.id.slice(0, 8)}…
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => startEdit(s)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s.id, s.name)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
