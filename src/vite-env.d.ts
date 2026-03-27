/// <reference types="vite/client" />

type GtagCommand = "config" | "event";

interface GtagParams {
  [key: string]: string | number | boolean | undefined;
}

declare global {
  interface Window {
    gtag?: (command: GtagCommand, targetOrName: string, params?: GtagParams) => void;
    dataLayer?: unknown[];
  }
}

export {}
