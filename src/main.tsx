import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/protection"; // Load protection first

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope);
      })
      .catch((error) => {
        console.error('[SW] Registration failed:', error);
      });
  });
}

// Core Web Vitals monitoring
const reportWebVitals = () => {
  // LCP (Largest Contentful Paint)
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1] as PerformanceEntry & { element?: Element };
    console.log('[Web Vitals] LCP:', lastEntry.startTime);
    
    // Send to analytics
    if (window.gtag) {
      window.gtag('event', 'web_vitals', {
        event_category: 'LCP',
        value: Math.round(lastEntry.startTime),
        event_label: 'Largest Contentful Paint',
      });
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] });

  // FID (First Input Delay)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const fidEntry = entry as PerformanceEntry & { processingStart: number; startTime: number };
      const delay = fidEntry.processingStart - fidEntry.startTime;
      console.log('[Web Vitals] FID:', delay);
      
      if (window.gtag) {
        window.gtag('event', 'web_vitals', {
          event_category: 'FID',
          value: Math.round(delay),
          event_label: 'First Input Delay',
        });
      }
    }
  }).observe({ entryTypes: ['first-input'] });

  // CLS (Cumulative Layout Shift)
  let clsValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const clsEntry = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!clsEntry.hadRecentInput) {
        clsValue += clsEntry.value;
      }
    }
    console.log('[Web Vitals] CLS:', clsValue);
    
    if (window.gtag) {
      window.gtag('event', 'web_vitals', {
        event_category: 'CLS',
        value: Math.round(clsValue * 1000) / 1000,
        event_label: 'Cumulative Layout Shift',
      });
    }
  }).observe({ entryTypes: ['layout-shift'] });

  // FCP (First Contentful Paint)
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    for (const entry of entries) {
      console.log('[Web Vitals] FCP:', entry.startTime);
      
      if (window.gtag) {
        window.gtag('event', 'web_vitals', {
          event_category: 'FCP',
          value: Math.round(entry.startTime),
          event_label: 'First Contentful Paint',
        });
      }
    }
  }).observe({ entryTypes: ['paint'] });
};

// Initialize
const init = () => {
  createRoot(document.getElementById("root")!).render(<App />);
  
  // Start monitoring after app renders
  if (import.meta.env.PROD) {
    setTimeout(reportWebVitals, 1000);
  }
};

init();
