import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initProtection } from "./lib/protection";

// Force service worker update on every page load
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) {
      reg.update();
    }
  });
}

initProtection();
createRoot(document.getElementById("root")!).render(<App />);
