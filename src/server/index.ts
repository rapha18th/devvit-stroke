import express from 'express';
import { reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

// ---- ORIGINAL ROUTER ----
const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    // This is your original code
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    // This is your original code
  }
);

router.post<{ postId:string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    // This is your original code
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
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
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
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Use the main router
app.use(router);

// ---- PROXY ROUTER WITH REAL HF API CALLS ----
const proxyRouter = express.Router();

// Base URL for your Hugging Face server
const HF_BASE_URL = 'https://rairo-dev-stroke.hf.space';

// Helper function to make requests to HF server
async function makeHFRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any, headers?: Record<string, string>) {
  const url = `${HF_BASE_URL}${endpoint}`;
  
  try {
    const requestOptions: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DevvitStrokeApp/1.0',
        ...headers
      }
    };

    if (method === 'POST' && data) {
      requestOptions.body = JSON.stringify(data);
    }

    console.log(`[PROXY] Making ${method} request to: ${url}`);
    if (data) {
      console.log(`[PROXY] Request body:`, JSON.stringify(data, null, 2));
    }
    
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PROXY] HTTP ${response.status} error from ${endpoint}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log(`[PROXY] Success response from ${endpoint}:`, JSON.stringify(responseData, null, 2));
    
    return responseData;
  } catch (error) {
    console.error(`[PROXY] Error calling ${endpoint}:`, error);
    throw error;
  }
}

// Health check - proxy to HF server
proxyRouter.get('/health', async (req, res) => {
  try {
    console.log('[PROXY] Health check requested');
    const healthData = await makeHFRequest('/health');
    res.json(healthData);
  } catch (error) {
    console.error('[PROXY] Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      service: 'devvit-stroke-proxy'
    });
  }
});

// Start today's case - proxy to HF server
proxyRouter.post('/cases/today/start', async (req, res) => {
  try {
    // Forward Reddit user headers to HF server
    const headers: Record<string, string> = {};
    if (req.headers['x-reddit-user']) {
      headers['X-Reddit-User'] = req.headers['x-reddit-user'] as string;
    }
    if (req.headers['x-reddit-id']) {
      headers['X-Reddit-Id'] = req.headers['x-reddit-id'] as string;
    }

    console.log('[PROXY] Starting case with headers:', headers);
    console.log('[PROXY] Request body:', req.body);
    
    const caseData = await makeHFRequest('/cases/today/start', 'POST', req.body, headers);
    res.json(caseData);
  } catch (error) {
    console.error('[PROXY] Case start failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start case',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Signature tool - proxy to HF server
proxyRouter.post('/cases/:caseId/tool/signature', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Forward session header if present
    const headers: Record<string, string> = {};
    if (req.headers['x-session-id']) {
      headers['X-Session-Id'] = req.headers['x-session-id'] as string;
    }
    if (req.headers['x-reddit-user']) {
      headers['X-Reddit-User'] = req.headers['x-reddit-user'] as string;
    }
    if (req.headers['x-reddit-id']) {
      headers['X-Reddit-Id'] = req.headers['x-reddit-id'] as string;
    }

    console.log(`[PROXY] Signature tool for case: ${caseId}`, req.body);
    
    const toolData = await makeHFRequest(
      `/cases/${caseId}/tool/signature`, 
      'POST', 
      req.body, 
      headers
    );
    res.json(toolData);
  } catch (error) {
    console.error('[PROXY] Signature tool failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Signature tool failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      caseId: req.params.caseId
    });
  }
});

// Metadata tool - proxy to HF server
proxyRouter.post('/cases/:caseId/tool/metadata', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const headers: Record<string, string> = {};
    if (req.headers['x-session-id']) {
      headers['X-Session-Id'] = req.headers['x-session-id'] as string;
    }
    if (req.headers['x-reddit-user']) {
      headers['X-Reddit-User'] = req.headers['x-reddit-user'] as string;
    }
    if (req.headers['x-reddit-id']) {
      headers['X-Reddit-Id'] = req.headers['x-reddit-id'] as string;
    }

    console.log(`[PROXY] Metadata tool for case: ${caseId}`, req.body);
    
    const toolData = await makeHFRequest(
      `/cases/${caseId}/tool/metadata`, 
      'POST', 
      req.body, 
      headers
    );
    res.json(toolData);
  } catch (error) {
    console.error('[PROXY] Metadata tool failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Metadata tool failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      caseId: req.params.caseId
    });
  }
});

// Financial tool - proxy to HF server
proxyRouter.post('/cases/:caseId/tool/financial', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const headers: Record<string, string> = {};
    if (req.headers['x-session-id']) {
      headers['X-Session-Id'] = req.headers['x-session-id'] as string;
    }
    if (req.headers['x-reddit-user']) {
      headers['X-Reddit-User'] = req.headers['x-reddit-user'] as string;
    }
    if (req.headers['x-reddit-id']) {
      headers['X-Reddit-Id'] = req.headers['x-reddit-id'] as string;
    }

    console.log(`[PROXY] Financial tool for case: ${caseId}`, req.body);
    
    const toolData = await makeHFRequest(
      `/cases/${caseId}/tool/financial`, 
      'POST', 
      req.body, 
      headers
    );
    res.json(toolData);
  } catch (error) {
    console.error('[PROXY] Financial tool failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Financial tool failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      caseId: req.params.caseId
    });
  }
});

