import type { AppRole } from "@/features/auth/types";

export function dashboardTabs(role: AppRole): string[] {
  if (role === "student") return ["checkin", "records", "schedule", "analytics", "followup"];
  if (role === "doctor" || role === "ta")
    return ["lectures", "records", "schedule", "subjects", "followup"];
  return [];
}

export function learningTabs(role: AppRole | null): string[] {
  if (!role) return [];
  const personal = ["results", "cases", "notifications"];
  return role === "owner" || role === "coordinator"
    ? [...personal, "terms", "rules", "privacy"]
    : personal;
}
