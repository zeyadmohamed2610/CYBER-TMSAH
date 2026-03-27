import { jsPDF } from "jspdf";
import type { AttendanceApiResponse, AttendanceRecord, ExportRequest, ExportResult } from "../types";
import { attendanceService } from "./attendanceService";

const EXPORT_ROW_LIMIT = 500;

const ok = <T>(data: T): AttendanceApiResponse<T> => ({ data, error: null });
const fail = <T>(error: string): AttendanceApiResponse<T> => ({ data: null, error });

const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const createExportRows = (records: AttendanceRecord[]) =>
  records.map((record) => ({
    subject: record.subjectName || "N/A",
    student: record.studentName || record.studentId,
    submittedAt: new Date(record.submittedAt).toLocaleString("ar-EG"),
    sessionId: record.sessionId,
  }));

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const buildFileName = (role: ExportRequest["role"], extension: string) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `attendance-${role}-${stamp}.${extension}`;
};

const exportCsv = (rows: ReturnType<typeof createExportRows>) => {
  const header = ["Subject", "Student", "Submitted At", "Session ID"];
  const lines = [
    header.map(escapeCsvCell).join(","),
    ...rows.map((row) =>
      [row.subject, row.student, row.submittedAt, row.sessionId].map(escapeCsvCell).join(","),
    ),
  ];

  return new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
};

const exportExcel = (rows: ReturnType<typeof createExportRows>) => {
  const html = [
    "<table>",
    "<thead><tr><th>Subject</th><th>Student</th><th>Submitted At</th><th>Session ID</th></tr></thead>",
    "<tbody>",
    ...rows.map(
      (row) =>
        `<tr><td>${escapeHtml(row.subject)}</td><td>${escapeHtml(row.student)}</td><td>${escapeHtml(row.submittedAt)}</td><td>${escapeHtml(row.sessionId)}</td></tr>`,
    ),
    "</tbody>",
    "</table>",
  ].join("");

  return new Blob([`\uFEFF${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
};

const exportPdf = (rows: ReturnType<typeof createExportRows>, role: ExportRequest["role"]) => {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  let y = 48;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(`Attendance Report (${role})`, marginX, y);

  y += 24;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Generated: ${new Date().toLocaleString("en-US")}`, marginX, y);
  y += 18;
  pdf.text(`Rows: ${rows.length}`, marginX, y);
  y += 24;

  rows.forEach((row, index) => {
    if (y > 760) {
      pdf.addPage();
      y = 48;
    }

    const line = `${index + 1}. ${row.subject} | ${row.student} | ${row.submittedAt}`;
    pdf.text(line.slice(0, 110), marginX, y);
    y += 14;
    pdf.setTextColor(90);
    pdf.text(`Session: ${row.sessionId}`, marginX + 16, y);
    pdf.setTextColor(0);
    y += 18;
  });

  return pdf.output("blob");
};

export const reportService = {
  async requestExport(request: ExportRequest): Promise<AttendanceApiResponse<ExportResult>> {
    const recordsResult = await attendanceService.fetchAttendanceRecords(request.role, undefined, {
      page: 1,
      pageSize: EXPORT_ROW_LIMIT,
    });

    if (recordsResult.error) {
      return fail<ExportResult>(recordsResult.error);
    }

    const rows = createExportRows(recordsResult.data ?? []);
    const exportId =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;

    if (request.format === "csv") {
      downloadBlob(exportCsv(rows), buildFileName(request.role, "csv"));
    } else if (request.format === "xlsx") {
      downloadBlob(exportExcel(rows), buildFileName(request.role, "xls"));
    } else {
      downloadBlob(exportPdf(rows, request.role), buildFileName(request.role, "pdf"));
    }

    return ok<ExportResult>({
      exportId,
      downloadUrl: null,
    });
  },
};
