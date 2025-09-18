// Allow override via ?api=... then Vite env, then hard fallback.
const fromQuery = new URLSearchParams(window.location.search).get('api');
export const API_BASE =
  (fromQuery || import.meta.env.VITE_API_BASE || 'https://rairo-dev-stroke.hf.space')
    .replace(/\/$/, '');

console.log('[HiddenStroke] API_BASE =', API_BASE);

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
