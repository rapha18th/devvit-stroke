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
// Your existing application logic
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


// ---- NEW PROXY ROUTER ----
const proxyRouter = express.Router();
const API_BASE = "https://rairo-dev-stroke.hf.space";

/**
 * A helper function to securely forward requests to the external Hugging Face API.
 */
async function forwardRequest(req, res, path, options = {}) {
  const url = `${API_BASE}${path}`;
  console.log(`[PROXY] Forwarding ${req.method} to ${url}`);

  try {
    // Get the current user from the secure server context.
    const user = await reddit.getCurrentUser();
    const userId = user?.id ?? `anon-${context.requestId}`;
    const userName = user?.name ?? 'anonymous';

    // Make the external request using fetch.
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Reddit-Id': userId,
        'X-Reddit-User': userName,
        // Forward the session ID header if the client sent it.
        ...(req.headers['x-session-id'] && { 'X-Session-Id': req.headers['x-session-id'] }),
      },
      ...options,
    });

    const responseData = await response.json();

    // Handle non-ok responses from the upstream server.
    if (!response.ok) {
      console.error(`[PROXY] Error from upstream: ${response.status}`, responseData);
      return res.status(response.status).json(responseData);
    }

    // Send the successful response back to the client.
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('[PROXY] Failed to forward request:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
}

// Define proxy endpoints that mirror the external API structure.
proxyRouter.get('/health', (req, res) => {
  forwardRequest(req, res, '/health');
});

proxyRouter.post('/cases/today/start', (req, res) => {
  forwardRequest(req, res, '/cases/today/start', {
    body: JSON.stringify(req.body),
  });
});

proxyRouter.post('/cases/:caseId/tool/signature', (req, res) => {
  const { caseId } = req.params;
  forwardRequest(req, res, `/cases/${encodeURIComponent(caseId)}/tool/signature`, {
    body: JSON.stringify(req.body),
  });
});

// Mount the new proxy router at the /api/proxy path.
app.use('/api/proxy', proxyRouter);


// ---- SERVER STARTUP ----
const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
