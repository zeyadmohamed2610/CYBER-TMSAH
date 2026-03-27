import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initProtection } from "./lib/protection";

initProtection();
createRoot(document.getElementById("root")!).render(<App />);
