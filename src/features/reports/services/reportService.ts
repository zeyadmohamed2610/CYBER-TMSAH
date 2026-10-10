import { attendanceRecordService } from "@/features/attendance/services/attendanceRecordService";
import { type ExportRequest, type ExportResult } from "@/features/reports/types";
import { type ApiResponse } from "@/shared/api/types";
import { type AttendanceRecord, type Lecture, type LectureAttendee } from "../../attendance/types";
import { escapeReportCsvCell, escapeReportHtml as escapeHtml } from "../utils/reportEncoding";
interface ExportRow {
  number: number;
  subject: string;
  student: string;
  nationalId: string;
  submittedAt: Date;
  sessionId: string;
  ip: string;
}
const headers = ["#", "المادة", "الطالب", "الرقم القومي", "وقت الحضور", "الجلسة", "عنوان IP"];
const values = (row: ExportRow): (string | number | Date)[] => [
  row.number,
  row.subject,
  row.student,
  row.nationalId,
  row.submittedAt,
  row.sessionId,
  row.ip,
];
const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const rowsFromRecords = (records: AttendanceRecord[]): ExportRow[] =>
  records.map((r, i) => ({
    number: i + 1,
    subject: r.subjectName ?? "",
    student: r.studentName ?? r.studentId,
    nationalId: r.nationalId ?? "",
    submittedAt: new Date(r.submittedAt),
    sessionId: r.sessionId,
    ip: r.ipAddress ?? "",
  }));
export async function attendanceWorkbook(rows: ExportRow[]): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("الحضور");
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(values(row)));
  // Plain cells: no table style, merged headings, colors or decorative report metadata.
  [6, 28, 32, 20, 24, 40, 20].forEach((width, i) => {
    worksheet.getColumn(i + 1).width = width;
  });
  worksheet.getColumn(5).numFmt = "yyyy-mm-dd hh:mm:ss";
  const bytes = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(bytes)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
