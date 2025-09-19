// src/server/providers/mock.ts
import type { HiddenStrokeProvider } from "./types";
import { MOCK_CASES, caseIdToday } from "../mockCases"; // <- your path

type Session = {
  id: string;
  caseId: string;
  startedAt: number;   // ms
  expiresAt: number;   // ms
  ipRemaining: number;
  finished?: boolean;
};

const SESSIONS = new Map<string, Session>();

// --- helpers ---------------------------------------------------------------
const now = () => Date.now();
const newId = (p = "s_") => p + Math.random().toString(36).slice(2);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const secondsLeft = (ms: number) => Math.max(0, Math.floor((ms - now()) / 1000));

function pickCaseForToday(): { idx: number; id: string } {
  const id = caseIdToday();              // YYYYMMDD
  const idx = Number(id.slice(-2)) % MOCK_CASES.length; // rotate through the 5
  return { idx, id };
}

function getCase(caseId: string) {
  const c = MOCK_CASES.find((k) => k.case_id === caseId);
  if (!c) throw new Error(`unknown case_id ${caseId}`);
  return c;
}

function ensureSessionForCase(caseId: string, sessionId?: string): Session {
  // Happy path: existing active session
  if (sessionId) {
    const found = SESSIONS.get(sessionId);
    if (found && found.caseId === caseId && !found.finished) return found;
  }
  // Create or refresh a tolerant session
  const c = getCase(caseId);
  const id = sessionId || newId();
  const life = clamp((c.timer_seconds | 0), 30, 600); // sane floor/ceiling
  const s: Session = {
    id,
    caseId,
    startedAt: now(),
    expiresAt: now() + life * 1000,
    ipRemaining: c.initial_ip | 0,
  };
  SESSIONS.set(id, s);
  return s;
}

function spendIP(s: Session, cost: number) {
  s.ipRemaining = clamp(s.ipRemaining - (cost | 0), 0, 99);
  return s.ipRemaining;
}

function score(correct: boolean, s: Session) {
  const tl = secondsLeft(s.expiresAt);
  const base = correct ? 100 : 0;
  const timeBonus = Math.ceil(tl / 10);
  const ipBonus = s.ipRemaining * 2;
  const penalty = correct ? 0 : 40;
  return Math.max(0, base + timeBonus + ipBonus - penalty);
}

// --- provider --------------------------------------------------------------
export class MockProvider implements HiddenStrokeProvider {
  async health() {
    return { ok: true as const, source: "mock", time: new Date().toISOString() };
  }

  async startToday(_headers: Record<string, string>) {
    const { idx } = pickCaseForToday();
    const c = MOCK_CASES[idx];

    // start tolerant session
    const s = ensureSessionForCase(c.case_id);

    // send only the public bits
    const pub = {
      case_id: c.case_id,
      mode: "knowledge" as const, // not used by UI, harmless
      brief: c.brief,
      images: c.images,
      signature_crops: c.signature_crops,
      metadata: c.metadata,
      ledger_summary: c.ledger_summary,
      timer_seconds: c.timer_seconds,
      initial_ip: c.initial_ip,
      tool_costs: c.tool_costs,
      credits: c.credits,
    };

    return { session_id: s.id, case: pub };
  }

  async toolSignature(caseId: string, headers: Record<string, string>, body: any) {
    const idx = Number(body?.image_index ?? 0);
    const s = ensureSessionForCase(caseId, headers["X-Session-Id"] as string | undefined);
    const c = getCase(caseId);

    spendIP(s, c.tool_costs.signature);

    // pick crop by index (A/B/C)
    const crop_url = c.signature_crops[idx] || "";
    const hint = c.solution.flags_signature?.[0] || "";

    return { crop_url, hint, ip_remaining: s.ipRemaining };
  }

  async toolMetadata(caseId: string, headers: Record<string, string>, body: any) {
    const _idx = Number(body?.image_index ?? 0);
    const s = ensureSessionForCase(caseId, headers["X-Session-Id"] as string | undefined);
    const c = getCase(caseId);

    spendIP(s, c.tool_costs.metadata);

    // provide a single helpful note
    const flag = c.solution.flags_metadata?.[0] || "Check chronology, chemistry, and catalog consistency.";
    return { flags: [flag], ip_remaining: s.ipRemaining };
  }

  // keep for compatibility; your UI may not call it anymore
  async toolFinancial(caseId: string, headers: Record<string, string>, _body: any) {
    const s = ensureSessionForCase(caseId, headers["X-Session-Id"] as string | undefined);
    const c = getCase(caseId);
    const flag = c.solution.flags_financial?.[0] || "Follow currency, jurisdiction, and payment timelines.";
    // do not charge IP if you're not using it; or uncomment below to charge
    // spendIP(s, c.tool_costs.financial);
    return { flags: [flag], ip_remaining: s.ipRemaining };
  }

  async guess(
    caseId: string,
    headers: Record<string, string>,
    body: { image_index: number; rationale?: string }
  ) {
    const s = ensureSessionForCase(caseId, headers["X-Session-Id"] as string | undefined);
    const c = getCase(caseId);

    const pick = Number(body?.image_index ?? -1);
    const correct = pick === c.solution.answer_index;

    const sc = score(correct, s);
    const tl = secondsLeft(s.expiresAt);

    s.finished = true; // lock session after guess

    return { correct, score: sc, timeLeft: tl, ipLeft: s.ipRemaining };
  }

  async leaderboard(_headers: Record<string, string>) {
    // simple static placeholder
    return {
      top: [
        { user: "anon", score: 180 },
        { user: "guest42", score: 160 },
        { user: "visitor", score: 140 },
      ],
    };
  }
}

export default MockProvider;
