/// <reference types="vite/client" />

// Google Analytics gtag declaration
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export {}