const reportPage = (
  rows: ExportRow[],
  title: string,
  total: number,
  page: number,
  pages: number,
) => {
  const cells = rows
    .map(
      (row) =>
        `<tr>${values(row)
          .map(
            (value, i) =>
              `<td style="padding:11px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;overflow-wrap:anywhere;${i === 0 ? "text-align:center;" : ""}${[3, 4, 5, 6].includes(i) ? "direction:ltr;font-size:11px;" : ""}">${escapeHtml(value instanceof Date ? value.toLocaleString("en-GB") : String(value))}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<section dir="rtl" style="width:960px;background:#fff;color:#191526;font-family:'Cairo',Tahoma,Arial,sans-serif;padding:36px;box-sizing:border-box;line-height:1.65">
 <header style="border-top:5px solid #7c3aed;padding-top:22px;display:flex;justify-content:space-between;align-items:center;margin-bottom:22px">
 <div><div dir="ltr" style="font-size:24px;font-weight:800;letter-spacing:3px;color:#6d28d9">CYBER TMSAH</div><div style="font-size:12px;color:#6b7280">المنصة الأكاديمية · الحضور والمتابعة</div></div>
 <div style="text-align:left;font-size:11px;color:#6b7280">تاريخ التصدير<br/><span dir="ltr">${new Date().toLocaleString("en-GB")}</span></div></header>
 <div style="border:1px solid #e9e5f0;border-right:4px solid #7c3aed;border-radius:12px;padding:18px 20px;margin-bottom:24px;background:#faf8ff"><h1 style="margin:0;font-size:23px;color:#251840">كشف الحضور</h1><p style="margin:6px 0;font-size:14px;overflow-wrap:anywhere">${escapeHtml(title)}</p><p style="margin:0;font-size:12px;color:#6b7280">عدد السجلات: ${total} · الصفحة ${page} من ${pages}</p></div>
 <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed"><colgroup>${[4, 17, 20, 15, 16, 16, 12].map((w) => `<col style="width:${w}%"/>`).join("")}</colgroup><thead><tr style="background:#211735;color:#fff">${headers.map((h) => `<th style="padding:12px 8px;text-align:right;font-size:12px">${h}</th>`).join("")}</tr></thead><tbody>${cells || '<tr><td colspan="7" style="padding:40px;text-align:center;color:#6b7280">لا توجد سجلات حضور</td></tr>'}</tbody></table>
 <footer style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:14px;display:flex;justify-content:space-between;font-size:11px;color:#6b7280"><span>CYBER TMSAH · سجل أكاديمي</span><span dir="ltr">${page} / ${pages}</span></footer></section>`;
};
export async function attendancePdf(rows: ExportRow[], title: string): Promise<Blob> {
  if (rows.length > 2000)
    throw new Error("التقرير كبير لملف PDF واحد. استخدم Excel أو CSV لتصدير كل السجلات.");
  const [canvasModule, pdfModule] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  await document.fonts?.ready;
  const pdf = new pdfModule.default({
    orientation: "landscape",
    compress: true,
    unit: "pt",
    format: "a4",
  });
  pdf.setProperties({
    title: "كشف الحضور | CYBER TMSAH",
    subject: title,
    author: "CYBER TMSAH",
    creator: "CYBER TMSAH",
  });
  const perPage = 8,
    pages = Math.max(1, Math.ceil(rows.length / perPage));
  for (let page = 0; page < pages; page++) {
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-10000px;top:0;width:960px;z-index:-1";
    container.innerHTML = reportPage(
      rows.slice(page * perPage, (page + 1) * perPage),
      title,
      rows.length,
      page + 1,
      pages,
    );
    document.body.append(container);
    try {
      const canvas = await canvasModule.default(container, {
        scale: 2,
        useCORS: false,
        backgroundColor: "#ffffff",
        width: 960,
      });
      if (page) pdf.addPage();
      const w = pdf.internal.pageSize.getWidth(),
        h = pdf.internal.pageSize.getHeight(),
        margin = 24;
      const scale = Math.min((w - 2 * margin) / canvas.width, (h - 2 * margin) / canvas.height);
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        (w - canvas.width * scale) / 2,
        margin,
        canvas.width * scale,
        canvas.height * scale,
      );
    } finally {
      container.remove();
    }
  }
  return pdf.output("blob");
}
async function exportRows(
  rows: ExportRow[],
  format: ExportRequest["format"],
  name: string,
  title: string,
) {
  if (rows.some((row) => !Number.isFinite(row.submittedAt.getTime())))
    throw new Error("تعذر تصدير سجل يحمل تاريخًا غير صالح.");
  if (format === "xlsx") download(await attendanceWorkbook(rows), name + ".xlsx");
  else if (format === "pdf") download(await attendancePdf(rows, title), name + ".pdf");
  else
    download(
      new Blob(
        [
          "\uFEFF" +
            [
              headers,
              ...rows.map((row) =>
                values(row).map((v) => (v instanceof Date ? v.toISOString() : String(v))),
              ),
            ]
              .map((r) => r.map(escapeReportCsvCell).join(","))
              .join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      name + ".csv",
    );
}
export const reportService = {
  async requestExport(request: ExportRequest): Promise<ApiResponse<ExportResult>> {
    try {
      const records: AttendanceRecord[] = [];
      for (let page = 1; page <= 101; page++) {
        const result = await attendanceRecordService.fetchAttendanceRecords(request.role, {
          page,
          pageSize: 500,
        });
        if (result.error) throw new Error(result.error);
        records.push(...(result.data ?? []));
        if (records.length > 50000)
          throw new Error("التصدير يتجاوز 50000 سجل. ضيّق الفترة المطلوبة.");
        if (!result.data || result.data.length < 500) break;
      }
      const start = request.dateFrom ? Date.parse(request.dateFrom) : -Infinity;
      const end = request.dateTo
        ? Date.parse(
            request.dateTo + (/^\d{4}-\d{2}-\d{2}$/.test(request.dateTo) ? "T23:59:59.999Z" : ""),
          )
        : Infinity;
      if (Number.isNaN(start) || Number.isNaN(end) || start > end)
        throw new Error("حدد فترة تصدير صحيحة.");
      const filtered = records.filter(
        (r) => Date.parse(r.submittedAt) >= start && Date.parse(r.submittedAt) <= end,
      );
      await exportRows(
        rowsFromRecords(filtered),
        request.format,
        `CYBER-TMSAH-attendance-${stamp()}`,
        "الحضور الأكاديمي",
      );
      return { data: { exportId: crypto.randomUUID(), downloadUrl: null }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : "تعذر تصدير التقرير." };
    }
  },
  async exportLecture(
    attendees: LectureAttendee[],
    lecture: Lecture,
    format: ExportRequest["format"],
  ): Promise<ApiResponse<ExportResult>> {
    try {
      const rows: ExportRow[] = attendees.map((a, i) => ({
        number: i + 1,
        subject: lecture.subject_name ?? lecture.title,
        student: a.student_name,
        nationalId: a.national_id ?? "",
        submittedAt: new Date(a.submitted_at),
        sessionId: a.session_id,
        ip: a.ip_address ?? "",
      }));
      await exportRows(
        rows,
        format,
        `CYBER-TMSAH-${lecture.id}-${stamp()}`,
        `${lecture.subject_name ?? lecture.title} · ${lecture.title} · ${lecture.lecture_date}`,
      );
      return { data: { exportId: crypto.randomUUID(), downloadUrl: null }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : "تعذر تصدير التقرير." };
    }
  },
};
