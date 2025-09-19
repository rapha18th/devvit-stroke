import express, { Request, Response } from "express";
import { createServer, context, getServerPort } from "@devvit/web/server";
import { createPost } from "./core/post";
import { HFProvider } from "./providers/hf";
import { MockProvider } from "./providers/mock";
import type { HiddenStrokeProvider } from "./providers/types";

const MODE = (process.env.HS_PROVIDER || "mock").toLowerCase(); // "hf" or "mock"
const provider: HiddenStrokeProvider = MODE === "hf" ? new HFProvider() : new MockProvider();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// keep minimal original endpoints
const router = express.Router();
router.get("/api/init", (_req, res)=> res.json({ status:"success", value:{count:0} }));
router.post("/api/increment", (_req,res)=> res.json({ status:"success", value:{count:1} }));
router.post("/api/decrement", (_req,res)=> res.json({ status:"success", value:{count:0} }));
router.post("/internal/on-app-install", async (_req, res) => {
  try { const post = await createPost();
    res.json({ status:"success", message:`Post created in subreddit ${context.subredditName} with id ${post.id}` });
  } catch (e) { res.status(400).json({ status:"error", message:"Failed to create post" }); }
});
router.post("/internal/menu/post-create", async (_req,res) => {
  try { const post = await createPost();
    res.json({ navigateTo:`https://reddit.com/r/${context.subredditName}/comments/${post.id}` });
  } catch { res.status(400).json({ status:"error", message:"Failed to create post" }); }
});
app.use(router);

// API proxy (same contract for both providers)
const api = express.Router();

api.get("/health", async (_req, res) => {
  try { res.json(await provider.health()); }
  catch (e:any) { res.status(500).json({ status:"error", message:"Health failed", error:e?.message }); }
});

api.post("/cases/today/start", async (req, res) => {
  try {
    const hdrs: Record<string,string> = {};
    if (req.headers["x-reddit-user"]) hdrs["X-Reddit-User"] = String(req.headers["x-reddit-user"]);
    if (req.headers["x-reddit-id"]) hdrs["X-Reddit-Id"] = String(req.headers["x-reddit-id"]);
    res.json(await provider.startToday(hdrs, req.body));
  } catch (e:any) { res.status(500).json({ status:"error", message:"Failed to start case", error:e?.message }); }
});

api.post("/cases/:caseId/tool/signature", async (req, res) => {
  try {
    const h: Record<string,string> = {}; if (req.headers["x-session-id"]) h["X-Session-Id"] = String(req.headers["x-session-id"]);
    if (req.headers["x-reddit-user"]) h["X-Reddit-User"] = String(req.headers["x-reddit-user"]);
    if (req.headers["x-reddit-id"]) h["X-Reddit-Id"] = String(req.headers["x-reddit-id"]);
    res.json(await provider.toolSignature(req.params.caseId, h, req.body));
  } catch (e:any) { res.status(500).json({ status:"error", message:"Signature tool failed", error:e?.message }); }
});

api.post("/cases/:caseId/tool/metadata", async (req, res) => {
  try {
    const h: Record<string,string> = {}; if (req.headers["x-session-id"]) h["X-Session-Id"] = String(req.headers["x-session-id"]);
    if (req.headers["x-reddit-user"]) h["X-Reddit-User"] = String(req.headers["x-reddit-user"]);
    if (req.headers["x-reddit-id"]) h["X-Reddit-Id"] = String(req.headers["x-reddit-id"]);
    res.json(await provider.toolMetadata(req.params.caseId, h, req.body));
  } catch (e:any) { res.status(500).json({ status:"error", message:"Metadata tool failed", error:e?.message }); }
});

api.post("/cases/:caseId/tool/financial", async (req, res) => {
  try {
    const h: Record<string,string> = {}; if (req.headers["x-session-id"]) h["X-Session-Id"] = String(req.headers["x-session-id"]);
    if (req.headers["x-reddit-user"]) h["X-Reddit-User"] = String(req.headers["x-reddit-user"]);
    if (req.headers["x-reddit-id"]) h["X-Reddit-Id"] = String(req.headers["x-reddit-id"]);
    res.json(await provider.toolFinancial(req.params.caseId, h, req.body));
  } catch (e:any) { res.status(500).json({ status:"error", message:"Financial tool failed", error:e?.message }); }
});

api.post("/cases/:caseId/guess", async (req, res) => {
  try {
    const h: Record<string,string> = {}; if (req.headers["x-session-id"]) h["X-Session-Id"] = String(req.headers["x-session-id"]);
    if (req.headers["x-reddit-user"]) h["X-Reddit-User"] = String(req.headers["x-reddit-user"]);
    if (req.headers["x-reddit-id"]) h["X-Reddit-Id"] = String(req.headers["x-reddit-id"]);
    res.json(await provider.guess(req.params.caseId, h, req.body));
  } catch (e:any) { res.status(500).json({ status:"error", message:"Guess failed", error:e?.message }); }
});

api.get("/leaderboard/daily", async (req, res) => {
  try {
    const h: Record<string,string> = {}; if (req.headers["x-reddit-user"]) h["X-Reddit-User"] = String(req.headers["x-reddit-user"]);
    if (req.headers["x-reddit-id"]) h["X-Reddit-Id"] = String(req.headers["x-reddit-id"]);
    res.json(await provider.leaderboard(h));
  } catch (e:any) { res.status(500).json({ status:"error", message:"Leaderboard failed", error:e?.message }); }
});

app.use("/api/proxy", api);

// Health root
app.get("/health", (_req, res) => res.json({ status:"ok", mode: MODE, timestamp:new Date().toISOString() }));

// Server
const port = getServerPort();
const server = createServer(app);
server.on("error", (err)=> console.error(`server error; ${err instanceof Error ? err.stack : String(err)}`));
server.listen(port);
console.log(`Server starting on port ${port} (provider=${MODE})`);
export default app;
