// server/index.ts
import express, { Request, Response } from 'express';
import { createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import {
  InitResponse,
  IncrementResponse,
  DecrementResponse,
} from '../shared/types/api';

// ----------------------------------------------------------------------------
// App setup
// ----------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// ----------------------------------------------------------------------------
// Original router (minimal OK stubs to keep UI happy)
// ----------------------------------------------------------------------------
const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    res.json({ status: 'success', value: { count: 0 } } as any);
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    res.json({ status: 'success', value: { count: 1 } } as any);
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    res.json({ status: 'success', value: { count: 0 } } as any);
  }
);

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();
    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({ status: 'error', message: 'Failed to create post' });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();
    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({ status: 'error', message: 'Failed to create post' });
  }
});

app.use(router);

// ============================================================================
// MOCK GAME DATA (5 cases, self-contained, CC0-style placeholders)
// ============================================================================

// Small helper to make crisp SVG data-URIs with label text (A/B/C etc.)
function svgDataUri(label: string, color = '#1e90ff'): string {
  const w = 960;
  const h = 640;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${color}'/><stop offset='100%' stop-color='#111'/></linearGradient></defs>` +
    `<rect width='100%' height='100%' fill='url(#g)'/>` +
    `<text x='50%' y='50%' font-family='ui-sans-serif,system-ui' font-size='72' fill='white' text-anchor='middle' dominant-baseline='middle'>${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Reusable signature crops (just smaller SVGs)
function mini(label: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>` +
    `<rect width='100%' height='100%' fill='#111'/>` +
    `<text x='50%' y='50%' font-family='ui-sans-serif,system-ui' font-size='64' fill='#00eaff' text-anchor='middle' dominant-baseline='middle'>${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type PublicCase = {
  case_id: string;
  mode: 'knowledge' | 'observation';
  brief: string;
  style_period: string;
  images: string[];             // 3
  signature_crops: string[];    // 3
  metadata: {
    title: string;
    year: string;
    medium: string;
    ink_or_pigment?: string;
    catalog_ref?: string;
    ownership_chain?: string[];
    notes?: string;
  }[];
  ledger_summary: string;
  timer_seconds: number;
  initial_ip: number;
  tool_costs: { signature: number; metadata: number; financial: number };
  credits: {
    source: string;
    identifier?: string;
    title?: string;
    creator?: string;
    rights?: string;
    licenseurl?: string;
  };
};

type CaseSolution = {
  answer_index: 0 | 1 | 2;
  flags_signature: string[];
  flags_metadata: string[];
  flags_financial: string[];
  explanation: string;
};

const TIMER_SECONDS = 90;
const INITIAL_IP = 8;
const TOOL_COSTS = { signature: 1, metadata: 1, financial: 2 };

// Five small, self-contained cases (A/B/C images are labeled; A=0, B=1, C=2).
// Replace brief/metadata later with real museum text if you like; this is hackathon-ready.
const MOCK_CASES: { public: PublicCase; solution: CaseSolution }[] = [
  {
    public: {
      case_id: 'CASE-001',
      mode: 'observation',
      brief:
        'A floral study resurfaces with three nearly identical impressions. Which one bears the authentic signature rhythm?',
      style_period: 'Late 19th c. studio study (public-domain reproduction)',
      images: [svgDataUri('Irises — A'), svgDataUri('Irises — B', '#9c27b0'), svgDataUri('Irises — C', '#ff6d00')],
      signature_crops: [mini('A sig'), mini('B sig'), mini('C sig')],
      metadata: [
        {
          title: 'Irises',
          year: '1889',
          medium: 'Oil on canvas',
          ink_or_pigment: 'lead white; natural ultramarine',
          catalog_ref: 'CAT-IRIS-1889-A',
          ownership_chain: ['Estate sale 1922', 'Museum receipt 1990'],
          notes: 'Conservation note references a 1940 cleaning.',
        },
        {
          title: 'Irises (variant)',
          year: '1889',
          medium: 'Oil on canvas',
          ink_or_pigment: 'lead white; synthetic ultramarine',
          catalog_ref: 'CAT-IRIS-1889-B',
          ownership_chain: ['Gallery cert 2001', 'Auction 2018'],
          notes: 'Certificate paper watermark is modern.',
        },
        {
          title: 'Irises (variant C)',
          year: '1890',
          medium: 'Oil on canvas',
          ink_or_pigment: 'zinc white trace',
          catalog_ref: 'CAT-IRIS-1890-C',
          ownership_chain: ['Private collection 2015'],
          notes: 'Year and catalog format mismatch.',
        },
      ],
      ledger_summary:
        'Sales chain looks neat; only one ledger aligns with historic conservation notes and vendor paperwork.',
      timer_seconds: TIMER_SECONDS,
      initial_ip: INITIAL_IP,
      tool_costs: TOOL_COSTS,
      credits: { source: 'Mock Open Access (hackathon placeholder)' },
    },
    solution: {
      answer_index: 0,
      flags_signature: ['Stroke overlap order matches period sample; baseline alignment consistent.'],
      flags_metadata: ['B/C show catalog formatting inconsistencies and year drift.'],
      flags_financial: ['B has modern watermark on certificate; C lacks period receipts.'],
      explanation:
        'A aligns with conservation notes and historic pigment set; B/C include modern artifacts in paperwork and micro-signature.',
    },
  },
  {
    public: {
      case_id: 'CASE-002',
      mode: 'knowledge',
      brief:
        'A woodblock print claims to be an 1831 first edition. Registration marks and paper fibers may expose a modern reprint.',
      style_period: 'Edo woodblock print',
      images: [svgDataUri('Great Wave — A', '#0ea5e9'), svgDataUri('Great Wave — B', '#2563eb'), svgDataUri('Great Wave — C', '#0ea5e9')],
      signature_crops: [mini('A reg'), mini('B reg'), mini('C reg')],
      metadata: [
        {
          title: 'Under the Wave off Kanagawa',
          year: '1831',
          medium: 'Woodblock print; ink & color on paper',
          catalog_ref: 'WB-OKI-1831-A',
          ownership_chain: ['Publisher archive 1832', 'Private 1902'],
          notes: 'Shows double registration marks typical of early runs.',
        },
        {
          title: 'Under the Wave — variant B',
          year: '1831',
          medium: 'Woodblock print',
          catalog_ref: 'WB-OKI-1831-B',
          ownership_chain: ['Commercial reproduction 1920', 'Gallery 1950'],
          notes: 'Registration slightly offset; Prussian blue layering differs.',
        },
        {
          title: 'Under the Wave — variant C',
          year: '1831',
          medium: 'Woodblock print',
          catalog_ref: 'WB-OKI-1831-C',
          ownership_chain: ['Modern reproduction 1999'],
          notes: 'Paper fiber indicates modern rag blend.',
        },
      ],
      ledger_summary:
        'Only one entry traces to early publisher records; others stem from later commercial reprint lines.',
      timer_seconds: TIMER_SECONDS,
      initial_ip: INITIAL_IP,
      tool_costs: TOOL_COSTS,
      credits: { source: 'Mock Open Access (hackathon placeholder)' },
    },
    solution: {
      answer_index: 0,
      flags_signature: ['Authentic block registration alignment; early run features present.'],
      flags_metadata: ['B/C lack early publisher documentation and show modern materials.'],
      flags_financial: ['Original publisher receipts present only for A.'],
      explanation:
        'A matches period registration and material profile; B/C show later reproduction cues.',
    },
  },
  {
    public: {
      case_id: 'CASE-003',
      mode: 'observation',
      brief:
        'Three studio portraits, almost indistinguishable—micro-brushwork and a loan stamp could reveal the legitimate panel.',
      style_period: '19th-century salon portrait',
      images: [svgDataUri('Portrait — A', '#fb7185'), svgDataUri('Portrait — B', '#ef4444'), svgDataUri('Portrait — C', '#f97316')],
      signature_crops: [mini('A sig'), mini('B sig'), mini('C sig')],
      metadata: [
        {
          title: 'Salon Portrait A',
          year: '1863',
          medium: 'Oil on panel',
          catalog_ref: 'ARCH-1863-PRT-A',
          ownership_chain: ['Salon registry 1863', 'Private estate 1900'],
          notes: 'Archived registry stamp present.',
        },
        {
          title: 'Salon Portrait B',
          year: '1863',
          medium: 'Oil on panel',
          catalog_ref: 'ARCH-1863-PRT-B',
          ownership_chain: ['For sale 2008', 'Gallery certificate 2010'],
          notes: 'Certificate formatting not period-correct.',
        },
        {
          title: 'Salon Portrait C',
          year: '1863',
          medium: 'Oil on panel',
          catalog_ref: 'ARCH-1863-PRT-C',
          ownership_chain: ['Uncataloged 2017'],
          notes: 'No early transportation receipts.',
        },
      ],
      ledger_summary: 'Multiple chains claim continuity; only one has verifiable archival stamps.',
      timer_seconds: TIMER_SECONDS,
      initial_ip: INITIAL_IP,
      tool_costs: TOOL_COSTS,
      credits: { source: 'Mock Open Access (hackathon placeholder)' },
    },
    solution: {
      answer_index: 0,
      flags_signature: ['Brushwork cadence matches studio sample strokes.'],
      flags_metadata: ['B uses modern certificate layout; C lacks archival record.'],
      flags_financial: ['Only A includes period loan/transport receipts.'],
      explanation:
        'A aligns with recorded salon entry and stamp; B/C have paperwork gaps and anachronisms.',
    },
  },
  {
    public: {
      case_id: 'CASE-004',
      mode: 'knowledge',
      brief:
        'A still life’s paper trail is too clean. Pigment chemistry and invoice stock might betray a recent reconstruction.',
      style_period: 'Dutch still life',
      images: [svgDataUri('Still Life — A', '#22c55e'), svgDataUri('Still Life — B', '#16a34a'), svgDataUri('Still Life — C', '#10b981')],
      signature_crops: [mini('A sig'), mini('B sig'), mini('C sig')],
      metadata: [
        {
          title: 'Vase and Fruit (A)',
          year: '1659',
          medium: 'Oil on panel',
          ink_or_pigment: 'earth pigments; lead-tin yellow detected',
          catalog_ref: 'DSL-1659-VF-A',
          ownership_chain: ['Guild record 1660', 'Estate 1710'],
          notes: 'Ground layer microscopy consistent with the school.',
        },
        {
          title: 'Vase and Fruit (B)',
          year: '1659',
          medium: 'Oil on panel',
          ink_or_pigment: 'earth pigments; barium sulfate filler',
          catalog_ref: 'DSL-1659-VF-B',
          ownership_chain: ['Auction 2012'],
          notes: 'Modern filler presence suggests recent restoration or copy.',
        },
        {
          title: 'Vase and Fruit (C)',
          year: '1659',
          medium: 'Oil on panel',
          catalog_ref: 'DSL-1659-VF-C',
          ownership_chain: ['Private 1998'],
          notes: 'Invoice paper watermark style from 1980s.',
        },
      ],
      ledger_summary: 'Only one lineage reaches guild records; others rely on modern trade documentation.',
      timer_seconds: TIMER_SECONDS,
      initial_ip: INITIAL_IP,
      tool_costs: TOOL_COSTS,
      credits: { source: 'Mock Open Access (hackathon placeholder)' },
    },
    solution: {
      answer_index: 0,
      flags_signature: ['Under-drawing and signature scumble align with period hand.'],
      flags_metadata: ['B shows modern filler; C invoice watermark anachronistic.'],
      flags_financial: ['Guild record + early estate transfer only present for A.'],
      explanation:
        'A’s material analysis and paper trail are period-sound; B/C show modern materials and late-stage paperwork.',
    },
  },
  {
    public: {
      case_id: 'CASE-005',
      mode: 'observation',
      brief:
        'Three architectural studies surfaced together; subtle pen pressure and date stamps hint which sheet truly left the original atelier.',
      style_period: 'Early 20th-century architectural study',
      images: [svgDataUri('Study — A', '#a3a3a3'), svgDataUri('Study — B', '#737373'), svgDataUri('Study — C', '#525252')],
      signature_crops: [mini('A mark'), mini('B mark'), mini('C mark')],
      metadata: [
        {
          title: 'Atelier Study A',
          year: '1907',
          medium: 'Ink and wash on paper',
          catalog_ref: 'AT-1907-STUDY-A',
          ownership_chain: ['Atelier folio 1907', 'School archive 1931'],
          notes: 'Blind stamp impression depth matches other sheets.',
        },
        {
          title: 'Atelier Study B',
          year: '1907',
          medium: 'Ink and wash on paper',
          catalog_ref: 'AT-1907-STUDY-B',
          ownership_chain: ['Dealer 2006'],
          notes: 'Blind stamp placement inconsistent; paper sizing slightly off.',
        },
        {
          title: 'Atelier Study C',
          year: '1907',
          medium: 'Ink and wash on paper',
          catalog_ref: 'AT-1907-STUDY-C',
          ownership_chain: ['Private 2019'],
          notes: 'Ink UV response doesn’t match period iron-gall profile.',
        },
      ],
      ledger_summary:
        'Only one sheet shows the atelier’s characteristic blind-stamp depth and sequence of custody.',
      timer_seconds: TIMER_SECONDS,
      initial_ip: INITIAL_IP,
      tool_costs: TOOL_COSTS,
      credits: { source: 'Mock Open Access (hackathon placeholder)' },
    },
    solution: {
      answer_index: 0,
      flags_signature: ['Pen lift and pressure cadence align with verified sheets.'],
      flags_metadata: ['B/C show stamp/ink anomalies.'],
      flags_financial: ['A ties to school archive ledger entries.'],
      explanation:
        'The atelier sheet (A) matches stamp depth and ink profile; B/C diverge in stamp placement and chemistry.',
    },
  },
];

// ============================================================================
// LIGHTWEIGHT MOCK ENGINE (in-memory sessions & leaderboard)
// ============================================================================

type SessionDoc = {
  session_id: string;
  user_id: string;
  username: string;
  case_id: string;
  ip_remaining: number;
  expires_at: number; // epoch ms
  status: 'active' | 'finished' | 'expired';
  actions: any[];
};
const sessions = new Map<string, SessionDoc>();
const playsByCase = new Map<string, Map<string, { user_id: string; username: string; score: number; ts: number }>>();

function uidFromHeaders(req: Request): { user_id: string; username: string } {
  const username = (req.headers['x-reddit-user'] as string) || 'anon';
  const user_id = (req.headers['x-reddit-id'] as string) || username;
  return { user_id, username };
}
function todayId(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
function pickCaseForToday(): { public: PublicCase; solution: CaseSolution } {
  const idx = (parseInt(todayId().slice(-2), 10) || 0) % MOCK_CASES.length;
  return MOCK_CASES[idx];
}
function newSession(user_id: string, username: string, case_id: string): SessionDoc {
  const session_id = cryptoRandomId();
  const expires_at = Date.now() + TIMER_SECONDS * 1000;
  const doc: SessionDoc = {
    session_id,
    user_id,
    username,
    case_id,
    ip_remaining: INITIAL_IP,
    expires_at,
    status: 'active',
    actions: [],
  };
  sessions.set(session_id, doc);
  return doc;
}
function cryptoRandomId(): string {
  // not cryptographically perfect here, good enough for demo
  return 'sess_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
function getSessionFromReq(req: Request): { session?: SessionDoc; error?: string } {
  const sid = (req.headers['x-session-id'] as string) || '';
  if (!sid) return { error: 'Missing X-Session-Id header.' };
  const s = sessions.get(sid);
  if (!s) return { error: 'Invalid or inactive session.' };
  if (Date.now() > s.expires_at) {
    s.status = 'expired';
    return { error: 'Session expired.' };
  }
  if (s.status !== 'active') return { error: 'Invalid or inactive session.' };
  return { session: s };
}
function spendIP(s: SessionDoc, cost: number, action: any): { error?: string } {
  if (s.ip_remaining < cost) return { error: 'Not enough Investigation Points.' };
  s.ip_remaining -= cost;
  s.actions.push({ ...action, ts: Date.now() });
  return {};
}
function score(correct: boolean, s: SessionDoc): { score: number; seconds_left: number; ip_left: number } {
  const seconds_left = Math.max(0, Math.floor((s.expires_at - Date.now()) / 1000));
  const time_bonus = Math.ceil(seconds_left / 10);
  const ip_bonus = s.ip_remaining * 2;
  const base = correct ? 100 : 0;
  const penalty = correct ? 0 : 40;
  const value = Math.max(0, base + time_bonus + ip_bonus - penalty);
  return { score: value, seconds_left, ip_left: s.ip_remaining };
}
function upsertLeaderboard(case_id: string, row: { user_id: string; username: string; score: number }) {
  let map = playsByCase.get(case_id);
  if (!map) {
    map = new Map();
    playsByCase.set(case_id, map);
  }
  map.set(row.user_id, { ...row, ts: Date.now() });
}

// ============================================================================
// PROXY router → Hugging Face Flask server (with automatic mock fallback)
// ============================================================================
const proxyRouter = express.Router();
const HF_BASE_URL = 'https://rairo-dev-stroke.hf.space';
const USE_MOCK = process.env.USE_MOCK === '1';

async function makeHFRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  data?: unknown,
  headers: Record<string, string> = {}
) {
  const url = `${HF_BASE_URL}${endpoint}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DevvitStrokeApp/1.0',
      ...headers,
    },
    body: method === 'POST' ? JSON.stringify(data ?? {}) : undefined,
  };
  console.log(`[PROXY] ${method} ${url}`);
  try {
    const resp = await fetch(url, init);
    const text = await resp.text();
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`);
    return text ? JSON.parse(text) : {};
  } catch (err) {
    console.warn(`[PROXY] Upstream failed (${endpoint}).`, err);
    throw err;
  }
}

// ---- Health (falls back to local OK if upstream fails)
proxyRouter.get('/health', async (_req: Request, res: Response) => {
  if (USE_MOCK) return res.json({ ok: true, source: 'mock', time: new Date().toISOString() });
  try {
    const healthData = await makeHFRequest('/health', 'GET');
    res.json(healthData);
  } catch {
    res.json({ ok: true, source: 'mock', time: new Date().toISOString() });
  }
});

// ---- Start today’s case
proxyRouter.post('/cases/today/start', async (req: Request, res: Response) => {
  const { user_id, username } = uidFromHeaders(req);
  if (!USE_MOCK) {
    try {
      const headers: Record<string, string> = {};
      if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
      if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);
      const caseData = await makeHFRequest('/cases/today/start', 'POST', req.body, headers);
      return res.json(caseData);
    } catch {
      // fall through to mock
    }
  }
  const pick = pickCaseForToday();
  const s = newSession(user_id, username, pick.public.case_id);
  return res.json({ session_id: s.session_id, case: pick.public });
});

// ---- Tools (signature / metadata / financial)
proxyRouter.post('/cases/:caseId/tool/signature', async (req: Request, res: Response) => {
  if (!USE_MOCK) {
    try {
      const { caseId } = req.params;
      const headers: Record<string, string> = {};
      if (req.headers['x-session-id']) headers['X-Session-Id'] = String(req.headers['x-session-id']);
      if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
      if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);
      const toolData = await makeHFRequest(`/cases/${caseId}/tool/signature`, 'POST', req.body, headers);
      return res.json(toolData);
    } catch {
      // fall through
    }
  }
  // mock
  const { session, error } = getSessionFromReq(req);
  if (error) return res.status(400).json({ error });
  if (session!.case_id !== req.params.caseId) return res.status(400).json({ error: 'Session/case mismatch.' });
  const body = (req.body || {}) as { image_index?: number };
  const idx = [0, 1, 2].includes(Number(body.image_index)) ? Number(body.image_index) : 0;

  const doc = MOCK_CASES.find((c) => c.public.case_id === session!.case_id)!;
  const cost = TOOL_COSTS.signature;
  const sp = spendIP(session!, cost, { type: 'tool_signature', image_index: idx });
  if (sp.error) return res.status(400).json({ error: sp.error });
  const hint = doc.public.mode === 'observation' ? 'Examine baseline alignment and stroke overlap.' : '';
  return res.json({ crop_url: doc.public.signature_crops[idx], hint, ip_remaining: session!.ip_remaining });
});

proxyRouter.post('/cases/:caseId/tool/metadata', async (req: Request, res: Response) => {
  if (!USE_MOCK) {
    try {
      const { caseId } = req.params;
      const headers: Record<string, string> = {};
      if (req.headers['x-session-id']) headers['X-Session-Id'] = String(req.headers['x-session-id']);
      if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
      if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);
      const toolData = await makeHFRequest(`/cases/${caseId}/tool/metadata`, 'POST', req.body, headers);
      return res.json(toolData);
    } catch {
      // fall through
    }
  }
  const { session, error } = getSessionFromReq(req);
  if (error) return res.status(400).json({ error });
  if (session!.case_id !== req.params.caseId) return res.status(400).json({ error: 'Session/case mismatch.' });

  const doc = MOCK_CASES.find((c) => c.public.case_id === session!.case_id)!;
  const cost = TOOL_COSTS.metadata;
  const sp = spendIP(session!, cost, { type: 'tool_metadata' });
  if (sp.error) return res.status(400).json({ error: sp.error });

  const flag = doc.solution.flags_metadata[0] || 'Check chronology, chemistry, and institutional formats.';
  return res.json({ flags: [flag], ip_remaining: session!.ip_remaining });
});

proxyRouter.post('/cases/:caseId/tool/financial', async (req: Request, res: Response) => {
  if (!USE_MOCK) {
    try {
      const { caseId } = req.params;
      const headers: Record<string, string> = {};
      if (req.headers['x-session-id']) headers['X-Session-Id'] = String(req.headers['x-session-id']);
      if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
      if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);
      const toolData = await makeHFRequest(`/cases/${caseId}/tool/financial`, 'POST', req.body, headers);
      return res.json(toolData);
    } catch {
      // fall through
    }
  }
  const { session, error } = getSessionFromReq(req);
  if (error) return res.status(400).json({ error });
  if (session!.case_id !== req.params.caseId) return res.status(400).json({ error: 'Session/case mismatch.' });

  const doc = MOCK_CASES.find((c) => c.public.case_id === session!.case_id)!;
  const cost = TOOL_COSTS.financial;
  const sp = spendIP(session!, cost, { type: 'tool_financial' });
  if (sp.error) return res.status(400).json({ error: sp.error });

  const flag = doc.solution.flags_financial[0] || 'Follow currency, jurisdiction, and payment method timelines.';
  return res.json({ flags: [flag], ip_remaining: session!.ip_remaining });
});

// ---- Guess
proxyRouter.post('/cases/:caseId/guess', async (req: Request, res: Response) => {
  if (!USE_MOCK) {
    try {
      const { caseId } = req.params;
      const headers: Record<string, string> = {};
      if (req.headers['x-session-id']) headers['X-Session-Id'] = String(req.headers['x-session-id']);
      if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
      if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);
      const guessData = await makeHFRequest(`/cases/${caseId}/guess`, 'POST', req.body, headers);
      return res.json(guessData);
    } catch {
      // fall through
    }
  }
  const { session, error } = getSessionFromReq(req);
  if (error) return res.status(400).json({ error });
  if (session!.case_id !== req.params.caseId) return res.status(400).json({ error: 'Session/case mismatch.' });

  const doc = MOCK_CASES.find((c) => c.public.case_id === session!.case_id)!;
  const body = (req.body || {}) as { image_index?: number; rationale?: string };
  const guess_index = [0, 1, 2].includes(Number(body.image_index)) ? Number(body.image_index) : -1;
  if (guess_index === -1) return res.status(400).json({ error: 'image_index must be 0,1,2' });

  session!.status = 'finished';
  const correct = guess_index === doc.solution.answer_index;
  const summary = score(correct, session!);

  // upsert leaderboard
  upsertLeaderboard(session!.case_id, {
    user_id: session!.user_id,
    username: session!.username,
    score: summary.score,
  });

  const reveal = {
    authentic_index: doc.solution.answer_index,
    explanation: doc.solution.explanation,
    flags_signature: doc.solution.flags_signature,
    flags_metadata: doc.solution.flags_metadata,
    flags_financial: doc.solution.flags_financial,
  };

  return res.json({
    correct,
    score: summary.score,
    timeLeft: summary.seconds_left,
    ipLeft: summary.ip_left,
    reveal,
  });
});

// ---- Leaderboard
proxyRouter.get('/leaderboard/daily', async (req: Request, res: Response) => {
  if (!USE_MOCK) {
    try {
      const headers: Record<string, string> = {};
      if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
      if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);
      const leaderboardData = await makeHFRequest('/leaderboard/daily', 'GET', undefined, headers);
      return res.json(leaderboardData);
    } catch {
      // fall through
    }
  }

  const case_id = pickCaseForToday().public.case_id;
  const map = playsByCase.get(case_id) || new Map();
  const top = Array.from(map.values()).sort((a, b) => b.score - a.score).slice(0, 50);
  const { user_id } = uidFromHeaders(req);
  const meRow = map.get(user_id);
  const rank = top.findIndex((r) => r.user_id === user_id);
  return res.json({
    case_id,
    top,
    me: { score: meRow?.score, rank: rank === -1 ? null : rank + 1 },
  });
});

// ---- Debug connectivity
proxyRouter.get('/debug', async (_req: Request, res: Response) => {
  if (USE_MOCK) {
    return res.json({
      success: true,
      status: 200,
      statusText: 'OK',
      body: JSON.stringify({ ok: true, mock: true }),
      timestamp: new Date().toISOString(),
    });
  }
  try {
    const r = await fetch(`${HF_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'User-Agent': 'DevvitStrokeApp/1.0' },
    });
    const body = await r.text();
    res.json({
      success: r.ok,
      status: r.status,
      statusText: r.statusText,
      body,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ---- Admin passthroughs (keep, but they will no-op when USE_MOCK=1 unless upstream works)
proxyRouter.post('/admin/bootstrap-now', async (req: Request, res: Response) => {
  if (USE_MOCK) return res.json({ ok: true, source: 'mock' });
  try {
    const bootstrapData = await makeHFRequest('/admin/bootstrap-now', 'POST', req.body);
    res.json(bootstrapData);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Bootstrap failed', error: error?.message || 'Unknown error' });
  }
});

proxyRouter.get('/admin/diagnostics', async (_req: Request, res: Response) => {
  if (USE_MOCK) return res.json({ ok: true, source: 'mock' });
  try {
    const diagnosticsData = await makeHFRequest('/admin/diagnostics', 'GET');
    res.json(diagnosticsData);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Diagnostics failed', error: error?.message || 'Unknown error' });
  }
});

proxyRouter.get('/admin/ia-pool/stats', async (req: Request, res: Response) => {
  if (USE_MOCK) return res.json({ ok: true, source: 'mock', pool_size: 0, cached: 0 });
  try {
    const headers: Record<string, string> = {};
    const adminKey = req.headers['x-admin-key'];
    if (adminKey) headers['X-Admin-Key'] = String(adminKey);
    const statsData = await makeHFRequest('/admin/ia-pool/stats', 'GET', undefined, headers);
    res.json(statsData);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'IA pool stats failed', error: error?.message || 'Unknown error' });
  }
});

