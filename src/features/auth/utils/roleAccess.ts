import type { AppRole } from "@/features/auth/types";
import type { UserPermissions } from "@/features/auth/context/AuthContext";

export function dashboardTabs(role: AppRole): string[] {
  if (role === "student") return ["checkin", "records", "schedule"];
  if (role === "doctor" || role === "ta") return ["lectures", "records", "schedule", "subjects"];
  return [];
}

/**
 * Determines if a user is allowed to view the academic schedule.
 * - owner: always allowed
 * - student: always allowed
 * - doctor / ta / coordinator: only if permissions.schedule_access === true
 */
export function canViewSchedule(role: AppRole | null, permissions: UserPermissions): boolean {
  if (!role) return false;
  if (role === "owner" || role === "student") return true;
  return permissions.schedule_access === true;
}
