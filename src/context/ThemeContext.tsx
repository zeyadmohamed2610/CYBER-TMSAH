// src/context/ThemeContext.tsx — Permanent Cyber Dark mode provider

import { createContext, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";

export type Theme = "dark";

interface ThemeContextValue {
  theme: "dark";
  toggleTheme: () => void;
  setTheme: (t: string) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light");
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
    try {
      localStorage.setItem("cyber_theme", "dark");
    } catch { /* ignore */ }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: "dark",
      toggleTheme: () => {}, // Light mode is disabled across project
      setTheme: () => {},
      isDark: true,
    }),
    [],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
