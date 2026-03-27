import { supabase } from "@/lib/supabaseClient";

export interface ScheduleEntry {
  id: string;
  section: number;
  day_of_week: string;
  time_slot: string;
  subject: string;
  instructor: string;
  room: string;
  entry_type: "lecture" | "section";
  is_holiday: boolean;
  is_training: boolean;
  sort_order: number;
}

export interface DaySchedule {
  day: string;
  dayKey: string;
  entries: ScheduleEntry[];
  isHoliday: boolean;
  isTraining: boolean;
}

const DAY_MAP: Record<string, string> = {
  saturday: "السبت",
  sunday: "الأحد",
  monday: "الاثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
};

const DAY_ORDER = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

export const scheduleService = {
  /** Fetch schedule for a specific section from DB */
  async fetchSchedule(sectionNum: number): Promise<DaySchedule[]> {
    const { data, error } = await supabase
      .from("course_schedule")
      .select("id, section, day_of_week, time_slot, subject, instructor, room, entry_type, is_holiday, is_training, sort_order")
      .eq("section", sectionNum)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch schedule:", error);
      return [];
    }

    const entries = (data ?? []) as ScheduleEntry[];

    return DAY_ORDER.map((dayKey) => {
      const dayEntries = entries.filter((e) => e.day_of_week === dayKey);
      const isHoliday = dayEntries.length > 0 && dayEntries[0].is_holiday;
      const isTraining = dayEntries.length > 0 && dayEntries[0].is_training;

      return {
        day: DAY_MAP[dayKey] ?? dayKey,
        dayKey,
        entries: isHoliday || isTraining ? [] : dayEntries,
        isHoliday,
        isTraining,
      };
    });
  },

  /** Fetch time slots from DB (unique, ordered) */
  async fetchTimeSlots(): Promise<string[]> {
    const { data } = await supabase
      .from("course_schedule")
      .select("time_slot")
      .neq("time_slot", "")
      .order("sort_order", { ascending: true });

    const slots = [...new Set((data ?? []).map((r) => r.time_slot as string))];
    return slots;
  },

  /** Fetch all section numbers from DB */
  async fetchSections(): Promise<string[]> {
    const { data } = await supabase
      .from("course_schedule")
      .select("section")
      .order("section", { ascending: true });

    const unique = [...new Set((data ?? []).map((r) => r.section as number))];
    return unique.map((n) => `سكشن ${n}`);
  },
};
