import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initProtection } from "./lib/protection";

// Unregister ALL old service workers and clear caches on every load
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) {
      reg.unregister();
    }
  });
  if ("caches" in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    });
  }
}

initProtection();
createRoot(document.getElementById("root")!).render(<App />);
