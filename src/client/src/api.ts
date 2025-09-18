// The API_BASE now points to your own server's proxy endpoints.
export const API_BASE = "/api/proxy";

function log(...args: any[]) {
  console.log("[API]", ...args);
}

// This function is now much simpler. The server adds the secure user headers.
function standardHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

/**
 * A wrapper around fetch to handle JSON and errors for same-origin requests.
 */
async function fetchJSON(url: string, init?: RequestInit) {
  log("fetch", url, init?.method || "GET");
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers || {}), ...standardHeaders() },
    });
    log("status", res.status, res.statusText);
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

// The 'user' parameter is no longer needed here, as the server gets the user context.
export async function startToday() {
  const url = `${API_BASE}/cases/today/start`;
  log("startToday ->", url);
  return fetchJSON(url, {
    method: "POST",
    body: JSON.stringify({}), // Body is still sent if your backend needs it.
  });
}

export async function callToolSignature(caseId: string, sessionId: string, imageIndex: number) {
  const url = `${API_BASE}/cases/${encodeURIComponent(caseId)}/tool/signature`;
  return fetchJSON(url, {
    method: "POST",
    headers: {
      // The session ID is passed as a header to our server, which then forwards it.
      "X-Session-Id": sessionId,
    },
    body: JSON.stringify({ image_index: imageIndex }),
  });
}
