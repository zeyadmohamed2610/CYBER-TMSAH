import { CompletedAttendanceCleanup } from "./CompletedAttendanceCleanup";
import { lectureService } from "@/features/attendance/services/lectureService";
import { supabase } from "@/shared/api/supabaseClient";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ConfirmAction } from "@/shared/components/ui/confirm-action";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useToast } from "@/shared/hooks/use-toast";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { BookOpen, Calendar, Layers, Plus, StopCircle, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { type Lecture } from "../types";

interface Subject {
  id: string;
  name: string;
  doctor_name: string;
}

interface Props {
  fixedSubjectId?: string | undefined;
  onSelectLecture: (lecture: Lecture) => void;
}

export function LectureManagementPanel({ fixedSubjectId, onSelectLecture }: Props) {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(fixedSubjectId ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [kind, setKind] = useState<"lecture" | "section">(role === "ta" ? "section" : "lecture");
  const [section, setSection] = useState("1");
  const selectedKind = role === "ta" ? "section" : role === "doctor" ? "lecture" : kind;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await lectureService.fetchLectures();
    if (result.error) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: getFriendlyErrorMessage(result.error),
      });
    } else {
      setLectures(result.data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    const loadSubjects = async () => {
      let query = supabase.from("subjects").select("id, name, doctor_name");
      if (role === "doctor" || role === "ta") {
        const profile = await supabase
          .from("users")
          .select("id, subject_id")
          .eq("auth_id", user?.id)
          .maybeSingle();
        if (!profile.data) return;
        const assigned = await supabase.rpc("get_user_subjects", { p_user_id: profile.data.id });
        const ids = new Set<string>(
          (assigned.data ?? []).map((row: { subject_id: string }) => row.subject_id),
        );
        if (profile.data.subject_id) ids.add(profile.data.subject_id);
        if (!ids.size) {
          if (active) setSubjects([]);
          return;
        }
        query = query.in("id", [...ids]);
      }
      const { data, error } = await query;
      if (error) {
        toast({
          variant: "destructive",
          title: "تعذر تحميل المواد",
          description: getFriendlyErrorMessage(error.message),
        });
        return;
      }
      if (active) setSubjects((data ?? []).sort((a, b) => a.name.localeCompare(b.name, "ar")));
    };
    void loadSubjects();
    return () => {
      active = false;
    };
  }, [role, user?.id, toast]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjectId = selectedSubject || fixedSubjectId;
    if (!subjectId) {
      toast({ variant: "destructive", title: "خطأ", description: "اختر مادة اولاً" });
      return;
    }
    setCreating(true);
    const result = await lectureService.createLecture(
      subjectId,
      title || (selectedKind === "section" ? "سكشن" : "محاضرة"),
      selectedKind,
      selectedKind === "section" ? section : null,
    );
    if (result.error) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: getFriendlyErrorMessage(result.error),
      });
    } else {
      toast({ title: "تم", description: "تم إنشاء الحصة بنجاح" });
      setTitle("");
      setShowCreate(false);
      await load();
    }
    setCreating(false);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ar-EG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const handleEndLecture = async (lectureId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await lectureService.endLecture(lectureId);
    if (result.error) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: getFriendlyErrorMessage(result.error),
      });
    } else {
      toast({ title: "تم", description: "تم انهاء المحاضرة و ايقاف جميع الجلسات" });
      await load();
    }
  };

  const handleDeleteLecture = async (
    lectureId: string,
    lectureTitle: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const { error } = await supabase.rpc("delete_lecture", { p_lecture_id: lectureId });
    if (error) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: getFriendlyErrorMessage(error.message),
      });
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
            {role === "ta" ? "السكاشن" : role === "doctor" ? "المحاضرات" : "المحاضرات والسكاشن"}
          </CardTitle>
          <Button
            variant={showCreate ? "secondary" : "default"}
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
            className="gap-1"
          >
            <Plus className="h-3 w-3" />
            {role === "ta" ? "سكشن جديد" : "حصة جديدة"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(role === "owner" || role === "coordinator") && (
          <CompletedAttendanceCleanup mode="units" subjectId={fixedSubjectId} onComplete={load} />
        )}
        {showCreate && (
          <form onSubmit={handleCreate} className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex gap-3 flex-wrap">
              {(role === "owner" || role === "coordinator") && (
                <div>
                  <Label htmlFor="unit-kind">نوع الحصة</Label>
                  <select
                    id="unit-kind"
                    className="h-9 rounded-lg border bg-background px-3 mr-2"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as "lecture" | "section")}
                  >
                    <option value="lecture">محاضرة</option>
                    <option value="section">سكشن</option>
                  </select>
                </div>
              )}
              {selectedKind === "section" && (
                <div>
                  <Label htmlFor="unit-section">السكشن</Label>
                  <select
                    id="unit-section"
                    className="h-9 rounded-lg border bg-background px-3 mr-2"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  >
                    {Array.from({ length: 15 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        سكشن {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                مدة الحصة ساعة · {selectedKind === "section" ? "سكشن" : "محاضرة"}
              </p>
            </div>
            {(!fixedSubjectId || subjects.length > 1) && (
              <div className="space-y-1">
                <Label htmlFor="lecture-subject" className="text-xs">
                  المادة
                </Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger id="lecture-subject" className="h-11 text-sm">
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
                <Label htmlFor="lecture-title" className="text-xs">
                  عنوان الحصة
                </Label>
                <Input
                  id="lecture-title"
                  placeholder="مثال: المحاضرة 5 - امن الشبكات"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 text-sm"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={creating || (!fixedSubjectId && !selectedSubject)}
                className="h-11"
              >
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
            <p className="mt-2 text-sm text-muted-foreground">لا توجد حصص بعد</p>
            <p className="text-xs text-muted-foreground/70">أضف حصة جديدة للبدء.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lectures.map((lec) => (
              <div
                key={lec.id}
                className={
                  "flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 " +
                  (lec.is_ended ? "border-dashed" : "")
                }
              >
                <button
                  type="button"
                  onClick={() => onSelectLecture(lec)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-right"
                  aria-label={`عرض المحاضرة ${lec.title}`}
                >
                  <div
                    className={
                      "flex h-10 w-10 items-center justify-center rounded-lg " +
                      (lec.is_ended ? "bg-muted" : "bg-primary/10")
                    }
                  >
                    <Calendar
                      className={
                        "h-5 w-5 " + (lec.is_ended ? "text-muted-foreground" : "text-primary")
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{lec.title}</p>
                      {lec.is_ended && (
                        <Badge variant="secondary" className="text-[9px]">
                          منتهية
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lec.subject_name} — {formatDate(lec.lecture_date)}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    {lec.session_count ?? 0}
                  </div>
                  <Badge
                    variant={(lec.attendee_count ?? 0) > 0 ? "default" : "secondary"}
                    className="gap-1"
                  >
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
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            trigger();
                          }}
                        >
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
                      onConfirm={() =>
                        handleDeleteLecture(lec.id, lec.title, {} as React.MouseEvent)
                      }
                    >
                      {(trigger) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-rose-400 hover:text-rose-400 hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            trigger();
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                          حذف
                        </Button>
                      )}
                    </ConfirmAction>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
