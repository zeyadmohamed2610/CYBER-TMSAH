import { Button } from "@/shared/components/ui/button";
import { attendanceStatus } from "../attendanceStatus";
import type { Result } from "../types";
import { useState } from "react";
import { Input } from "@/shared/components/ui/input";

const statuses = {
  unset: "السياسة لم تُحدّد",
  normal: "ضمن السياسة المحددة",
  warning: "يحتاج متابعة",
  limit: "بلغ حد المراجعة",
};
async function exportResults(rows: Result[]) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("الحضور والغياب", { views: [{ rightToLeft: true }] });
  sheet.addRow([
    "الطالب",
    "الفرقة",
    "السكشن",
    "المادة",
    "نوع الحصة",
    "حضور",
    "غياب",
    "عذر مقبول",
    "إجمالي",
    "المتابعة",
  ]);
  for (const row of rows)
    sheet.addRow([
      row.student_snapshot.name,
      row.student_snapshot.academic_year,
      row.student_snapshot.section,
      row.subject_name,
      row.kind === "lecture" ? "محاضرة" : "سكشن",
      row.present,
      row.absent,
      row.excused,
      row.total,
      statuses[attendanceStatus(row)],
    ]);
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  sheet.getRow(1).font = { bold: true };
  const bytes = await workbook.xlsx.writeBuffer();
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "الحضور-والغياب.xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ResultsPanel({
  rows,
  run,
  student = false,
}: {
  rows: Result[];
  run: (operation: () => Promise<unknown>) => void;
  student?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState("");
  const [limit, setLimit] = useState(100);
  const filtered = rows.filter(
    (row) =>
      (!subject || row.subject_id === subject) &&
      (!kind || row.kind === kind) &&
      `${row.student_snapshot.name} ${row.student_snapshot.section} ${row.subject_name}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const subjects = [...new Map(rows.map((row) => [row.subject_id, row.subject_name])).entries()];
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="font-bold">الحضور والغياب حسب المادة</h3>
        {!student && (
          <Button
            variant="outline"
            disabled={!filtered.length}
            onClick={() => run(() => exportResults(filtered))}
          >
            تصدير Excel
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {!student && (
          <Input
            aria-label="البحث في النتائج"
            placeholder="ابحث باسم الطالب أو السكشن"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(100);
            }}
          />
        )}
        <select
          aria-label="مادة النتائج"
          className="rounded-lg border bg-background p-2"
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setLimit(100);
          }}
        >
          <option value="">كل المواد</option>
          {subjects.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="نوع الحصص في النتائج"
          className="rounded-lg border bg-background p-2"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value);
            setLimit(100);
          }}
        >
          <option value="">المحاضرات والسكاشن</option>
          <option value="lecture">المحاضرات</option>
          <option value="section">السكاشن</option>
        </select>
      </div>
      <p className="text-sm text-muted-foreground">
        {filtered.length} نتيجة ·{" "}
        {!student && `${new Set(filtered.map((row) => row.student_id)).size} طالبًا · `}
        {filtered.reduce((sum, row) => sum + row.absent, 0)} حالة غياب
      </p>
      {!rows.length && (
        <p className="rounded-2xl border p-5 text-muted-foreground">
          ستظهر النتائج بعد تسجيل الحصص لهذا الفصل.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.slice(0, limit).map((row) => (
          <article
            className="rounded-2xl border bg-card p-5 space-y-3"
            key={`${row.student_id}:${row.subject_id}:${row.kind}`}
          >
            <h4 className="font-bold">
              {row.subject_name} · {row.kind === "lecture" ? "محاضرات" : "سكاشن"}
            </h4>
            {!student && (
              <p className="text-sm">
                {row.student_snapshot.name} · السكشن {row.student_snapshot.section ?? "—"}
              </p>
            )}
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">حضور</dt>
                <dd className="text-xl font-bold">{row.present}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">غياب</dt>
                <dd className="text-xl font-bold">{row.absent}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">بعذر مقبول</dt>
                <dd className="text-xl font-bold">{row.excused}</dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">{statuses[attendanceStatus(row)]}</p>
          </article>
        ))}
      </div>
      {filtered.length > limit && (
        <Button variant="outline" onClick={() => setLimit((value) => value + 100)}>
          عرض المزيد من النتائج
        </Button>
      )}
    </section>
  );
}
