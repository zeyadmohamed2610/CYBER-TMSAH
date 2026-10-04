import { supabase } from "@/shared/api/supabaseClient";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { getFriendlyErrorMessage } from "@/shared/lib/academicCopy";
import { useCallback, useEffect, useMemo, useState } from "react";
import { escapeReportCsvCell } from "../../reports/utils/reportEncoding";

interface RegisterRow {
  unit_id: string;
  student_id: string;
  student_name: string;
  subject_name: string;
  title: string;
  lecture_date: string;
  status: "present" | "absent" | "pending" | "excused";
}
const labels = { present: "حاضر", absent: "غائب", pending: "التسجيل مفتوح", excused: "عذر مقبول" };
const pageSize = 100;
export function AttendanceRegisterPanel({ lectureId }: { lectureId?: string }) {
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: failure } = await supabase.rpc("get_attendance_register", {
      p_lecture_id: lectureId ?? null,
      p_limit: pageSize,
      p_offset: page * pageSize,
    });
    if (failure) {
      setError(getFriendlyErrorMessage(failure.message));
      setRows([]);
    } else setRows((data ?? []) as RegisterRow[]);
    setLoading(false);
  }, [lectureId, page]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!rows.some((row) => row.status === "pending")) return;
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [rows, load]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (status === "all" || row.status === status) &&
          `${row.student_name} ${row.subject_name} ${row.title}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [rows, search, status],
  );
  const exportPage = () => {
    const csv = [
      ["الطالب", "المادة", "المحاضرة", "التاريخ", "الحالة"],
      ...filtered.map((row) => [
        row.student_name,
        row.subject_name,
        row.title,
        row.lecture_date,
        labels[row.status],
      ]),
    ]
      .map((row) => row.map(escapeReportCsvCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "كشف-الحضور-والغياب.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>كشف الحضور والغياب</CardTitle>
        <p className="text-sm text-muted-foreground">
          يُحسب الطالب مرة واحدة لكل محاضرة. يظهر الغياب بعد انتهاء وقت التسجيل.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="بحث في كشف الحضور والغياب"
            placeholder="اسم الطالب أو المادة أو المحاضرة"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            aria-label="حالة الحضور"
            className="rounded-md border bg-background p-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button variant="outline" disabled={loading} onClick={() => void load()}>
            تحديث
          </Button>
          <Button variant="outline" disabled={!filtered.length} onClick={exportPage}>
            تصدير الصفحة المعروضة
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <p>جاري تحميل الكشف...</p>
        ) : (
          <div>
            <div className="space-y-3 sm:hidden">
              {filtered.map((row) => (
                <article
                  key={`${row.unit_id}:${row.student_id}`}
                  className="rounded-xl border p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-bold break-words">{row.student_name}</h3>
                    <span
                      className={`text-sm ${row.status === "absent" ? "text-destructive" : "text-primary"}`}
                    >
                      {labels[row.status]}
                    </span>
                  </div>
                  <p className="text-sm break-words">{row.subject_name}</p>
                  <p className="text-sm text-muted-foreground break-words">{row.title}</p>
                  <time className="block text-xs text-muted-foreground" dateTime={row.lecture_date}>
                    {row.lecture_date}
                  </time>
                </article>
              ))}
            </div>
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr>
                  {["الطالب", "المادة والمحاضرة", "التاريخ", "الحالة"].map((label) => (
                    <th key={label} className="p-2 text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={`${row.unit_id}:${row.student_id}`} className="border-t">
                    <td className="p-2">{row.student_name}</td>
                    <td className="p-2">
                      {row.subject_name}
                      <br />
                      <span className="text-muted-foreground">{row.title}</span>
                    </td>
                    <td className="p-2">{row.lecture_date}</td>
                    <td
                      className={`p-2 ${row.status === "absent" ? "text-destructive" : "text-foreground"}`}
                    >
                      {labels[row.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <p className="py-4">لا توجد نتائج في هذه الصفحة.</p>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            السابق
          </Button>
          <span>صفحة {page + 1}</span>
          <Button
            variant="outline"
            disabled={rows.length < pageSize || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
