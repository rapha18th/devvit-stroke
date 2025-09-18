// Allow override via ?api=... then Vite env, then hard fallback.
const fromQuery = new URLSearchParams(window.location.search).get('api');
export const API_BASE =
  (fromQuery || import.meta.env.VITE_API_BASE || 'https://rairo-dev-stroke.hf.space')
    .replace(/\/$/, '');

console.log('[HiddenStroke] API_BASE =', API_BASE);
// API helper with loud logging

export const API_BASE =
  (typeof DEVVIT !== "undefined" && (DEVVIT as any).ENV?.HIDDEN_STROKE_API) ||
  (globalThis as any).HIDDEN_STROKE_API ||
  "https://rairo-dev-stroke.hf.space";

export async function startToday(user: { id: string; name: string }) {
  const url = `${API_BASE}/cases/today/start`;
  console.info("[API] startToday ->", url);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Reddit-Id": user.id,
        "X-Reddit-User": user.name,
      },
      body: JSON.stringify({}),
    });
    console.info("[API] startToday status", res.status);
    const text = await res.text();
    console.info("[API] startToday raw", text.slice(0, 400));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    return JSON.parse(text);
  } catch (e: any) {
    console.error("[API] startToday failed", e?.message || e);
    throw e;
  }
}

export async function callToolSignature(caseId: string, sessionId: string, index: number) {
  const url = `${API_BASE}/cases/${caseId}/tool/signature`;
  console.info("[API] tool/signature ->", url, { index });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": sessionId,
    },
    body: JSON.stringify({ image_index: index }),
  });
  const data = await res.json().catch(() => ({}));
  console.info("[API] signature resp", res.status, data);
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

type JSONValue = any;

// Convenience fetch wrapper that always surfaces error bodies.
async function jfetch<T = JSONValue>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function health() {
  return jfetch('/health');
}

// Provide sane defaults if Reddit headers aren’t available (playtest/local)
function redditHeaders() {
  const user = (window as any).reddit?.user?.name ?? 'Playtester';
  const id = (window as any).reddit?.user?.id ?? 't2_playtester';
  return {
    'X-Reddit-User': user,
    'X-Reddit-Id': id,
  };
}

export type StartCaseResponse = {
  session_id: string;
  case: {
    case_id: string;
    mode: 'knowledge'|'observation';
    brief: string;
    style_period: string;
    images: string[];
    signature_crops: string[];
    metadata: Array<Record<string, any>>;
    ledger_summary: string;
    timer_seconds: number;
    initial_ip: number;
    tool_costs: { signature: number; metadata: number; financial: number };
    credits: Record<string,string>;
  };
};

export async function startCase(): Promise<StartCaseResponse> {
  return jfetch('/cases/today/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...redditHeaders() },
  });
}

export async function toolSignature(caseId: string, idx: number) {
  return jfetch(`/cases/${caseId}/tool/signature`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...redditHeaders() },
    body: JSON.stringify({ image_index: idx }),
  });
}

export async function toolMetadata(caseId: string, idx: number) {
  return jfetch(`/cases/${caseId}/tool/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...redditHeaders() },
    body: JSON.stringify({ image_index: idx }),
  });
}

export async function toolFinancial(caseId: string) {
  return jfetch(`/cases/${caseId}/tool/financial`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...redditHeaders() },
  });
}

export async function submitGuess(caseId: string, idx: number, rationale: string) {
  return jfetch(`/cases/${caseId}/guess`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...redditHeaders() },
    body: JSON.stringify({ image_index: idx, rationale }),
  });
}

export async function leaderboardDaily() {
  return jfetch('/leaderboard/daily', {
    headers: { ...redditHeaders() },
  });
}
