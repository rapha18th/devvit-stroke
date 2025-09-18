// Simple in-page logger so we can see logs even on iPad.
// It mirrors console.* calls into a floating panel in the webview.

type Level = "log" | "info" | "warn" | "error";
const PANEL_ID = "__hs_log_panel__";

function ensurePanel(): HTMLDivElement {
  let panel = document.getElementById(PANEL_ID) as HTMLDivElement | null;
  if (!panel) {
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = `
      position: fixed; inset: auto 8px 8px 8px; max-height: 45vh; z-index: 999999;
      background: rgba(0,0,0,0.85); color: #E6E6E6; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      padding: 8px 8px 12px; border-radius: 6px; overflow: auto; box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    `;
    const bar = document.createElement("div");
    bar.style.cssText = `display:flex; align-items:center; gap:8px; margin-bottom:6px;`;
    bar.innerHTML = `
      <strong style="font-weight:600">HiddenStroke Logs</strong>
      <button id="__hs_clear__" style="margin-left:auto;background:#333;border:1px solid #555;color:#ddd;border-radius:4px;padding:2px 6px">clear</button>
    `;
    bar.querySelector<HTMLButtonElement>("#__hs_clear__")!.onclick = () => {
      const body = panel!.querySelector<HTMLDivElement>(".body");
      if (body) body.innerHTML = "";
    };
    const body = document.createElement("div");
    body.className = "body";
    panel.append(bar, body);
    document.body.append(panel);
  }
  return panel!;
}

export function logToPanel(level: Level, ...args: any[]) {
  try {
    const panel = ensurePanel();
    const body = panel.querySelector<HTMLDivElement>(".body")!;
    const row = document.createElement("div");
    const ts = new Date().toLocaleTimeString();
    row.style.whiteSpace = "pre-wrap";
    const color =
      level === "error" ? "#ff6b6b" :
      level === "warn"  ? "#ffd166" :
      level === "info"  ? "#8ecae6" :
                          "#e6e6e6";
    row.innerText = `[${ts}] ${level.toUpperCase()} ${args.map(a => {
      try { return typeof a === "string" ? a : JSON.stringify(a); }
      catch { return String(a); }
    }).join(" ")}`;
    row.style.color = color;
    body.append(row);
    body.scrollTop = body.scrollHeight;
  } catch {}
}

// Patch console to also mirror into panel (non-destructive)
(["log","info","warn","error"] as Level[]).forEach((lvl) => {
  const orig = console[lvl];
  console[lvl] = (...a: any[]) => { try { logToPanel(lvl, ...a); } catch {} ; orig.apply(console, a); };
});

// Global error traps
window.addEventListener("error", (ev) => {
  console.error("[GlobalError]", ev.message, ev.error);
});
window.addEventListener("unhandledrejection", (ev) => {
  console.error("[UnhandledRejection]", ev.reason);
});
