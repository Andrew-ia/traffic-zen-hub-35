import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { initGtm } from "@/lib/gtm";

// Initialize GTM using localStorage override if available
(() => {
  let containerId: string | undefined = import.meta.env.VITE_GTM_ID;
  try {
    const raw = window.localStorage.getItem("trafficpro.gtm.config");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.containerId && typeof parsed.containerId === "string") {
        containerId = parsed.containerId;
      }
    }
  } catch (e) {
    // ignore storage errors
  }
  initGtm(containerId);
})();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
