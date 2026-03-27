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

const roleLabels: Record<string, string> = {
  student: "Student",
  doctor: "Doctor",
  owner: "Owner",
};

const createExportRows = (records: AttendanceRecord[]) =>
  records.map((record, index) => ({
    number: index + 1,
    subject: record.subjectName || "N/A",
    student: record.studentName || record.studentId,
    submittedAt: new Date(record.submittedAt).toLocaleString("en-GB"),
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
  return `CYBER-TMSAH-attendance-${role}-${stamp}.${extension}`;
};

// ─── Unified Brand Constants ──────────────────────────────────
const BRAND = {
  name: "CYBER TMSAH",
  tagline: "Smart Attendance Platform",
  primary: [13, 148, 136] as [number, number, number],
  accent: [6, 182, 212] as [number, number, number],
  dark: [26, 26, 46] as [number, number, number],
  light: [240, 253, 250] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

// ─── CSV Export ───────────────────────────────────────────────
const exportCsv = (rows: ReturnType<typeof createExportRows>, role: ExportRequest["role"]) => {
  const header = ["#", "Subject", "Student", "Submitted At", "Session ID"];
  const meta = [
    [`${BRAND.name} - Attendance Report`],
    [`Role: ${roleLabels[role] || role}`],
    [`Export Date: ${new Date().toLocaleString("en-GB")}`],
    [`Records: ${rows.length}`],
    [],
  ];

  const lines = [
    ...meta.map((row) => row.map(escapeCsvCell).join(",")),
    header.map(escapeCsvCell).join(","),
    ...rows.map((row) =>
      [String(row.number), row.subject, row.student, row.submittedAt, row.sessionId]
        .map(escapeCsvCell)
        .join(","),
    ),
  ];

  return new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
};

// ─── Excel Export (styled HTML) ───────────────────────────────
const exportExcel = (rows: ReturnType<typeof createExportRows>, role: ExportRequest["role"]) => {
  const timestamp = new Date().toLocaleString("en-GB");

  const html = `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
<meta charset="UTF-8">
<title>${BRAND.name} - Attendance Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; color: #1a1a2e; }
  .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, rgb(${BRAND.primary.join(",")}), rgb(${BRAND.accent.join(",")})); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
  .header h1 { font-size: 28px; margin-bottom: 8px; letter-spacing: 2px; }
  .header p { font-size: 14px; opacity: 0.9; }
  .meta { background: rgb(${BRAND.light.join(",")}); padding: 16px 30px; border-bottom: 2px solid rgb(${BRAND.primary.join(",")}); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .meta-item { font-size: 13px; color: #134e4a; }
  .meta-item strong { color: rgb(${BRAND.primary.join(",")}); }
  table { width: 100%; border-collapse: collapse; margin-top: 0; }
  thead th { background: rgb(${BRAND.primary.join(",")}); color: white; padding: 14px 12px; font-size: 14px; text-align: left; font-weight: 600; }
  tbody tr:nth-child(even) { background: rgb(${BRAND.light.join(",")}); }
  tbody tr:hover { background: #ccfbf1; }
  tbody td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
  .row-num { color: #94a3b8; font-weight: 600; text-align: center; width: 40px; }
  .footer { background: rgb(${BRAND.dark.join(",")}); color: rgb(${BRAND.muted.join(",")}); padding: 16px 30px; text-align: center; font-size: 11px; border-radius: 0 0 12px 12px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${BRAND.name}</h1>
    <p>${BRAND.tagline} - Attendance Report</p>
  </div>
  <div class="meta">
    <span class="meta-item"><strong>Role:</strong> ${roleLabels[role] || role}</span>
    <span class="meta-item"><strong>Export Date:</strong> ${timestamp}</span>
    <span class="meta-item"><strong>Records:</strong> ${rows.length}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Subject</th>
        <th>Student</th>
        <th>Submitted At</th>
        <th>Session ID</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
        <tr>
          <td class="row-num">${row.number}</td>
          <td>${escapeHtml(row.subject)}</td>
          <td>${escapeHtml(row.student)}</td>
          <td>${escapeHtml(row.submittedAt)}</td>
          <td dir="ltr" style="font-family:monospace;font-size:11px;color:#64748b">${escapeHtml(row.sessionId)}</td>
        </tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <div class="footer">
    <p>${BRAND.name} &copy; ${new Date().getFullYear()} - ${BRAND.tagline}</p>
  </div>
</div>
</body>
</html>`;

  return new Blob([`\uFEFF${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
};

// ─── PDF Export (professional branded layout) ─────────────────
const exportPdf = (rows: ReturnType<typeof createExportRows>, role: ExportRequest["role"]) => {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 40;
  const contentW = pageW - marginX * 2;
  let y = 0;

  const drawHeader = (pageY: number) => {
    pdf.setFillColor(...BRAND.primary);
    pdf.rect(0, 0, pageW, 100, "F");

    pdf.setFillColor(...BRAND.accent);
    pdf.rect(0, 100, pageW, 3, "F");

    pdf.setTextColor(...BRAND.white);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text(BRAND.name, marginX, 45);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`${BRAND.tagline} - Attendance Report`, marginX, 68);

    pdf.setFontSize(9);
    pdf.text(`Role: ${roleLabels[role] || role}`, pageW - marginX - 80, 45);
    pdf.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, pageW - marginX - 80, 60);
    pdf.text(`Records: ${rows.length}`, pageW - marginX - 80, 75);

    return 120;
  };

  const drawTableHeader = (tableY: number) => {
    pdf.setFillColor(...BRAND.primary);
    pdf.rect(marginX, tableY, contentW, 28, "F");

    pdf.setTextColor(...BRAND.white);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);

    const cols = [
      { label: "#", x: marginX + 8, w: 25 },
      { label: "Subject", x: marginX + 40, w: 120 },
      { label: "Student", x: marginX + 170, w: 120 },
      { label: "Submitted At", x: marginX + 300, w: 130 },
      { label: "Session ID", x: marginX + 440, w: contentW - 440 },
    ];

    cols.forEach((col) => {
      pdf.text(col.label, col.x, tableY + 18);
    });

    return tableY + 28;
  };

  const drawFooter = () => {
    pdf.setFillColor(...BRAND.dark);
    pdf.rect(0, pageH - 40, pageW, 40, "F");
    pdf.setTextColor(...BRAND.muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`${BRAND.name} \u00a9 ${new Date().getFullYear()} - ${BRAND.tagline}`, marginX, pageH - 18);
    pdf.text(`Page ${pdf.getCurrentPageInfo().pageNumber}`, pageW - marginX - 30, pageH - 18);
  };

  y = drawHeader(0);
  y = drawTableHeader(y);

  rows.forEach((row, index) => {
    if (y > pageH - 60) {
      drawFooter();
      pdf.addPage();
      y = drawHeader(0);
      y = drawTableHeader(y);
    }

    const rowH = 24;

    if (index % 2 === 0) {
      pdf.setFillColor(...BRAND.light);
      pdf.rect(marginX, y, contentW, rowH, "F");
    }

    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.3);
    pdf.line(marginX, y + rowH, marginX + contentW, y + rowH);

    pdf.setTextColor(...BRAND.dark);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    pdf.text(String(row.number), marginX + 10, y + 16);
    pdf.text(row.subject.slice(0, 25), marginX + 40, y + 16);
    pdf.text(row.student.slice(0, 25), marginX + 170, y + 16);
    pdf.text(row.submittedAt.slice(0, 22), marginX + 300, y + 16);

    pdf.setTextColor(...BRAND.muted);
    pdf.setFontSize(7);
    pdf.text(row.sessionId.slice(0, 20), marginX + 440, y + 16);

    y += rowH;
  });

  if (rows.length === 0) {
    pdf.setTextColor(...BRAND.muted);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(12);
    pdf.text("No attendance records found.", marginX + 100, y + 40);
  }

  drawFooter();

  return pdf.output("blob");
};

// ─── Service Export ───────────────────────────────────────────
export const reportService = {
  async requestExport(request: ExportRequest): Promise<AttendanceApiResponse<ExportResult>> {
    const recordsResult = await attendanceService.fetchAttendanceRecords(request.role, {
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
      downloadBlob(exportCsv(rows, request.role), buildFileName(request.role, "csv"));
    } else if (request.format === "xlsx") {
      downloadBlob(exportExcel(rows, request.role), buildFileName(request.role, "xls"));
    } else {
      downloadBlob(exportPdf(rows, request.role), buildFileName(request.role, "pdf"));
    }

    return ok<ExportResult>({
      exportId,
      downloadUrl: null,
    });
  },
};
