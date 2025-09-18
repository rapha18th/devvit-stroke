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
    // Your original code
  }
);
// ... other original routes ...

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

// ---- CORRECTED PROXY ROUTER ----
const proxyRouter = express.Router();
const API_BASE = "https://rairo-dev-stroke.hf.space";

/**
 * A helper function to securely forward requests to the external Hugging Face API.
 */
async function forwardRequest(req, res, path, options = {}) {
  const url = `${API_BASE}${path}`;
  console.log(`[PROXY] Forwarding ${req.method} to ${url}`);

  try {
    const user = await reddit.getCurrentUser();
    const userId = user?.id ?? `anon-${context.requestId}`;
    const userName = user?.name ?? 'anonymous';

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Reddit-Id': userId,
        'X-Reddit-User': userName,
        ...(req.headers['x-session-id'] && { 'X-Session-Id': req.headers['x-session-id'] }),
      },
      ...options,
    });

    const responseData = await response.json();
    console.log('[PROXY] Received response from upstream:', JSON.stringify(responseData));

    if (!response.ok) {
      console.error(`[PROXY] Error from upstream: ${response.status}`, responseData);
      return res.status(response.status).json(responseData);
    }

    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('[PROXY] Failed to forward request:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
        error: 'Proxy request failed',
        details: errorMessage,
    });
  }
}

// Health check endpoint
proxyRouter.get('/health', (req, res) => {
  forwardRequest(req, res, '/health');
});

// Start case endpoint
proxyRouter.post('/cases/today/start', (req, res) => {
  forwardRequest(req, res, '/cases/today/start', {
    body: JSON.stringify(req.body),
  });
});

// Signature tool endpoint
proxyRouter.post('/cases/:caseId/tool/signature', (req, res) => {
  const { caseId } = req.params;
  forwardRequest(req, res, `/cases/${encodeURIComponent(caseId)}/tool/signature`, {
    body: JSON.stringify(req.body),
  });
});

// Mount the proxy router
app.use('/api/proxy', proxyRouter);

// ---- SERVER STARTUP ----
const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);

console.log(`Server starting on port ${port}`);
