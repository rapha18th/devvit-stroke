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
// Original router (kept so your existing UI doesn’t break)
// Implement minimal OK responses if your original handlers aren’t present yet.
// ----------------------------------------------------------------------------
const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    // TODO: put your original logic back here if needed
    res.json({ status: 'success', value: { count: 0 } } as any);
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    // TODO: put your original logic back here if needed
    res.json({ status: 'success', value: { count: 1 } } as any);
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    // TODO: put your original logic back here if needed
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

// ----------------------------------------------------------------------------
// PROXY router → Hugging Face Flask server
// Refactored to use global `fetch()` (allowed by devvit.json "http.domains").
// ----------------------------------------------------------------------------
const proxyRouter = express.Router();

// Base URL for your Hugging Face server
const HF_BASE_URL = 'https://rairo-dev-stroke.hf.space';

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
  };

  if (method === 'POST') {
    init.body = data ? JSON.stringify(data) : '{}';
  }

  console.log(`[PROXY] ${method} ${url}`);
  if (init.body) console.log(`[PROXY] body: ${init.body}`);

  const resp = await fetch(url, init);
  const text = await resp.text(); // read once

  if (!resp.ok) {
    console.error(`[PROXY] HTTP ${resp.status} ${resp.statusText} from ${endpoint}: ${text}`);
    throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`);
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.error('[PROXY] JSON parse error:', e, 'raw:', text);
    throw new Error('Upstream returned non-JSON');
  }
}

// ---- Health
proxyRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    console.log('[PROXY] Health check requested');
    const healthData = await makeHFRequest('/health', 'GET');
    res.json(healthData);
  } catch (error: any) {
    console.error('[PROXY] Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      service: 'devvit-stroke-proxy',
    });
  }
});

// ---- Start today’s case
proxyRouter.post('/cases/today/start', async (req: Request, res: Response) => {
  try {
    const headers: Record<string, string> = {};
    if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
    if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);

    console.log('[PROXY] Starting case with headers:', headers);
    console.log('[PROXY] Request body:', req.body);

    const caseData = await makeHFRequest('/cases/today/start', 'POST', req.body, headers);
    res.json(caseData);
  } catch (error: any) {
    console.error('[PROXY] Case start failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start case',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ---- Tools (signature / metadata / financial)
proxyRouter.post('/cases/:caseId/tool/signature', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const headers: Record<string, string> = {};
    if (req.headers['x-session-id']) headers['X-Session-Id'] = String(req.headers['x-session-id']);
    if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
    if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);

    console.log(`[PROXY] Signature tool for case: ${caseId}`, req.body);
    const toolData = await makeHFRequest(`/cases/${caseId}/tool/signature`, 'POST', req.body, headers);
    res.json(toolData);
  } catch (error: any) {
    console.error('[PROXY] Signature tool failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Signature tool failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      caseId: req.params.caseId,
    });
  }
});

proxyRouter.post('/cases/:caseId/tool/metadata', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const headers: Record<string, string> = {};
    if (req.headers['x-session-id']) headers['X-Session-Id'] = String(req.headers['x-session-id']);
    if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
    if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);

    console.log(`[PROXY] Metadata tool for case: ${caseId}`, req.body);
    const toolData = await makeHFRequest(`/cases/${caseId}/tool/metadata`, 'POST', req.body, headers);
    res.json(toolData);
  } catch (error: any) {
    console.error('[PROXY] Metadata tool failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Metadata tool failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      caseId: req.params.caseId,
    });
  }
});

proxyRouter.post('/cases/:caseId/tool/financial', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const headers: Record<string, string> = {};
    if (req.headers['x-session-id']) headers['X-Session-Id'] = String(req.headers['x-session-id']);
    if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
    if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);

    console.log(`[PROXY] Financial tool for case: ${caseId}`, req.body);
    const toolData = await makeHFRequest(`/cases/${caseId}/tool/financial`, 'POST', req.body, headers);
    res.json(toolData);
  } catch (error: any) {
    console.error('[PROXY] Financial tool failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Financial tool failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      caseId: req.params.caseId,
    });
  }
});

// ---- Guess
proxyRouter.post('/cases/:caseId/guess', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const headers: Record<string, string> = {};
    if (req.headers['x-session-id']) headers['X-Session-Id'] = String(req.headers['x-session-id']);
    if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
    if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);

    console.log(`[PROXY] Submitting guess for case: ${caseId}`, req.body);
    const guessData = await makeHFRequest(`/cases/${caseId}/guess`, 'POST', req.body, headers);
    res.json(guessData);
  } catch (error: any) {
    console.error('[PROXY] Guess submission failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Guess submission failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      caseId: req.params.caseId,
    });
  }
});

// ---- Leaderboard
proxyRouter.get('/leaderboard/daily', async (req: Request, res: Response) => {
  try {
    const headers: Record<string, string> = {};
    if (req.headers['x-reddit-user']) headers['X-Reddit-User'] = String(req.headers['x-reddit-user']);
    if (req.headers['x-reddit-id']) headers['X-Reddit-Id'] = String(req.headers['x-reddit-id']);

    console.log('[PROXY] Fetching daily leaderboard with headers:', headers);
    const leaderboardData = await makeHFRequest('/leaderboard/daily', 'GET', undefined, headers);
    res.json(leaderboardData);
  } catch (error: any) {
    console.error('[PROXY] Leaderboard fetch failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch leaderboard',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ---- Debug connectivity
proxyRouter.get('/debug', async (_req: Request, res: Response) => {
  try {
    console.log('[DEBUG] Testing basic connectivity to HF server');
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
    console.error('[DEBUG] Test failed:', error);
    res.json({
      success: false,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ---- Admin passthroughs (optional)
proxyRouter.post('/admin/bootstrap-now', async (req: Request, res: Response) => {
  try {
    console.log('[PROXY] Admin bootstrap request', req.body);
    const bootstrapData = await makeHFRequest('/admin/bootstrap-now', 'POST', req.body);
    res.json(bootstrapData);
  } catch (error: any) {
    console.error('[PROXY] Bootstrap failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Bootstrap failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

proxyRouter.get('/admin/diagnostics', async (_req: Request, res: Response) => {
  try {
    console.log('[PROXY] Admin diagnostics request');
    const diagnosticsData = await makeHFRequest('/admin/diagnostics', 'GET');
    res.json(diagnosticsData);
  } catch (error: any) {
    console.error('[PROXY] Diagnostics failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Diagnostics failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

proxyRouter.get('/admin/ia-pool/stats', async (req: Request, res: Response) => {
  try {
    const headers: Record<string, string> = {};
    const adminKey = req.headers['x-admin-key'];
    if (adminKey) headers['X-Admin-Key'] = String(adminKey);
    console.log('[PROXY] Admin IA pool stats request');
    const statsData = await makeHFRequest('/admin/ia-pool/stats', 'GET', undefined, headers);
    res.json(statsData);
  } catch (error: any) {
    console.error('[PROXY] IA pool stats failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'IA pool stats failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

proxyRouter.post('/admin/ingest-ia', async (req: Request, res: Response) => {
  try {
    const headers: Record<string, string> = {};
    const adminKey = req.headers['x-admin-key'];
    if (adminKey) headers['X-Admin-Key'] = String(adminKey);
    console.log('[PROXY] Admin IA ingest request', req.body);
    const ingestData = await makeHFRequest('/admin/ingest-ia', 'POST', req.body, headers);
    res.json(ingestData);
  } catch (error: any) {
    console.error('[PROXY] IA ingest failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'IA ingest failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

proxyRouter.post('/admin/cache-ia', async (req: Request, res: Response) => {
  try {
    const headers: Record<string, string> = {};
    const adminKey = req.headers['x-admin-key'];
    if (adminKey) headers['X-Admin-Key'] = String(adminKey);
    console.log('[PROXY] Admin IA cache request', req.body);
    const cacheData = await makeHFRequest('/admin/cache-ia', 'POST', req.body, headers);
    res.json(cacheData);
  } catch (error: any) {
    console.error('[PROXY] IA cache failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'IA cache failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

proxyRouter.post('/admin/generate-today', async (req: Request, res: Response) => {
  try {
    const headers: Record<string, string> = {};
    const adminKey = req.headers['x-admin-key'];
    if (adminKey) headers['X-Admin-Key'] = String(adminKey);
    console.log('[PROXY] Admin generate today request');
    const generateData = await makeHFRequest('/admin/generate-today', 'POST', req.body, headers);
    res.json(generateData);
  } catch (error: any) {
    console.error('[PROXY] Generate today failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Generate today failed',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
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
console.log(`Proxying to HF server: ${HF_BASE_URL}`);

export default app;
