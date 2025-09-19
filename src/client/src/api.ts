export const API_BASE = "/api/proxy";

function log(...args: any[]) {
  console.log("[API]", ...args);
}
function standardHeaders() {
  return { "Content-Type": "application/json" };
}

async function fetchJSON(url: string, init?: RequestInit) {
  const method = init?.method || "GET";
  log(method, url);
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), ...standardHeaders() },
  });
  log("→", res.status, res.statusText);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0, 500)}`);
  }
  return res.json();
}

// -------- API surface --------

export async function health() {
  return fetchJSON(`${API_BASE}/health`);
}

export async function startToday() {
  return fetchJSON(`${API_BASE}/cases/today/start`, {
    method: "POST",
    body: JSON.stringify({}),
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

// ----- convenience: compare all three at once -----

export async function compareSignature(caseId: string, sessionId: string) {
  const [a, b, c] = await Promise.all([
    callToolSignature(caseId, sessionId, 0),
    callToolSignature(caseId, sessionId, 1),
    callToolSignature(caseId, sessionId, 2),
  ]);
  return [a, b, c] as const;
}

export async function compareMetadata(caseId: string, sessionId: string) {
  const [a, b, c] = await Promise.all([
    callToolMetadata(caseId, sessionId, 0),
    callToolMetadata(caseId, sessionId, 1),
    callToolMetadata(caseId, sessionId, 2),
  ]);
  return [a, b, c] as const;
}
