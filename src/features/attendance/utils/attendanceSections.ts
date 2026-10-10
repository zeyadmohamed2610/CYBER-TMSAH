/** Read the canonical section list returned by academic-unit and session APIs. */
export function parseAttendanceSections(value?: string | null): number[] {
  if (!value) return [];
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.some((section) => !Number.isInteger(section) || section < 1 || section > 15)) {
    return [];
  }
  return [...new Set(parts)].sort((a, b) => a - b);
}

export function sessionSectionsText(row: {
  section?: string | null;
  section_numbers?: number[] | null;
}): string | null {
  return row.section_numbers?.length ? row.section_numbers.join(", ") : (row.section ?? null);
}
