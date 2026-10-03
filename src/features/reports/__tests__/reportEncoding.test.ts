import { describe, expect, it } from "vitest";
import { escapeReportCsvCell, escapeReportHtml } from "../utils/reportEncoding";
describe("academic report text safety", () => {
  it("does not execute a student's name as HTML", () => {
    expect(escapeReportHtml('<img src=x onerror="alert(1)"> & طالب')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; طالب",
    );
  });
  it("neutralizes spreadsheet formulas including leading whitespace", () => {
    for (const value of ['=HYPERLINK("https://example.com")', " +123", "\t@SUM(A1)", "-2+3"]) {
      expect(escapeReportCsvCell(value)).toMatch(/^"'/);
    }
  });
  it("preserves Arabic, quotes and line breaks as one cell", () => {
    expect(escapeReportCsvCell('طالب "أحمد"\nالقسم')).toBe('"طالب ""أحمد""\nالقسم"');
  });
});
