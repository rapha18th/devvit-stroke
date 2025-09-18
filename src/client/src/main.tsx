import "./styles.css";
import "./global"; // inject logger & error traps
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

function mount() {
  try {
    console.log("[Boot] mounting app…");
    const rootEl = document.getElementById("root");
    if (!rootEl) {
      const d = document.createElement("div");
      d.id = "root";
      document.body.appendChild(d);
    }
    const root = createRoot(document.getElementById("root")!);
    root.render(<App />);
    console.log("[Boot] render requested");
  } catch (e: any) {
    console.error("[Boot] hard crash during mount", e?.message || e);
    const msg = document.createElement("pre");
    msg.style.color = "#ff6b6b";
    msg.style.padding = "12px";
    msg.textContent = "BOOT FAILED: " + (e?.message || String(e));
    document.body.appendChild(msg);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Boot] DOMContentLoaded");
  mount();
});