// Submit guess - proxy to HF server
proxyRouter.post('/cases/:caseId/guess', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const headers: Record<string, string> = {};
    if (req.headers['x-session-id']) {
      headers['X-Session-Id'] = req.headers['x-session-id'] as string;
    }
    if (req.headers['x-reddit-user']) {
      headers['X-Reddit-User'] = req.headers['x-reddit-user'] as string;
    }
    if (req.headers['x-reddit-id']) {
      headers['X-Reddit-Id'] = req.headers['x-reddit-id'] as string;
    }

    console.log(`[PROXY] Submitting guess for case: ${caseId}`, req.body);
    
    const guessData = await makeHFRequest(
      `/cases/${caseId}/guess`, 
      'POST', 
      req.body, 
      headers
    );
    res.json(guessData);
  } catch (error) {
    console.error('[PROXY] Guess submission failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Guess submission failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      caseId: req.params.caseId
    });
  }
});

// Daily leaderboard - proxy to HF server
proxyRouter.get('/leaderboard/daily', async (req, res) => {
  try {
    const headers: Record<string, string> = {};
    if (req.headers['x-reddit-user']) {
      headers['X-Reddit-User'] = req.headers['x-reddit-user'] as string;
    }
    if (req.headers['x-reddit-id']) {
      headers['X-Reddit-Id'] = req.headers['x-reddit-id'] as string;
    }

    console.log('[PROXY] Fetching daily leaderboard with headers:', headers);
    
    const leaderboardData = await makeHFRequest('/leaderboard/daily', 'GET', undefined, headers);
    res.json(leaderboardData);
  } catch (error) {
    console.error('[PROXY] Leaderboard fetch failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch leaderboard',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint to verify the proxy is working
proxyRouter.get('/test', async (req, res) => {
  try {
    // Test connection to HF server
    console.log('[PROXY] Testing connection to HF server');
    const healthData = await makeHFRequest('/health');
    res.json({
      message: 'Proxy router is working and connected to HF server!',
      timestamp: new Date().toISOString(),
      hf_health: healthData,
      hf_base_url: HF_BASE_URL,
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path
    });
  } catch (error) {
    console.error('[PROXY] HF connection test failed:', error);
    res.json({
      message: 'Proxy router is working but HF connection failed',
      timestamp: new Date().toISOString(),
      hf_base_url: HF_BASE_URL,
      error: error instanceof Error ? error.message : 'Unknown error',
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path
    });
  }
});

// Admin endpoints (if you need them proxied)
proxyRouter.post('/admin/bootstrap-now', async (req, res) => {
  try {
    console.log('[PROXY] Admin bootstrap request', req.body);
    const bootstrapData = await makeHFRequest('/admin/bootstrap-now', 'POST', req.body);
    res.json(bootstrapData);
  } catch (error) {
    console.error('[PROXY] Bootstrap failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Bootstrap failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

proxyRouter.get('/admin/diagnostics', async (req, res) => {
  try {
    console.log('[PROXY] Admin diagnostics request');
    const diagnosticsData = await makeHFRequest('/admin/diagnostics', 'GET');
    res.json(diagnosticsData);
  } catch (error) {
    console.error('[PROXY] Diagnostics failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Diagnostics failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

proxyRouter.get('/admin/ia-pool/stats', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const headers: Record<string, string> = {};
    if (adminKey) {
      headers['X-Admin-Key'] = adminKey as string;
    }
    
    console.log('[PROXY] Admin IA pool stats request');
    const statsData = await makeHFRequest('/admin/ia-pool/stats', 'GET', undefined, headers);
    res.json(statsData);
  } catch (error) {
    console.error('[PROXY] IA pool stats failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'IA pool stats failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

proxyRouter.post('/admin/ingest-ia', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const headers: Record<string, string> = {};
    if (adminKey) {
      headers['X-Admin-Key'] = adminKey as string;
    }
    
    console.log('[PROXY] Admin IA ingest request', req.body);
    const ingestData = await makeHFRequest('/admin/ingest-ia', 'POST', req.body, headers);
    res.json(ingestData);
  } catch (error) {
    console.error('[PROXY] IA ingest failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'IA ingest failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

proxyRouter.post('/admin/cache-ia', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const headers: Record<string, string> = {};
    if (adminKey) {
      headers['X-Admin-Key'] = adminKey as string;
    }
    
    console.log('[PROXY] Admin IA cache request', req.body);
    const cacheData = await makeHFRequest('/admin/cache-ia', 'POST', req.body, headers);
    res.json(cacheData);
  } catch (error) {
    console.error('[PROXY] IA cache failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'IA cache failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

proxyRouter.post('/admin/generate-today', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const headers: Record<string, string> = {};
    if (adminKey) {
      headers['X-Admin-Key'] = adminKey as string;
    }
    
    console.log('[PROXY] Admin generate today request');
    const generateData = await makeHFRequest('/admin/generate-today', 'POST', req.body, headers);
    res.json(generateData);
  } catch (error) {
    console.error('[PROXY] Generate today failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Generate today failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Mount the proxy router
app.use('/api/proxy', proxyRouter);

// Add a root health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'devvit-stroke-server',
    timestamp: new Date().toISOString(),
    hf_base_url: HF_BASE_URL
  });
});

// ---- SERVER STARTUP ----
const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);

console.log(`Server starting on port ${port}`);
console.log(`Proxying to HF server: ${HF_BASE_URL}`);

export default app;
