import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Google Analytics 4 Tracking Component
 * Tracks page views on SPA route changes.
 * The initial page view is already sent by the gtag snippet in index.html,
 * so we only fire on subsequent navigation events to avoid double-counting.
 *
 * NOTE: "Fetch failed" errors in the console for google-analytics.com/g/collect
 * are expected when users have ad blockers or privacy extensions installed.
 * They do NOT indicate a bug in the application.
 */
export const Analytics = () => {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (location.pathname === "/reset-password") return;
    // Skip the very first render — gtag in index.html already sent this page view
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const measurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID as string) || "G-CWG5Z7E041";

    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      try {
        window.gtag("event", "page_view", {
          page_path: location.pathname + location.search,
          page_location: window.location.href,
          page_title: document.title,
          send_to: measurementId,
        });
      } catch {
        // Silently ignore — GA blocked by ad blockers is expected and harmless
      }
    }
  }, [location.pathname, location.search]);

  return null;
};

export default Analytics;
