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
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    beforeSend(event, hint) {
      // Filter out known non-actionable errors
      const error = hint.originalException;
      if (error instanceof Error) {
        const message = error.message;
        // Skip chunk load errors (handled by auto-reload)
        if (message.includes("Failed to fetch dynamically imported module") || message.includes("error loading dynamically imported module")) {
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

// ── Auto-reload on dynamic import failure (e.g. after a new release) ────────
if (typeof window !== "undefined") {
  const handleChunkError = () => {
    const lastReload = sessionStorage.getItem("vite_chunk_reload");
    const now = Date.now();
    // Prevent reload loops - only reload once every 10 seconds
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem("vite_chunk_reload", now.toString());
      window.location.reload();
    }
  };

  window.addEventListener("vite:preloadError", handleChunkError);

  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || "";
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("error loading dynamically imported module")
    ) {
      handleChunkError();
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
