/** Simple template interpolation: t("lockedOutTimer", { minutes: 3 }) */
export const interpolate = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
