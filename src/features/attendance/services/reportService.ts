import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import type { AttendanceApiResponse, AttendanceRecord, ExportRequest, ExportResult, Lecture, LectureAttendee } from "../types";
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

const BRAND = {
  name: "CYBER TMSAH",
  tagline: "Smart Attendance Platform",
  primary: "#0d9488",
  accent: "#06b6d4",
  dark: "#1a1a2e",
  light: "#f0fdfa",
  muted: "#94a3b8",
};

// ─── Shared HTML table (used by both Excel and PDF) ───────────
const buildTableHtml = (rows: ExportRow[], role: ExportRequest["role"]): string => {
  const timestamp = new Date().toLocaleString("en-GB");
  const dataRows = rows
    .map(
      (row, i) => `
    <tr style="background:${i % 2 === 0 ? BRAND.light : "#fff"}">
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#94a3b8;font-weight:600;text-align:center;width:40px">${row.number}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155">${escapeHtml(row.subject)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155">${escapeHtml(row.student)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;direction:ltr">${escapeHtml(row.submittedAt)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-family:monospace;font-size:11px;direction:ltr">${escapeHtml(row.sessionId.slice(0, 12))}...</td>
    </tr>`,
    )
    .join("");

  return `<div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;max-width:900px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
  <div style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});color:#fff;padding:30px;text-align:center">
    <h1 style="margin:0;font-size:28px;letter-spacing:2px">${BRAND.name}</h1>
    <p style="margin:8px 0 0;opacity:0.9;font-size:14px">${BRAND.tagline} - Attendance Report</p>
  </div>
  <div style="background:${BRAND.light};padding:14px 24px;border-bottom:2px solid ${BRAND.primary};display:flex;justify-content:space-between;font-size:13px;color:#134e4a">
    <span><strong style="color:${BRAND.primary}">Role:</strong> ${roleLabels[role] || role}</span>
    <span><strong style="color:${BRAND.primary}">Date:</strong> ${timestamp}</span>
    <span><strong style="color:${BRAND.primary}">Records:</strong> ${rows.length}</span>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:${BRAND.primary};color:#fff">
        <th style="padding:12px;text-align:left;font-size:13px;width:40px">#</th>
        <th style="padding:12px;text-align:left;font-size:13px">Subject</th>
        <th style="padding:12px;text-align:left;font-size:13px">Student</th>
        <th style="padding:12px;text-align:left;font-size:13px">Submitted At</th>
        <th style="padding:12px;text-align:left;font-size:13px">Session ID</th>
      </tr>
    </thead>
    <tbody>
      ${dataRows || '<tr><td colspan="5" style="padding:40px;text-align:center;color:#94a3b8;font-style:italic">No records found</td></tr>'}
    </tbody>
  </table>
  <div style="background:${BRAND.dark};color:${BRAND.muted};padding:14px 24px;text-align:center;font-size:11px">
    ${BRAND.name} &copy; ${new Date().getFullYear()} - ${BRAND.tagline}
  </div>
</div>`;
};

// ─── Render HTML to off-screen element ────────────────────────
const renderOffscreen = async (html: string): Promise<HTMLDivElement> => {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:900px;z-index:-1";
  container.innerHTML = html;
  document.body.appendChild(container);

  // Wait for fonts and layout
  await new Promise((r) => setTimeout(r, 200));
  return container;
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

// ─── Excel Export (HTML table, opens natively in Excel) ───────
const exportExcel = async (rows: ExportRow[], role: ExportRequest["role"]) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${buildTableHtml(rows, role)}</body></html>`;
  return new Blob([`\uFEFF${html}`], { type: "application/vnd.ms-excel" });
};

// ─── PDF Export (render table as image via html2canvas) ───────
const exportPdf = async (rows: ExportRow[], role: ExportRequest["role"]) => {
  const html = buildTableHtml(rows, role);
  const container = await renderOffscreen(html);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: 900,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgW = canvas.width;
    const imgH = canvas.height;

    const pdf = new jsPDF({
      orientation: imgW > imgH ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const availableW = pageW - margin * 2;
    const scale = availableW / imgW;
    const scaledH = imgH * scale;

    if (scaledH <= pageH - margin * 2) {
      // Fits on one page
      pdf.addImage(imgData, "PNG", margin, margin, availableW, scaledH);
    } else {
      // Multi-page
      let remainingH = imgH;
      let srcY = 0;
      const sliceH = Math.floor((pageH - margin * 2) / scale);

      while (remainingH > 0) {
        const currentSlice = Math.min(sliceH, remainingH);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = imgW;
        sliceCanvas.height = currentSlice;
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, srcY, imgW, currentSlice, 0, 0, imgW, currentSlice);
        const sliceImg = sliceCanvas.toDataURL("image/png");
        const sliceScaledH = currentSlice * scale;

        pdf.addImage(sliceImg, "PNG", margin, margin, availableW, sliceScaledH);

        remainingH -= currentSlice;
        srcY += currentSlice;

        if (remainingH > 0) {
          pdf.addPage();
        }
      }
    }

    return pdf.output("blob");
  } finally {
    container.remove();
  }
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
      const blob = await exportExcel(rows, request.role);
      downloadBlob(blob, buildFileName(request.role, "xls"));
    } else {
      const blob = await exportPdf(rows, request.role);
      downloadBlob(blob, buildFileName(request.role, "pdf"));
    }

    return ok<ExportResult>({
      exportId,
      downloadUrl: null,
    });
  },

  /** Export a single lecture's attendance with full details */
  async exportLecture(
    attendees: LectureAttendee[],
    lecture: Lecture,
    format: "csv" | "xlsx" | "pdf",
  ): Promise<AttendanceApiResponse<ExportResult>> {
    const rows: ExportRow[] = attendees.map((a, i) => ({
      number: i + 1,
      subject: lecture.subject_name ?? lecture.title,
      student: a.student_name,
      submittedAt: new Date(a.submitted_at).toLocaleString("en-GB"),
      sessionId: a.short_code ?? a.session_id,
    }));

    const lectureLabel = `${lecture.title}-${lecture.lecture_date}`;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const fileName = `CYBER-TMSAH-${lectureLabel}-${stamp}`;

    if (format === "csv") {
      // CSV with full details including national ID and IP
      const header = ["#", "Student Name", "National ID", "Session Code", "Time", "IP Address"];
      const meta = [
        [`${BRAND.name} - Lecture Attendance`],
        [`Lecture: ${lecture.title}`],
        [`Subject: ${lecture.subject_name ?? ""}`],
        [`Date: ${lecture.lecture_date}`],
        [`Total Attendees: ${attendees.length}`],
        [],
      ];
      const dataLines = attendees.map((a, i) =>
        [
          String(i + 1),
          a.student_name,
          a.national_id ?? "N/A",
          a.short_code ?? "N/A",
          new Date(a.submitted_at).toLocaleString("en-GB"),
          a.ip_address ?? "N/A",
        ]
          .map(escapeCsvCell)
          .join(","),
      );
      const lines = [
        ...meta.map((r) => r.map(escapeCsvCell).join(",")),
        header.map(escapeCsvCell).join(","),
        ...dataLines,
      ];
      downloadBlob(new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" }), `${fileName}.csv`);
    } else if (format === "xlsx") {
      const blob = await exportExcel(rows, "owner");
      downloadBlob(blob, `${fileName}.xls`);
    } else {
      const blob = await exportPdf(rows, "owner");
      downloadBlob(blob, `${fileName}.pdf`);
    }

    return ok<ExportResult>({ exportId: crypto.randomUUID?.() ?? `${Date.now()}`, downloadUrl: null });
  },
};
