import type {
  StartResponse,
  SignatureToolResponse,
  HintToolResponse,
  GuessResponse,
  LeaderboardDaily
} from './types';


// Allow override via ?api=... (handy for playtest), then env, then hard fallback.
const fromQuery = new URLSearchParams(window.location.search).get('api');
export const API_BASE =
  (fromQuery || import.meta.env.VITE_API_BASE || 'https://rairo-dev-stroke.hf.space')
    .replace(/\/$/, '');

console.log('[HiddenStroke] API_BASE =', API_BASE);

export async function startCase(user: string, uid: string) {
  const r = await fetch(`${API_BASE}/cases/today/start`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Reddit-User': user || 'Playtester',
      'X-Reddit-Id': uid || 't2_playtester'
    }
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`startCase failed: ${r.status} ${t}`);
  }
  return r.json();
}


export type Identity = {
  user: string;
  uid: string;
};

function getIdentity(): Identity {
  const q = new URLSearchParams(window.location.search);
  const user = q.get('user') || 'anon';
  const uid = q.get('uid') || (() => {
    const k = 'hs_anon_id';
    let v = localStorage.getItem(k);
    if (!v) {
      v = `anon-${crypto.randomUUID()}`;
      localStorage.setItem(k, v);
    }
    return v;
  })();
  return { user, uid };
}

async function fetchJson<T>(
  path: string,
  opts: { method?: string; body?: any; sessionId?: string } = {}
): Promise<T> {
  const { user, uid } = getIdentity();
  const method = opts.method || 'GET';
  const headers: Record<string, string> = {
    'X-Reddit-User': user,
    'X-Reddit-Id': uid
  };
  if (method !== 'GET') headers['Content-Type'] = 'application/json';
  if (opts.sessionId) headers['X-Session-Id'] = opts.sessionId;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(opts.body || {})
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function apiStartToday(): Promise<StartResponse> {
  return fetchJson<StartResponse>('/cases/today/start', { method: 'POST' });
}

export async function apiToolSignature(sessionId: string, caseId: string, imageIndex: number) {
  return fetchJson<SignatureToolResponse>(`/cases/${caseId}/tool/signature`, {
    method: 'POST',
    sessionId,
    body: { image_index: imageIndex }
  });
}

export async function apiToolMetadata(sessionId: string, caseId: string, imageIndex: number) {
  return fetchJson<HintToolResponse>(`/cases/${caseId}/tool/metadata`, {
    method: 'POST',
    sessionId,
    body: { image_index: imageIndex }
  });
}

export async function apiToolFinancial(sessionId: string, caseId: string) {
  return fetchJson<HintToolResponse>(`/cases/${caseId}/tool/financial`, {
    method: 'POST',
    sessionId
  });
}

export async function apiGuess(sessionId: string, caseId: string, imageIndex: number, rationale?: string) {
  return fetchJson<GuessResponse>(`/cases/${caseId}/guess`, {
    method: 'POST',
    sessionId,
    body: { image_index: imageIndex, rationale }
  });
}

export async function apiLeaderboardDaily(): Promise<LeaderboardDaily> {
  return fetchJson<LeaderboardDaily>('/leaderboard/daily', { method: 'GET' });
}
