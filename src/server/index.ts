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

// ---- PROXY ROUTER WITH MOCK RESPONSES ----
const proxyRouter = express.Router();

// Mock responses since external HTTP calls are blocked in Devvit
proxyRouter.get('/health', async (req, res) => {
  console.log('[PROXY] Health check requested');
  
  // Return mock health response
  res.json({
    status: 'ok',
    message: 'Proxy service is running',
    timestamp: new Date().toISOString(),
    service: 'devvit-stroke-proxy'
  });
});

proxyRouter.post('/cases/today/start', async (req, res) => {
  console.log('[PROXY] Case start requested:', req.body);
  
  // Generate a mock case ID and return success response
  const caseId = `case-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  res.json({
    caseId,
    status: 'started',
    message: 'Case started successfully',
    timestamp: new Date().toISOString(),
    sessionId: req.headers['x-session-id'] || null,
    requestData: req.body
  });
});

proxyRouter.post('/cases/:caseId/tool/signature', async (req, res) => {
  const { caseId } = req.params;
  console.log(`[PROXY] Signature tool requested for case: ${caseId}`, req.body);
  
  // Mock signature processing
  res.json({
    caseId,
    tool: 'signature',
    status: 'processed',
    result: {
      signatureDetected: true,
      confidence: 0.85,
      analysis: 'Mock signature analysis completed',
      coordinates: {
        x: Math.floor(Math.random() * 500),
        y: Math.floor(Math.random() * 300)
      }
    },
    timestamp: new Date().toISOString(),
    processingTime: Math.floor(Math.random() * 1000) + 500
  });
});

// Add a test endpoint to verify the proxy is working
proxyRouter.get('/test', async (req, res) => {
  res.json({
    message: 'Proxy router is working!',
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    method: req.method,
    path: req.path
  });
});

// Mount the proxy router
app.use('/api/proxy', proxyRouter);

// Add a root health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'devvit-stroke-server',
    timestamp: new Date().toISOString()
  });
});

// ---- SERVER STARTUP ----
const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);

console.log(`Server starting on port ${port}`);

export default app;
