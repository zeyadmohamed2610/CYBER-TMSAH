import type { AppRole } from "@/features/auth/types";

export interface ExportRequest {
  format: "csv" | "xlsx" | "pdf";
  role: AppRole;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportResult {
  exportId: string;
  downloadUrl: string | null;
}
