import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { SubjectCreationForm } from "./SubjectCreationForm";
import { subjectService } from "../services/subjectService";
import type { Subject } from "../types";

export const SubjectManagementPanel = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDoctor, setEditDoctor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await subjectService.fetchSubjects();
      if (result.data) setSubjects(result.data);
      setLoading(false);
    };

    void load();
  }, []);

  const handleSubjectCreated = (subject: Subject) => {
    setSubjects((prev) => [...prev, subject].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const startEdit = (subject: Subject) => {
    setEditId(subject.id);
    setEditName(subject.name);
    setEditDoctor(subject.doctor_name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditDoctor("");
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    const result = await subjectService.updateSubject(id, editName, editDoctor);

    if (result.error) {
      toast({ variant: "destructive", title: "فشل التعديل", description: result.error });
    } else if (result.data) {
      toast({ title: "تم التعديل بنجاح" });
      setSubjects((prev) => prev.map((subject) => (subject.id === id ? result.data! : subject)));
      cancelEdit();
    }

    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل تريد حذف مادة "${name}"؟ لا يمكن التراجع.`)) return;

    const result = await subjectService.deleteSubject(id);
    if (result.error) {
      toast({ variant: "destructive", title: "فشل الحذف", description: result.error });
      return;
    }

    toast({ title: "تم حذف المادة" });
    setSubjects((prev) => prev.filter((subject) => subject.id !== id));
  };

  return (
    <div className="space-y-6" dir="rtl">
      <SubjectCreationForm onSubjectCreated={handleSubjectCreated} />

      <Card className="border-primary/30 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">المواد المسجلة ({subjects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
          ) : subjects.length === 0 ? (
            <Alert>
              <AlertDescription>لا توجد مواد بعد. أضف مادة من الأعلى.</AlertDescription>
            </Alert>
          ) : (
            <ul className="space-y-2">
              {subjects.map((subject) => (
                <li key={subject.id} className="rounded-lg border bg-muted/20 p-3">
                  {editId === subject.id ? (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          placeholder="اسم المادة"
                          disabled={saving}
                        />
                        <Input
                          value={editDoctor}
                          onChange={(event) => setEditDoctor(event.target.value)}
                          placeholder="اسم الدكتور"
                          disabled={saving}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => handleSave(subject.id)} disabled={saving}>
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          حفظ
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                          <X className="h-3 w-3" />
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{subject.name}</p>
                        <p className="text-xs text-muted-foreground">{subject.doctor_name || "—"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className="hidden font-mono text-xs sm:flex">
                          {subject.id.slice(0, 8)}…
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(subject)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(subject.id, subject.name)}
                        >
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
