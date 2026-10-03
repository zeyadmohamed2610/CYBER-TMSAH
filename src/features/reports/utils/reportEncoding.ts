/** Treat academic names as text in HTML and spreadsheet reports. */
export const escapeReportHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const escapeReportCsvCell = (value: string): string => {
  const safe = /^[\s\uFEFF]*[=+@-]/.test(value) ? "'" + value : value;
  return `"${safe.replace(/"/g, '""')}"`;
};
