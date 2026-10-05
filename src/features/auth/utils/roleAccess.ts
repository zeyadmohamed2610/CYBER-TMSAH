import type { AppRole } from "@/features/auth/types";

export function dashboardTabs(role: AppRole): string[] {
  if (role === "student") return ["checkin", "records", "schedule"];
  if (role === "doctor" || role === "ta") return ["lectures", "records", "schedule", "subjects"];
  return [];
}
