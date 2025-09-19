// src/server/mockProvider.ts
import { randomUUID } from "crypto";
import type { Request, Response, Router } from "express";
import express from "express";
import { MOCK_CASES, caseIdToday } from "./mockCases";

// ----- Simple in-memory store (resets on process restart) -----
type Session = {
  id: string;
  case_id: string;
  ip_remaining: number;
  status: "active" | "expired" | "finished";
  expires_at: number; // ms epoch
  actions: Array<{ type: string; ts: number; image_index?: number }>;
};

const SESSIONS = new Map<string, Session>();
const TTL_MS = 90_000; // 90s timer from your cases
const INITIAL_IP = 8;

function now() { return Date.now(); }
function getCase(caseId: string) {
  const byId = MOCK_CASES.find(c => c.case_id === caseId);
  if (byId) return byId;
  // daily rotation: 001..005
  const day = parseInt(caseIdToday().slice(-2), 10) || 0;
  return MOCK_CASES[(day % MOCK_CASES.length)];
}

function requireActiveSession(req: Request): { session?: Session; error?: string } {
  const sid = (req.headers["x-session-id"] as string) || "";
  if (!sid) return { error: "Missing X-Session-Id header." };
  const sess = SESSIONS.get(sid);
  if (!sess) return { error: "Invalid or inactive session." };
  if (sess.status !== "active") return { error: "Invalid or inactive session." };
  if (now() > sess.expires_at) { sess.status = "expired"; return { error: "Session expired." }; }
  return { session: sess };
}

function spendIP(sess: Session, cost: number, action: {type:string; image_index?: number}) {
  if (sess.ip_remaining < cost) return { error: "Not enough Investigation Points." };
  sess.ip_remaining -= cost;
  action.ts = now();
  sess.actions.push(action);
  return {};
}

// ----- Router (mock API) -----
export function makeMockRouter(): Router {
  const r = express.Router();

  // Health
  r.get("/health", (_req, res) => {
    res.json({ ok: true, source: "mock", time: new Date().toISOString() });
  });

  // Start today's case
  r.post("/cases/today/start", (req, res) => {
    const c = getCase(caseIdToday());
    const session: Session = {
      id: randomUUID(),
      case_id: c.case_id,
      ip_remaining: INITIAL_IP,
      status: "active",
      expires_at: now() + (c.timer_seconds ?? 90) * 1000,
      actions: []
    };
    SESSIONS.set(session.id, session);
    res.json({ session_id: session.id, case: c });
  });

  // Signature tool
  r.post("/cases/:caseId/tool/signature", (req, res) => {
    const { session, error } = requireActiveSession(req);
    if (error) return res.status(400).json({ error });
    if (session!.case_id !== req.params.caseId) return res.status(400).json({ error: "Session/case mismatch." });

    const image_index = Number((req.body?.image_index ?? 0));
    if (![0,1,2].includes(image_index)) return res.status(400).json({ error: "image_index must be 0,1,2" });

    const c = getCase(session!.case_id);
    const cost = c.tool_costs?.signature ?? 1;
    const spend = spendIP(session!, cost, { type: "tool_signature", image_index });
    if ("error" in spend) return res.status(400).json(spend);

    const crop_url = c.signature_crops?.[image_index] || "";
    const hint = c.solution.flags_signature?.[0] || "";
    return res.json({ crop_url, hint, ip_remaining: session!.ip_remaining });
  });

  // Metadata tool
  r.post("/cases/:caseId/tool/metadata", (req, res) => {
    const { session, error } = requireActiveSession(req);
    if (error) return res.status(400).json({ error });
    if (session!.case_id !== req.params.caseId) return res.status(400).json({ error: "Session/case mismatch." });

    const image_index = Number((req.body?.image_index ?? 0));
    if (![0,1,2].includes(image_index)) return res.status(400).json({ error: "image_index must be 0,1,2" });

    const c = getCase(session!.case_id);
    const cost = c.tool_costs?.metadata ?? 1;
    const spend = spendIP(session!, cost, { type: "tool_metadata", image_index });
    if ("error" in spend) return res.status(400).json(spend);

    const hint = c.solution.flags_metadata?.[0] || "Check chronology, chemistry, and institutional formats.";
    return res.json({ flags: [hint], ip_remaining: session!.ip_remaining });
  });

  // Financial tool — disabled for demo
  r.post("/cases/:caseId/tool/financial", (_req, res) => {
    return res.status(404).json({ error: "Financial tool is disabled in this demo." });
  });

  // Submit guess
  r.post("/cases/:caseId/guess", (req, res) => {
    const { session, error } = requireActiveSession(req);
    if (error) return res.status(400).json({ error });
    if (session!.case_id !== req.params.caseId) return res.status(400).json({ error: "Session/case mismatch." });

    const image_index = Number((req.body?.image_index ?? -1));
    if (![0,1,2].includes(image_index)) return res.status(400).json({ error: "image_index must be 0,1,2" });

    // finish session
    session!.status = "finished";

    const c = getCase(session!.case_id);
    const authentic = c.solution.answer_index; // always 0 in server truth
    const correct = (image_index === authentic);

    // trivial scoring
    const seconds_left = Math.max(0, Math.floor((session!.expires_at - now()) / 1000));
    const time_bonus = Math.ceil(seconds_left / 10);
    const ip_bonus = session!.ip_remaining * 2;
    const base = correct ? 100 : 0;
    const penalty = correct ? 0 : 40;
    const score = Math.max(0, base + time_bonus + ip_bonus - penalty);

    return res.json({
      correct,
      score,
      timeLeft: seconds_left,
      ipLeft: session!.ip_remaining,
      reveal: {
        authentic_index: authentic,
        explanation: c.solution.explanation,
        flags_signature: c.solution.flags_signature,
        flags_metadata: c.solution.flags_metadata,
        flags_financial: [] // disabled
      }
    });
  });

  // Leaderboard (mock)
  r.get("/leaderboard/daily", (_req, res) => {
    const c = getCase(caseIdToday());
    res.json({ case_id: c.case_id, top: [], me: { score: undefined, rank: null } });
  });

  return r;
}
