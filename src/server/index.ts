import { Devvit } from '@devvit/kit';
import { createPost } from './core/post';

// Configure Devvit app
Devvit.configure({
  http: true,
  redis: false,
});

// Add domains for HTTP requests
Devvit.addSettings([
  {
    type: 'string',
    name: 'huggingface-url',
    label: 'Hugging Face Space URL',
    defaultValue: 'https://rairo-dev-stroke.hf.space',
  },
]);

// Health check endpoint proxy
Devvit.addCustomPostType({
  name: 'Health Check',
  height: 'tall',
  render: (context) => {
    return (
      <vstack>
        <text>Health Check Proxy</text>
      </vstack>
    );
  },
});

// HTTP service for proxying requests
const httpService = {
  async forwardRequest(context: any, path: string, method: string = 'GET', body?: any) {
    const baseUrl = 'https://rairo-dev-stroke.hf.space';
    const url = `${baseUrl}${path}`;
    
    try {
      const user = await context.reddit.getCurrentUser();
      const userId = user?.id ?? `anon-${Date.now()}`;
      const userName = user?.name ?? 'anonymous';

      const requestOptions: any = {
        url,
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DevvitApp/1.0',
          'X-Reddit-Id': userId,
          'X-Reddit-User': userName,
        },
      };

      if (body && method !== 'GET') {
        requestOptions.body = JSON.stringify(body);
      }

      console.log(`[HTTP SERVICE] Making ${method} request to: ${url}`);
      
      const response = await context.http.fetch(requestOptions);
      return await response.json();
    } catch (error) {
      console.error('[HTTP SERVICE] Request failed:', error);
      throw error;
    }
  }
};

// Menu action for creating posts
Devvit.addMenuItem({
  label: 'Create Stroke App Post',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    try {
      const post = await createPost(context);
      context.ui.showToast({
        text: `Post created successfully: ${post.id}`,
        appearance: 'success',
      });
    } catch (error) {
      console.error('Error creating post:', error);
      context.ui.showToast({
        text: 'Failed to create post',
        appearance: 'error',
      });
    }
  },
});

// HTTP endpoints for the proxy
Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (event, context) => {
    console.log('App installed on subreddit:', event.subreddit?.name);
  },
});

// Custom server routes would need to be handled differently in pure Devvit
// Let's create a hybrid approach that works with both patterns

export default Devvit;

// If you need to keep the Express server for compatibility, here's the corrected version:
import express from 'express';
import { reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// Original router
const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    // Original code
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    // Original code
  }
);

router.post<{ postId:string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    // Original code
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

app.use(router);

// ALTERNATIVE APPROACH: Simple proxy without external HTTP calls
const proxyRouter = express.Router();

// Instead of making external HTTP calls, return mock data or handle differently
proxyRouter.get('/health', async (req, res) => {
  console.log('[PROXY] Health check requested');
  
  // Since external HTTP calls are blocked, return a mock response
  // or implement the functionality directly in the server
  res.json({
    status: 'ok',
    message: 'Proxy service is running',
    note: 'External HTTP calls are restricted in Devvit environment'
  });
});

proxyRouter.post('/cases/today/start', async (req, res) => {
  console.log('[PROXY] Case start requested:', req.body);
  
  // Implement the logic directly here instead of proxying
  // or return mock data for testing
  res.json({
    caseId: `case-${Date.now()}`,
    status: 'started',
    message: 'Case started successfully (mock response)'
  });
});

proxyRouter.post('/cases/:caseId/tool/signature', async (req, res) => {
  const { caseId } = req.params;
  console.log(`[PROXY] Signature tool requested for case: ${caseId}`, req.body);
  
  // Implement signature logic directly
  res.json({
    caseId,
    result: 'signature_processed',
    message: 'Signature tool executed (mock response)'
  });
});

app.use('/api/proxy', proxyRouter);

// Server startup
const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
