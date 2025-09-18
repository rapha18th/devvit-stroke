// src/client/src/api.ts
export const API_BASE =
  (globalThis as any).__HS_API_BASE ||
  "https://rairo-dev-stroke.hf.space";

function log(...args: any[]) {
  console.log("[API]", ...args);
}

function headersWithUser() {
  const g = globalThis as any;
  if (!g.__hs_uid) g.__hs_uid = "anon-" + Math.random().toString(36).slice(2);
  if (!g.__hs_uname) g.__hs_uname = "anon";
  return {
    "Content-Type": "application/json",
    "X-Reddit-Id": g.__hs_uid,
    "X-Reddit-User": g.__hs_uname,
  };
}

async function fetchJSON(url: string, init?: RequestInit) {
  log("fetch", url, init?.method || "GET");
  try {
    const res = await fetch(url, {
      mode: "cors",
      redirect: "follow",
      ...init,
      headers: { ...(init?.headers || {}), ...headersWithUser() },
    });
    log("status", res.status, res.statusText);
    // Helpful for CSP diagnostics
    log("res headers", Object.fromEntries(res.headers.entries()));
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0, 400)}`);
    }
    return await res.json();
  } catch (err: any) {
    log("ERROR fetch", err?.name, err?.message);
    if (err?.stack) log(err.stack);
    throw err;
  }
}

export async function health() {
  const url = `${API_BASE}/health`;
  return fetchJSON(url);
}

export async function startToday(user: { id: string; name: string }) {
  const url = `${API_BASE}/cases/today/start`;
  log("startToday ->", url);
  return fetchJSON(url, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function callToolSignature(caseId: string, sessionId: string, imageIndex: number) {
  const url = `${API_BASE}/cases/${encodeURIComponent(caseId)}/tool/signature`;
  return fetchJSON(url, {
    method: "POST",
    headers: {
      "X-Session-Id": sessionId,
    },
    body: JSON.stringify({ image_index: imageIndex }),
  });
}
