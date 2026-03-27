import { jsPDF } from "jspdf";
import type { AttendanceApiResponse, AttendanceRecord, ExportRequest, ExportResult } from "../types";
import { attendanceService } from "./attendanceService";

const EXPORT_ROW_LIMIT = 500;

const ok = <T>(data: T): AttendanceApiResponse<T> => ({ data, error: null });
const fail = <T>(error: string): AttendanceApiResponse<T> => ({ data: null, error });

const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Strip non-ASCII chars for PDF (jsPDF doesn't support Arabic/Unicode) */
const toAscii = (value: string): string => {
  const stripped = value.replace(/[^\x20-\x7E]/g, "").trim();
  return stripped || value.replace(/[^\x20-\x7E]/g, "").length === 0 ? stripped || "[non-latin]" : stripped;
};

const roleLabels: Record<string, string> = {
  student: "Student",
  doctor: "Doctor",
  owner: "Owner",
};

interface ExportRow {
  number: number;
  subject: string;
  student: string;
  submittedAt: string;
  sessionId: string;
}

const createExportRows = (records: AttendanceRecord[]): ExportRow[] =>
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
const exportCsv = (rows: ExportRow[], role: ExportRequest["role"]) => {
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

// ─── Excel Export (proper XML Spreadsheet) ────────────────────
const exportExcel = (rows: ExportRow[], role: ExportRequest["role"]) => {
  const timestamp = new Date().toLocaleString("en-GB");
  const xmlRows = rows
    .map(
      (row) => `
      <Row>
        <Cell><Data ss:Type="Number">${row.number}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(row.subject)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(row.student)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(row.submittedAt)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(row.sessionId)}</Data></Cell>
      </Row>`,
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default"><Font ss:FontName="Segoe UI" ss:Size="10"/></Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="FFFFFF"/>
   <Interior ss:Color="0D9488" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Segoe UI" ss:Size="16" ss:Bold="1" ss:Color="0D9488"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="Meta">
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Color="64748B"/>
  </Style>
  <Style ss:ID="EvenRow">
   <Interior ss:Color="F0FDFA" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Attendance Report">
  <Table>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(BRAND.name)} - Attendance Report</Data></Cell></Row>
   <Row><Cell ss:StyleID="Meta"><Data ss:Type="String">Role: ${escapeXml(roleLabels[role] || role)} | Date: ${escapeXml(timestamp)} | Records: ${rows.length}</Data></Cell></Row>
   <Row/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Subject</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Student</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Submitted At</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Session ID</Data></Cell>
   </Row>
   ${xmlRows}
  </Table>
 </Worksheet>
</Workbook>`;

  return new Blob([xml], { type: "application/vnd.ms-excel" });
};

// ─── PDF Export (ASCII-only to avoid jsPDF Unicode issues) ────
const exportPdf = (rows: ExportRow[], role: ExportRequest["role"]) => {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 40;
  const contentW = pageW - marginX * 2;
  let y = 0;

  const drawHeader = () => {
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

  y = drawHeader();
  y = drawTableHeader(y);

  rows.forEach((row, index) => {
    if (y > pageH - 60) {
      drawFooter();
      pdf.addPage();
      y = drawHeader();
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

    // Use toAscii to strip Arabic/non-ASCII chars that jsPDF can't render
    pdf.text(String(row.number), marginX + 10, y + 16);
    pdf.text(toAscii(row.subject).slice(0, 25), marginX + 40, y + 16);
    pdf.text(toAscii(row.student).slice(0, 25), marginX + 170, y + 16);
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
