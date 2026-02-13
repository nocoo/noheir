import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply theme before render to avoid flash
const stored = (() => {
  try {
    const raw = localStorage.getItem("finance-settings");
    if (raw) return JSON.parse(raw).theme;
  } catch { /* ignore */ }
  return null;
})();
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const isDark = stored === "dark" || (stored !== "light" && prefersDark);
document.documentElement.classList.add(isDark ? "dark" : "light");

createRoot(document.getElementById("root")!).render(<App />);
