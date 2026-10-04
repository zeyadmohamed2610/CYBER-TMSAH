import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AcademicEntry, AcademicSchedule } from "../utils/academicSchedule";
import { ScheduleMatrix } from "./ScheduleMatrix";
import { ScheduleWeekView } from "./ScheduleWeekView";

const entry = (section: number, changes: Partial<AcademicEntry> = {}): AcademicEntry => ({
  section,
  day_index: 5,
  period: 6,
  subject_id: "course",
  subject_name: "Programming For Cyber-Security",
  instructor_id: null,
  instructor_name: "Abeer",
  kind: "lecture",
  week_pattern: 0,
  room: "G203",
  uses_rotation: false,
  lab_room: "",
  hall_room: "",
  lab_week: 1,
  ...changes,
});
const schedule = (entries: AcademicEntry[]): AcademicSchedule => ({
  department: "cybersecurity",
  academic_year: "2",
  can_edit: false,
  student_section: "1",
  settings: { semester_start: null, week_start_day: 5, start_time: "09:00:00", days_off: [4, 6] },
  entries,
  subjects: [{ id: "course", name: "Programming For Cyber-Security" }],
  instructors: [],
});
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
function Harness({
  data,
  student = true,
  now,
  initialCycle = "1",
}: {
  data: AcademicSchedule;
  student?: boolean;
  now?: Date;
  initialCycle?: string;
}) {
  const [view, setView] = useState(student ? "mine" : "all");
  const [cycle, setCycle] = useState(initialCycle);
  return (
    <ScheduleWeekView
      data={data}
      student={student}
      section={1}
      view={view}
      date="2026-10-02"
      cycle={cycle === "auto" ? 1 : Number(cycle)}
      {...(now ? { now } : {})}
      actualWeek={null}
      previewCycle={cycle}
      onView={setView}
      onCycle={setCycle}
      onSection={() => {}}
      onDate={() => {}}
    />
  );
}
async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === label,
  );
  if (button) {
    await act(async () => button.click());
    return;
  }
  const option = [...container.querySelectorAll("option")].find(
    (option) => option.textContent?.trim() === label,
  );
  expect(option, `control ${label}`).toBeDefined();
  const select = option!.parentElement as HTMLSelectElement;
  await act(async () => {
    select.value = option!.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
describe("Student timetable display", () => {
  it("highlights the current lesson and only the nearest next lesson on today's automatic view", async () => {
    const data = schedule([entry(1), entry(1, { period: 7 }), entry(1, { period: 8 })]);
    await act(async () =>
      root.render(
        <Harness data={data} initialCycle="auto" now={new Date("2026-10-02T11:00:00Z")} />,
      ),
    );
    expect(container.querySelectorAll('article[data-timing="current"]')).toHaveLength(1);
    expect(
      [...container.querySelectorAll("article")].filter((card) =>
        card.textContent?.includes("القادمة"),
      ),
    ).toHaveLength(1);
    await click("الثاني");
    expect(container.querySelectorAll('article[data-timing="current"]')).toHaveLength(0);
    expect(
      [...container.querySelectorAll("article")].filter((card) =>
        card.textContent?.includes("القادمة"),
      ),
    ).toHaveLength(0);
  });
  it("collapses the full week, opens a chosen day and finds its correct venue", async () => {
    await act(async () =>
      root.render(<Harness data={schedule([entry(1), entry(1, { day_index: 0, room: "A02" })])} />),
    );
    await click("الجدول الأسبوعي");
    expect(container.querySelectorAll("article")).toHaveLength(0);
    const day = [...container.querySelectorAll("details")].find((element) =>
      element.querySelector("summary")?.textContent?.includes("الجمعة"),
    )!;
    await act(async () => {
      day.open = true;
      day.dispatchEvent(new Event("toggle"));
    });
    expect(container.querySelectorAll("article")).toHaveLength(1);
    const input = container.querySelector<HTMLInputElement>("#schedule-search")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "a02");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(container.textContent).toContain("A02");
    expect(container.textContent).not.toContain("G203");
    await click("مسح");
    expect(input.value).toBe("");
  });
  it("opens own section, switches to all sections and combines a shared lecture without duplicate cards", async () => {
    await act(async () => root.render(<Harness data={schedule([entry(1), entry(2)])} />));
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(container.textContent).toContain("جدول اليوم · سكشن 1");
    await click("كل السكاشن");
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(container.textContent).toContain("السكاشن: 1، 2");
    expect(container.textContent).toContain("2:00 م");
    expect(container.textContent).toContain("3:00 م");
    expect(container.textContent).not.toMatch(/Excel|week1|week2|استيراد/);
  });
  it("shows the correct alternating place and keeps different venues separate", async () => {
    await act(async () =>
      root.render(
        <Harness
          data={schedule([
            entry(1, { kind: "section", room: "A02", week_pattern: 1 }),
            entry(1, { kind: "section", room: "G203", week_pattern: 2 }),
            entry(2, { room: "D105" }),
          ])}
        />,
      ),
    );
    expect(container.textContent).toContain("A02");
    expect(container.textContent).not.toContain("G203");
    await click("الثاني");
    expect(container.textContent).toContain("G203");
    expect(container.textContent).not.toContain("A02");
    await click("كل السكاشن");
    expect(container.querySelectorAll("article")).toHaveLength(2);
  });
  it("marks days off and shows a useful empty day rather than displaying stored lessons", async () => {
    await act(async () =>
      root.render(<Harness data={schedule([entry(1), entry(1, { day_index: 6 })])} />),
    );
    const saturday = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("السبت"),
    )!;
    await act(async () => saturday.click());
    expect(container.textContent).toContain("إجازة حسب الجدول المعتمد.");
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });
  it("does not invent a section for an unassigned student and explains the unpublished state", async () => {
    await act(async () =>
      root.render(<Harness data={{ ...schedule([]), student_section: null }} />),
    );
    expect(container.textContent).toContain("لم يُحدد سكشن حسابك بعد");
    expect(container.textContent).toContain("الجدول لم يُنشر بعد");
  });
});

