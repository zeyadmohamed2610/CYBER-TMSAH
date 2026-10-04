import { useEffect } from "react";
import type { Metric } from "web-vitals";

// One observer set per document, including React StrictMode and route remounts.
let monitoringStarted = false;
const report = (metric: Metric) => {
  if (window.location.pathname === "/reset-password") return;
  window.gtag?.("event", "web_vitals", {
    event_category: metric.name,
    value: metric.value,
    metric_id: metric.id,
    metric_delta: metric.delta,
    metric_rating: metric.rating,
    non_interaction: true,
  });
};
export const usePerformanceMonitoring = () => {
  useEffect(() => {
    if (monitoringStarted) return;
    monitoringStarted = true;
    // Buffered observers keep initial paint entries without blocking startup.
    void import("web-vitals")
      .then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
        onCLS(report);
        onINP(report);
        onLCP(report);
        onFCP(report);
        onTTFB(report);
      })
      .catch(() => {
        monitoringStarted = false;
      });
  }, []);
};
export default usePerformanceMonitoring;
