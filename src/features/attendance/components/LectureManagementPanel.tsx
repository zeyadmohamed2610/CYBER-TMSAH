import { useCallback, useEffect, useState } from "react";
import { BookOpen, Calendar, Plus, Users, Layers, StopCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { attendanceService } from "../services/attendanceService";
import type { Lecture } from "../types";

interface Subject { id: string; name: string; doctor_name: string; }

interface Props {
  fixedSubjectId?: string;
  onSelectLecture: (lecture: Lecture) => void;
}

export function LectureManagementPanel({ fixedSubjectId, onSelectLecture }: Props) {
  const { toast } = useToast();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(fixedSubjectId ?? "");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await attendanceService.fetchLectures(fixedSubjectId);
    if (result.error) {
      toast({ variant: "destructive", title: "خطأ", description: result.error });
    } else {
      setLectures(result.data ?? []);
    }
    setLoading(false);
  }, [fixedSubjectId, toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (fixedSubjectId) return;
    supabase.from("subjects").select("id, name, doctor_name")
      .then(({ data }) => { 
        if (data) {
          const sorted = data.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
          setSubjects(sorted);
        }
      });
  }, [fixedSubjectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjectId = fixedSubjectId || selectedSubject;
    if (!subjectId) {
      toast({ variant: "destructive", title: "خطأ", description: "اختر مادة اولاً" });
      return;
    }
    setCreating(true);
    const result = await attendanceService.createLecture(subjectId, title || "محاضرة");
    if (result.error) {
      toast({ variant: "destructive", title: "خطأ", description: result.error });
    } else {
      toast({ title: "تم", description: "تم انشاء المحاضرة بنجاح" });
      setTitle("");
      setShowCreate(false);
      await load();
    }
    setCreating(false);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const handleEndLecture = async (lectureId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await attendanceService.endLecture(lectureId);
    if (result.error) {
      toast({ variant: "destructive", title: "خطأ", description: result.error });
    } else {
      toast({ title: "تم", description: "تم انهاء المحاضرة و ايقاف جميع الجلسات" });
      await load();
    }
  };

  const handleDeleteLecture = async (lectureId: string, lectureTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.rpc("delete_lecture", { p_lecture_id: lectureId });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تم", description: "تم حذف المحاضرة: " + lectureTitle });
      await load();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            المحاضرات
          </CardTitle>
          <Button
            variant={showCreate ? "secondary" : "default"}
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
            className="gap-1"
          >
            <Plus className="h-3 w-3" />
            محاضرة جديدة
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreate && (
          <form onSubmit={handleCreate} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            {!fixedSubjectId && (
              <div className="space-y-1">
                <Label className="text-xs">المادة</Label>
                <Select id="lecture-subject" value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="اختر مادة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.doctor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="lecture-title" className="text-xs">عنوان المحاضرة</Label>
                <Input
                  id="lecture-title"
                  placeholder="مثال: المحاضرة 5 - امن الشبكات"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button type="submit" size="sm" disabled={creating || (!fixedSubjectId && !selectedSubject)} className="h-8">
                {creating ? "جاري الانشاء" : "انشاء"}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : lectures.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">لا توجد محاضرات بعد</p>
            <p className="text-xs text-muted-foreground/70">اضغط "محاضرة جديدة" للبدء</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lectures.map((lec) => (
              <button
                key={lec.id}
                onClick={() => onSelectLecture(lec)}
                className={"flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 " + (lec.is_ended ? "opacity-60" : "")}
              >
                <div className={"flex h-10 w-10 items-center justify-center rounded-lg " + (lec.is_ended ? "bg-muted" : "bg-primary/10")}>
                  <Calendar className={"h-5 w-5 " + (lec.is_ended ? "text-muted-foreground" : "text-primary")} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{lec.title}</p>
                    {lec.is_ended && <Badge variant="secondary" className="text-[9px]">منتهية</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lec.subject_name} — {formatDate(lec.lecture_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    {lec.session_count ?? 0}
                  </div>
                  <Badge variant={(lec.attendee_count ?? 0) > 0 ? "default" : "secondary"} className="gap-1">
                    <Users className="h-3 w-3" />
                    {lec.attendee_count ?? 0}
                  </Badge>
                  {!lec.is_ended && (
                    <ConfirmAction
                      title="إنهاء المحاضرة"
                      description={`هل تريد إنهاء "${lec.title}"؟ سيتم إيقاف جميع الجلسات النشطة.`}
                      confirmLabel="إنهاء"
                      onConfirm={() => handleEndLecture(lec.id, {} as React.MouseEvent)}
                    >
                      {(trigger) => (
                        <Button variant="destructive" size="sm" className="h-7 gap-1" onClick={(e) => { e.stopPropagation(); trigger(); }}>
                          <StopCircle className="h-3 w-3" />
                          انهاء
                        </Button>
                      )}
                    </ConfirmAction>
                  )}
                  {lec.is_ended && (
                    <ConfirmAction
                      title="حذف المحاضرة نهائياً"
                      description={`هل أنت متأكد من حذف "${lec.title}"؟ سيتم حذف جميع سجلات الحضور المرتبطة بهذه المحاضرة نهائياً ولا يمكن استعادتها.`}
                      confirmLabel="نعم، احذف"
                      detailed={true}
                      onConfirm={() => handleDeleteLecture(lec.id, lec.title, {} as React.MouseEvent)}
                    >
                      {(trigger) => (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); trigger(); }}>
                          <Trash2 className="h-3 w-3" />
                          حذف
                        </Button>
                      )}
                    </ConfirmAction>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