describe("schedule matrix", () => {
  const renderMatrix = async (entries: AcademicEntry[], selectedDay: number | null = null) => {
    await act(async () =>
      root.render(
        <ScheduleMatrix
          data={schedule(entries)}
          entries={entries}
          days={[5, 6, 0, 1, 2, 3, 4]}
          selectedDay={selectedDay}
          section={1}
          allSections
          cycleForDay={() => 2}
        />,
      ),
    );
  };
  it("merges shared lectures without merging different rooms and respects holidays", async () => {
    await renderMatrix([
      entry(1),
      entry(2),
      entry(3, { room: "D105" }),
      entry(1, { day_index: 6, subject_name: "Holiday lesson" }),
    ]);
    const table = container.querySelector("table")!;
    expect(table.textContent?.match(/Programming For Cyber-Security/g)).toHaveLength(2);
    expect(table.textContent).toContain("سكاشن 1، 2");
    expect(table.textContent).toContain("D105");
    expect(table.textContent).not.toContain("Holiday lesson");
  });
  it("shows every section through pages on phones and uses the selected rotation", async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    try {
      await renderMatrix(
        [entry(15, { uses_rotation: true, lab_room: "Lab", hall_room: "Hall", lab_week: 2 })],
        5,
      );
      expect(container.querySelectorAll("thead th")).toHaveLength(4);
      expect(container.querySelector("table")?.textContent).not.toContain("Hall");
      for (let i = 0; i < 4; i++) await click("التالي");
      expect(container.querySelector("table")?.textContent).toContain("سكشن 15");
      expect(container.querySelector("table")?.textContent).toContain("Lab");
      expect(
        [...container.querySelectorAll("button")].find((b) => b.textContent === "التالي")?.disabled,
      ).toBe(true);
    } finally {
      Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
    }
  });
  it("preserves empty periods between lessons", async () => {
    await renderMatrix([entry(1, { period: 1 }), entry(1, { period: 3 })]);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(container.querySelectorAll("tbody tr")[1]?.textContent).toContain("—");
  });
});
