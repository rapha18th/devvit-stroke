// src/client/api.ts
// Single base for your own server's proxy endpoints.
export const API_BASE = "/api/proxy";

function log(...args: any[]) {
  // keep it noisy during the hackathon
  console.log("[API]", ...args);
}

// server injects reddit headers; we only need JSON here
function standardHeaders() {
  return { "Content-Type": "application/json" };
}

/** tiny helper around fetch that always returns JSON or throws with detail */
async function fetchJSON(url: string, init?: RequestInit) {
  const method = init?.method || "GET";
  log(method, url);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers || {}), ...standardHeaders() },
    });
    log("→", res.status, res.statusText);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0, 500)}`);
    }
    return await res.json();
  } catch (err: any) {
    log("ERROR", err?.name, err?.message);
    if (err?.stack) log(err.stack);
    throw err;
  }
}

// ------------ simple API surface used by the UI ------------

export async function health() {
  return fetchJSON(`${API_BASE}/health`);
}

export async function startToday() {
  return fetchJSON(`${API_BASE}/cases/today/start`, {
    method: "POST",
    body: JSON.stringify({}), // keep shape consistent with server
  });
}

export async function callToolSignature(caseId: string, sessionId: string, imageIndex: number) {
  return fetchJSON(`${API_BASE}/cases/${encodeURIComponent(caseId)}/tool/signature`, {
    method: "POST",
    headers: { "X-Session-Id": sessionId },
    body: JSON.stringify({ image_index: imageIndex }),
  });
}

export async function callToolMetadata(caseId: string, sessionId: string, imageIndex: number) {
  return fetchJSON(`${API_BASE}/cases/${encodeURIComponent(caseId)}/tool/metadata`, {
    method: "POST",
    headers: { "X-Session-Id": sessionId },
    body: JSON.stringify({ image_index: imageIndex }),
  });
}

export async function callToolFinancial(caseId: string, sessionId: string) {
  return fetchJSON(`${API_BASE}/cases/${encodeURIComponent(caseId)}/tool/financial`, {
    method: "POST",
    headers: { "X-Session-Id": sessionId },
    body: JSON.stringify({}), // no params needed
  });
}

export async function submitGuess(caseId: string, sessionId: string, imageIndex: number, rationale: string) {
  return fetchJSON(`${API_BASE}/cases/${encodeURIComponent(caseId)}/guess`, {
    method: "POST",
    headers: { "X-Session-Id": sessionId },
    body: JSON.stringify({ image_index: imageIndex, rationale }),
  });
}

export async function getDailyLeaderboard() {
  return fetchJSON(`${API_BASE}/leaderboard/daily`);
}

// Exposed types (very light so you don’t need to import from server code)
export type CasePublic = {
  case_id: string;
  mode: "knowledge" | "observation";
  brief: string;
  images: string[];
  signature_crops: string[];
  metadata: any[];
  ledger_summary: string;
  timer_seconds: number;
  initial_ip: number;
  tool_costs: { signature: number; metadata: number; financial: number };
  credits: any;
};
