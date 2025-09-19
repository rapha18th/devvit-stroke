// src/server/providers/mock.ts
import type { HiddenStrokeProvider } from "./types";
import { MOCK_CASES, caseIdToday } from "../data/mockCases";

// In-memory sessions (simple + ephemeral)
type Session = {
  id: string;
  caseId: string;
  startedAt: number;      // ms
  expiresAt: number;      // ms
  ipRemaining: number;    // investigation points
};
const SESSIONS = new Map<string, Session>();

function now() { return Date.now(); }
function newId(prefix = "s_") { return prefix + Math.random().toString(36).slice(2); }
function findCase(caseId: string) {
  const c = MOCK_CASES.find(c => c.case_id === caseId);
  if (!c) throw new Error(`Unknown case_id ${caseId}`);
  return c;
}
function sessionFrom(headers: Record<string, string>): Session | undefined {
  const sid = headers["X-Session-Id"] || headers["x-session-id"];
  return sid ? SESSIONS.get(String(sid)) : undefined;
}

export class MockProvider implements HiddenStrokeProvider {
  async health() {
    return { ok: true, source: "mock", time: new Date().toISOString() };
  }

  async startToday(_headers: Record<string,string>) {
    // pick case by UTC day: rotate through the five cases
    const todayId = caseIdToday();
    const dayIdx = Number(todayId.slice(-2)) % MOCK_CASES.length;
    const kase = MOCK_CASES[dayIdx];

    const sid = newId();
    const ttlSec = Math.max(30, kase.timer_seconds || 90);
    const sess: Session = {
      id: sid,
      caseId: kase.case_id,
      startedAt: now(),
      expiresAt: now() + ttlSec * 1000,
      ipRemaining: kase.initial_ip ?? 8,
    };
    SESSIONS.set(sid, sess);

    // expose only public bits
    const pub = {
      case_id: kase.case_id,
      mode: "knowledge" as const,
      brief: kase.brief,
      images: kase.images,
      signature_crops: kase.signature_crops,
      metadata: kase.metadata,
      ledger_summary: kase.ledger_summary,
      timer_seconds: ttlSec,
      initial_ip: sess.ipRemaining,
      tool_costs: kase.tool_costs,
      credits: kase.credits,
    };

    return { session_id: sid, case: pub };
  }

  // --- Tools --------------------------------------------------------------

  private ensureSession(caseId: string, headers: Record<string,string>): Session {
    const sess = sessionFrom(headers);
    if (!sess) throw new Error("Invalid or inactive session.");
    if (sess.caseId !== caseId) throw new Error("Session/case mismatch.");
    if (now() > sess.expiresAt) throw new Error("Session expired.");
    return sess;
  }

  async toolSignature(caseId: string, headers: Record<string,string>, body: any) {
    const sess = this.ensureSession(caseId, headers);
    const kase = findCase(caseId);
    const idx = Number(body?.image_index ?? 0);
    const cost = kase.tool_costs.signature ?? 1;
    if (sess.ipRemaining < cost) throw new Error("Not enough IP.");

    sess.ipRemaining -= cost;

    const crop_url = kase.signature_crops[idx];
    // Simple, non-spoilery hinting:
    const good = idx === kase.solution.answer_index;
    const hint = good
      ? "Signature fluency and underlayer match period practice."
      : "Signature rhythm shows hesitation / later retouch characteristics.";

    return { crop_url, hint, ip_remaining: sess.ipRemaining };
  }

  async toolMetadata(caseId: string, headers: Record<string,string>, body: any) {
    const sess = this.ensureSession(caseId, headers);
    const kase = findCase(caseId);
    const idx = Number(body?.image_index ?? 0);
    const cost = kase.tool_costs.metadata ?? 1;
    if (sess.ipRemaining < cost) throw new Error("Not enough IP.");

    sess.ipRemaining -= cost;

    // Generate a short, educational flag; avoid spoilers.
    const good = idx === kase.solution.answer_index;
    const flags = [
      good
        ? "Provenance and catalog notes align with early records."
        : "Provenance gaps and later registry notes reduce confidence."
    ];

    return { flags, ip_remaining: sess.ipRemaining };
  }

  // (Optional) If your server routes still call financial, return a neutral hint.
  async toolFinancial(caseId: string, headers: Record<string,string>) {
    const sess = this.ensureSession(caseId, headers);
    return { flags: ["Financial tool disabled in mock build."], ip_remaining: sess.ipRemaining };
  }

  // --- Guess --------------------------------------------------------------

  async guess(caseId: string, headers: Record<string,string>, body: { image_index: number }) {
    const sess = this.ensureSession(caseId, headers);
    const kase = findCase(caseId);

    const correct = Number(body?.image_index) === kase.solution.answer_index;

    // Very simple scoring: base 100, + remaining IP, + remaining seconds * 1
    const timeLeft = Math.max(0, Math.floor((sess.expiresAt - now()) / 1000));
    const score = (correct ? 100 : 0) + sess.ipRemaining + timeLeft;

    // expire session after guess so tools can’t be spammed
    sess.expiresAt = now() - 1;

    return { correct, score, timeLeft, ipLeft: sess.ipRemaining, message: correct ? "Correct!" : "Not quite—good try." };
  }

  // --- Leaderboard (mock) -------------------------------------------------

  async leaderboard(_headers: Record<string,string>) {
    // Deterministic but fake
    return {
      top: [
        { user: "u/CuratorAlpha", score: 178 },
        { user: "u/PaintNerd",    score: 164 },
        { user: "u/VarnishCat",   score: 151 },
      ],
    };
  }
}
