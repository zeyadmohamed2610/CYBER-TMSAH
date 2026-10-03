import { slotTime } from "./academicSchedule";

const cairoDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" });
const cairoTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Cairo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Compare a timetable slot with Cairo time, independently of the browser's timezone. */
export function scheduleTiming(now: Date | undefined, date: string, start: string, period: number) {
  if (!now || cairoDateFormatter.format(now) !== date) return "other-day";
  const parts = cairoTimeFormatter.formatToParts(now);
  const minute =
    Number(parts.find((p) => p.type === "hour")?.value) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value);
  const [hour, minutes] = slotTime(start, period).split(":").map(Number);
  const begins = hour! * 60 + minutes!;
  return minute < begins ? "upcoming" : minute < begins + 60 ? "current" : "finished";
}
