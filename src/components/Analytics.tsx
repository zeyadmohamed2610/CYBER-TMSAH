import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Google Analytics 4 Tracking Component
 * Automatically tracks page views on route changes
 */
export const Analytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("config", "GA_MEASUREMENT_ID", {
        page_path: location.pathname + location.search,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [location]);

  return null;
};

export default Analytics;
