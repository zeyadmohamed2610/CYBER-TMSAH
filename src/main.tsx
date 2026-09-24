import * as Sentry from "@sentry/react";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry error tracking
const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay(),
      new Sentry.BrowserSessionReplay(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    release: {
      name: import.meta.env.VITE_SENTRY_RELEASE || `v${Date.now()}`,
    },
    beforeSend(event, hint) {
      // Filter out known non-actionable errors
      const error = hint.originalException;
      if (error instanceof Error) {
        const message = error.message;
        // Skip chunk load errors (handled by PWA update)
        if (message.includes("Failed to fetch dynamically imported module")) {
          return null;
        }
        // Skip network errors from user's offline mode
        if (message.includes("NetworkError") && navigator.onLine === false) {
          return null;
        }
      }
      return event;
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);