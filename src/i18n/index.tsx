// src/i18n/index.ts — Language context (Arabic-first, translation removed)

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import ar from "./ar";
import type { Translations } from "./en";

export type Language = "ar";

interface LanguageContextValue {
  lang: Language;
  t: Translations;
  setLang: (l: Language) => void;
  dir: "rtl";
  isRTL: true;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Always Arabic across the entire site
  const [lang] = useState<Language>("ar");

  const setLang = useCallback(() => {
    // No-op: Arabic is the permanent and only language
  }, []);

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    try {
      localStorage.setItem("cyber_lang", "ar");
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang: "ar",
      t: ar as unknown as Translations,
      setLang,
      dir: "rtl",
      isRTL: true,
    }),
    [setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
};

/** Simple template interpolation: t("lockedOutTimer", { minutes: 3 }) */
export const interpolate = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
