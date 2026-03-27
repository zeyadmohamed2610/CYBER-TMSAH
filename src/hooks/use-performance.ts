import { useEffect } from "react";

interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput: boolean;
  value: number;
}

interface FirstInputEntry extends PerformanceEntry {
  processingStart: number;
}

interface AnalyticsEventParams {
  event_category: string;
  event_label: string;
  non_interaction: boolean;
  value: number;
}

const trackAnalyticsEvent = (eventName: string, params: AnalyticsEventParams) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }
};

/**
 * Performance monitoring hook
 * Tracks Core Web Vitals and reports to analytics
 */
export const usePerformanceMonitoring = () => {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    if ("PerformanceObserver" in window) {
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;

          list.getEntries().forEach((entry) => {
            const layoutShiftEntry = entry as LayoutShiftEntry;
            if (!layoutShiftEntry.hadRecentInput) {
              clsValue += layoutShiftEntry.value;
            }
          });

          trackAnalyticsEvent("web_vitals", {
            event_category: "CLS",
            value: Math.round(clsValue * 1000) / 1000,
            event_label: "layout_shift",
            non_interaction: true,
          });
        });

        clsObserver.observe({ entryTypes: ["layout-shift"] });
        cleanups.push(() => clsObserver.disconnect());
      } catch {
        // Browser does not support CLS observation.
      }

      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];

          if (!lastEntry) return;

          trackAnalyticsEvent("web_vitals", {
            event_category: "LCP",
            value: Math.round(lastEntry.startTime),
            event_label: "largest_contentful_paint",
            non_interaction: true,
          });
        });

        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
        cleanups.push(() => lcpObserver.disconnect());
      } catch {
        // Browser does not support LCP observation.
      }

      try {
        const fidObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            const firstInputEntry = entry as FirstInputEntry;

            trackAnalyticsEvent("web_vitals", {
              event_category: "FID",
              value: Math.round(firstInputEntry.processingStart - firstInputEntry.startTime),
              event_label: "first_input_delay",
              non_interaction: true,
            });
          });
        });

        fidObserver.observe({ entryTypes: ["first-input"] });
        cleanups.push(() => fidObserver.disconnect());
      } catch {
        // Browser does not support FID observation.
      }
    }

    const onLoad = () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType("navigation")[0] as
          | PerformanceNavigationTiming
          | undefined;

        if (!perfData) return;

        trackAnalyticsEvent("page_load_time", {
          event_category: "Performance",
          value: Math.round(perfData.loadEventEnd - perfData.startTime),
          event_label: "page_load",
          non_interaction: true,
        });
      }, 0);
    };

    window.addEventListener("load", onLoad);

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      window.removeEventListener("load", onLoad);
    };
  }, []);
};

export default usePerformanceMonitoring;
