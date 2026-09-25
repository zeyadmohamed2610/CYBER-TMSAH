// src/i18n/index.ts — Language context + hook

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import en from "./en";
import ar from "./ar";
import type { Translations } from "./en";

export type Language = "en" | "ar";

const translations: Record<Language, Translations> = { en, ar };

interface LanguageContextValue {
  lang: Language;
  t: Translations;
  setLang: (l: Language) => void;
  dir: "ltr" | "rtl";
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = "cyber_lang";

const getStoredLang = (): Language => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "ar") return v;
  } catch { /* ignore */ }
  return "en"; // default: English
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(getStoredLang);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRTL = dir === "rtl";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, t: translations[lang], setLang, dir, isRTL }),
    [lang, setLang, dir, isRTL],
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
