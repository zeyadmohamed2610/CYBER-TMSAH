import { describe, expect, it } from "vitest";
import { scheduleTiming } from "../utils/scheduleTiming";

describe("Cairo timetable status", () => {
  it("changes at the start and end of the hour without depending on local timezone", () => {
    expect(scheduleTiming(new Date("2026-10-04T05:59:59Z"), "2026-10-04", "09:00", 1)).toBe(
      "upcoming",
    );
    expect(scheduleTiming(new Date("2026-10-04T06:00:00Z"), "2026-10-04", "09:00", 1)).toBe(
      "current",
    );
    expect(scheduleTiming(new Date("2026-10-04T07:00:00Z"), "2026-10-04", "09:00", 1)).toBe(
      "finished",
    );
  });
  it("does not highlight a historical day or unknown time", () => {
    expect(scheduleTiming(new Date("2026-10-04T06:00:00Z"), "2026-10-02", "09:00", 1)).toBe(
      "other-day",
    );
    expect(scheduleTiming(undefined, "2026-10-04", "09:00", 1)).toBe("other-day");
  });
  it("handles an offset first lesson and Cairo's winter time", () => {
    expect(scheduleTiming(new Date("2026-12-04T09:30:00Z"), "2026-12-04", "09:30", 3)).toBe(
      "current",
    );
  });
});