proxyRouter.post('/admin/ingest-ia', async (req: Request, res: Response) => {
  if (USE_MOCK) return res.json({ ok: true, source: 'mock', ingested: 0 });
  try {
    const headers: Record<string, string> = {};
    const adminKey = req.headers['x-admin-key'];
    if (adminKey) headers['X-Admin-Key'] = String(adminKey);
    const ingestData = await makeHFRequest('/admin/ingest-ia', 'POST', req.body, headers);
    res.json(ingestData);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'IA ingest failed', error: error?.message || 'Unknown error' });
  }
});

proxyRouter.post('/admin/cache-ia', async (req: Request, res: Response) => {
  if (USE_MOCK) return res.json({ ok: true, source: 'mock', stored: 0 });
  try {
    const headers: Record<string, string> = {};
    const adminKey = req.headers['x-admin-key'];
    if (adminKey) headers['X-Admin-Key'] = String(adminKey);
    const cacheData = await makeHFRequest('/admin/cache-ia', 'POST', req.body, headers);
    res.json(cacheData);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'IA cache failed', error: error?.message || 'Unknown error' });
  }
});

proxyRouter.post('/admin/generate-today', async (req: Request, res: Response) => {
  if (USE_MOCK) return res.json({ ok: true, source: 'mock', generated: false });
  try {
    const headers: Record<string, string> = {};
    const adminKey = req.headers['x-admin-key'];
    if (adminKey) headers['X-Admin-Key'] = String(adminKey);
    const generateData = await makeHFRequest('/admin/generate-today', 'POST', req.body, headers);
    res.json(generateData);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Generate today failed', error: error?.message || 'Unknown error' });
  }
});

// Mount the proxy router at /api/proxy
app.use('/api/proxy', proxyRouter);

// Root health
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'devvit-stroke-server',
    timestamp: new Date().toISOString(),
    hf_base_url: HF_BASE_URL,
    mock_enabled: USE_MOCK,
  });
});

// ----------------------------------------------------------------------------
// Server start
// ----------------------------------------------------------------------------
const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err instanceof Error ? err.stack : String(err)}`));
server.listen(port);

console.log(`Server starting on port ${port}`);
console.log(`Proxying to HF server: ${HF_BASE_URL} (USE_MOCK=${USE_MOCK ? '1' : '0'})`);

export default app;
