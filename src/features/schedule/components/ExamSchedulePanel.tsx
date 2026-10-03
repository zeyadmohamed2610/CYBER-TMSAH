import { supabase } from "@/shared/api/supabaseClient";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
interface ExamFile {
  id: string;
  title: string;
  exam_type: string;
  file_url: string;
  file_name: string;
  section: string | null;
}
export function ExamSchedulePanel({
  department,
  academicYear,
  canEdit,
  studentSection,
}: {
  department: string;
  academicYear: string;
  canEdit: boolean;
  studentSection: string | null;
}) {
  const [files, setFiles] = useState<ExamFile[]>([]);
  const [section, setSection] = useState(studentSection ?? "all");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await supabase
      .from("exam_schedules")
      .select("id,title,exam_type,file_url,file_name,section")
      .eq("department", department)
      .eq("academic_year", academicYear)
      .order("created_at", { ascending: false });
    if (result.error) {
      toast.error("تعذر تحميل جداول الامتحانات");
      return;
    }
    setFiles(result.data as ExamFile[]);
  }, [department, academicYear]);
  useEffect(() => {
    void load();
    setSection(studentSection ?? "all");
  }, [load, studentSection]);
  const upload = async (file: File, examType: string) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("الحد الأقصى للملف 10 ميجابايت");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "doc", "docx", "xls", "xlsx"].includes(extension)) {
      toast.error("صيغة الملف غير مدعومة");
      return;
    }
    const path = `${department}/${academicYear}/${crypto.randomUUID()}.${extension}`;
    setBusy(true);
    try {
      const result = await supabase.storage.from("exam-files").upload(path, file);
      if (result.error) throw result.error;
      const { data } = supabase.storage.from("exam-files").getPublicUrl(path);
      const saved = await supabase.rpc("save_academic_exam", {
        p_department: department,
        p_year: academicYear,
        p_exam: {
          title: `${examType === "midterm" ? "ميدتيرم" : "فاينل"} · ${section === "all" ? "كل السكاشن" : "سكشن " + section}`,
          exam_type: examType,
          file_url: data.publicUrl,
          file_name: file.name,
          section: section === "all" ? null : section,
        },
      });
      if (saved.error) {
        await supabase.storage.from("exam-files").remove([path]);
        throw saved.error;
      }
      await load();
      toast.success("تم نشر جدول الامتحان");
    } catch {
      toast.error("تعذر نشر جدول الامتحان. لم يُعتمد الملف.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4 rounded-xl border p-4">
      <h3 className="font-bold">جداول الميدتيرم والفاينل</h3>
      <div>
        <Label htmlFor="exam-section">عرض السكاشن</Label>
        <select
          id="exam-section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className="rounded-lg border bg-background h-10 px-3 mr-3"
        >
          <option value="all">كل السكاشن</option>
          {Array.from({ length: 15 }, (_, i) => (
            <option key={i} value={i + 1}>
              سكشن {i + 1}
            </option>
          ))}
        </select>
      </div>
      {canEdit && (
        <div className="flex gap-3 flex-wrap">
          {["midterm", "final"].map((type) => (
            <label key={type} className="rounded-lg border px-4 py-3 cursor-pointer text-sm">
              {busy ? "جارٍ الرفع..." : type === "midterm" ? "رفع الميدتيرم" : "رفع الفاينل"}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                disabled={busy}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file, type);
                }}
              />
            </label>
          ))}
        </div>
      )}
      {files
        .filter((f) => section === "all" || !f.section || f.section === section)
        .map((file) => (
          <div
            key={file.id}
            className="flex gap-3 items-center justify-between rounded-lg bg-muted/30 p-3"
          >
            <div>
              <p className="font-semibold">{file.title}</p>
              <p className="text-xs text-muted-foreground">
                {file.section ? `سكشن ${file.section}` : "كل السكاشن"} ·{" "}
                {file.exam_type === "midterm" ? "ميدتيرم" : "فاينل"}
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-sm"
              >
                عرض / تحميل
              </a>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const result = await supabase.rpc("delete_academic_exam", { p_id: file.id });
                    if (result.error) toast.error("تعذر حذف الجدول");
                    else {
                      await load();
                      toast.success("تم حذف جدول الامتحان");
                    }
                    setBusy(false);
                  }}
                >
                  حذف
                </Button>
              )}
            </div>
          </div>
        ))}
      {!files.length && (
        <p className="text-sm text-muted-foreground">لم تُنشر جداول امتحانات لهذه الفرقة بعد.</p>
      )}
    </div>
  );
}
