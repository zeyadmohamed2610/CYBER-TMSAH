import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { AcademicSchedule } from "../utils/academicSchedule";
import { parseUniversitySchedule, universitySheetYear } from "../utils/universitySchedule";
const schedule: AcademicSchedule = {
  department: "cybersecurity",
  academic_year: "2",
  can_edit: true,
  student_section: null,
  settings: { semester_start: null, week_start_day: 5, start_time: "09:00", days_off: [] },
  entries: [],
  subjects: [{ id: "programming", name: "Programming For Cyber-Security" }],
  instructors: [],
};
function grid() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("2nd Year");
  for (let section = 1; section <= 15; section++) sheet.getCell(4, section + 4).value = section;
  sheet.getCell("B5").value = "Friday";
  sheet.mergeCells("B5:B8");
  for (const [row, time] of [
    [5, "09:00-10:00"],
    [6, "10:00-11:00"],
    [7, "11:00-12:00"],
    [8, "02:00-03:00"],
  ] as const)
    sheet.getCell(row, 4).value = time;
  return sheet;
}
describe("university workbook structure", () => {
  it("finds academic years by sheet name rather than sheet order", () => {
    expect(universitySheetYear("Second Year")).toBe("2");
    expect(universitySheetYear("الفرقة الثانية")).toBe("2");
    expect(universitySheetYear("1st Year")).toBe("1");
    expect(universitySheetYear("Instructions")).toBeNull();
  });
  it("expands horizontal merges and splits two locations into alternating weeks", () => {
    const sheet = grid();
    sheet.getCell("E8").value = "C++\nEng. Amal / A02 / G203";
    sheet.mergeCells("E8:F8");
    const result = parseUniversitySchedule(sheet, schedule);
    expect(result.entries).toHaveLength(4);
    expect(result.entries.map((e) => [e.section, e.period, e.week_pattern, e.room])).toEqual([
      [1, 6, 1, "A02"],
      [2, 6, 1, "A02"],
      [1, 6, 2, "G203"],
      [2, 6, 2, "G203"],
    ]);
    expect(
      result.places.every((p) => p.cell === "E8" && p.start === "14:00" && p.end === "15:00"),
    ).toBe(true);
  });
  it("reads two distinct weekly subjects from one cell without classifying venues", () => {
    const sheet = grid();
    sheet.getCell("E5").value = "(1) C++\nEng. Amal / G203\n(2) C++\nEng. Amal / A02";
    expect(
      parseUniversitySchedule(sheet, schedule).entries.map((e) => [e.week_pattern, e.room]),
    ).toEqual([
      [1, "G203"],
      [2, "A02"],
    ]);
  });
  it.each(["1 C++", "C++ 1", "week1 C++", "C++ week1", "week1\nC++", "1\nC++"])(
    "reads university week label %s",
    (label) => {
      const sheet = grid();
      sheet.getCell("E5").value = `${label}\nEng. Amal / A01`;
      expect(parseUniversitySchedule(sheet, schedule).entries[0]?.week_pattern).toBe(1);
    },
  );
  it("derives university times from the file even if saved first-class time differs", () => {
    const sheet = grid();
    sheet.getCell("E8").value = "C++\nEng. Amal / A02";
    const result = parseUniversitySchedule(sheet, {
      ...schedule,
      settings: { ...schedule.settings, start_time: "07:30" },
    });
    expect(result.start_time).toBe("09:00");
    expect(result.entries[0]?.period).toBe(6);
    expect(result.places[0]?.start).toBe("14:00");
  });
  it("rejects unknown subjects and reports their source cell", () => {
    const sheet = grid();
    sheet.getCell("E5").value = "Unknown Subject\nDr. Name / G203";
    expect(() => parseUniversitySchedule(sheet, schedule)).toThrow("E5");
  });
  it("rejects unrecognized occupied cells instead of dropping them silently", () => {
    const sheet = grid();
    sheet.getCell("E5").value = "C++\nUnrecognized teacher format";
    expect(() => parseUniversitySchedule(sheet, schedule)).toThrow("E5");
  });
  it("rejects ambiguous rooms and wrong academic years", () => {
    const sheet = grid();
    sheet.getCell("E5").value = "(2) C++\nEng. Amal / A01 / G105";
    expect(() => parseUniversitySchedule(sheet, schedule)).toThrow("توزيع");
    expect(() => parseUniversitySchedule(sheet, { ...schedule, academic_year: "1" })).toThrow(
      "لا يطابق",
    );
  });
  it("rejects instructor conflicts but accepts a combined section class", () => {
    const sheet = grid();
    sheet.getCell("E5").value = "C++\nEng. Amal / A01";
    sheet.getCell("F5").value = "C++\nEng. Amal / G105";
    expect(() => parseUniversitySchedule(sheet, schedule)).toThrow("تعارض");
    sheet.getCell("F5").value = "C++\nEng. Amal / A01";
    expect(parseUniversitySchedule(sheet, schedule).entries).toHaveLength(2);
  });
  it("rejects non-hour units and formulas", () => {
    const sheet = grid();
    sheet.getCell("E5").value = "C++\nEng. Amal / A01";
    sheet.getCell("D5").value = "09:00-11:00";
    expect(() => parseUniversitySchedule(sheet, schedule)).toThrow("ساعة");
    sheet.getCell("D5").value = "09:00-10:00";
    sheet.getCell("E5").value = { formula: '"C++"', result: "C++" };
    expect(() => parseUniversitySchedule(sheet, schedule)).toThrow("الصيغ");
  });
  it("rejects classes whose time was deleted instead of silently removing them", () => {
    const sheet = grid();
    sheet.getCell("E8").value = "C++\nEng. Amal / A01";
    sheet.getCell("D8").value = null;
    expect(() => parseUniversitySchedule(sheet, schedule)).toThrow("دون موعد");
  });
});
