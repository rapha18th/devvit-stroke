import type { HiddenStrokeProvider, StartTodayResponse } from "./types";
import { MOCK_CASES, caseIdToday, type MockCase } from "../mockCases";

type Session = { id:string; case_id:string; ip:number; exp:number; status:"active"|"expired"|"finished"; user?:{id?:string;name?:string} };
const sessions = new Map<string,Session>();
const plays: Record<string, Record<string, {user_id:string; username:string; score:number; ts:number}>> = {};

function pickCase(): MockCase {
  const today = caseIdToday();
  return MOCK_CASES[Number(today.slice(-2)) % MOCK_CASES.length];
}
function ns(k: MockCase, user?: {id?:string; name?:string}): Session {
  const id = `sess_${Math.random().toString(36).slice(2)}`;
  const exp = Date.now() + k.timer_seconds*1000;
  const s: Session = { id, case_id:k.case_id, ip:k.initial_ip, exp, status:"active", user };
  sessions.set(id, s); return s;
}
function gs(h: Record<string,string>): Session | null {
  const sid = String(h["x-session-id"] || h["X-Session-Id"] || "");
  const s = sid ? sessions.get(sid)||null : null;
  if (s && s.status==="active" && Date.now()>s.exp) s.status="expired";
  return s;
}
function spend(s: Session, cost:number) {
  if (s.status!=="active") return "Invalid or inactive session.";
  if (s.ip < cost) return "Not enough Investigation Points.";
  s.ip -= cost; return null;
}
function score(correct:boolean, s:Session, k:MockCase) {
  const left = Math.max(0, Math.floor((s.exp - Date.now())/1000));
  const total = Math.max(0, (correct?100:0) + Math.ceil(left/10) + s.ip*2 - (correct?0:40));
  return { score: total, seconds_left: left, ip_left: s.ip };
}

export class MockProvider implements HiddenStrokeProvider {
  async health(){ return { ok:true, source:"mock", time:new Date().toISOString() }; }

  async startToday(h:Record<string,string>): Promise<StartTodayResponse> {
    const k = pickCase();
    const user = { id:String(h["x-reddit-id"]||"anon"), name:String(h["x-reddit-user"]||"anon") };
    const existing = [...sessions.values()].find(s=>s.case_id===k.case_id && s.user?.id===user.id && s.status==="active");
    const s = existing || ns(k, user);
    const { solution, ...pub } = k as any;
    return { session_id: s.id, case: pub };
  }

  async toolSignature(caseId:string, h:Record<string,string>, body:any) {
    const s = gs(h); if(!s) throw new Error("Invalid or inactive session.");
    const k = MOCK_CASES.find(x=>x.case_id===caseId)!;
    const idx = Number((body||{}).image_index ?? 0);
    const err = spend(s, k.tool_costs.signature); if (err) throw new Error(err);
    return { crop_url: k.signature_crops[idx]||"", hint: k.solution.flags_signature[0]||"", ip_remaining: s.ip };
  }
  async toolMetadata(caseId:string, h:Record<string,string>, body:any) {
    const s = gs(h); if(!s) throw new Error("Invalid or inactive session.");
    const k = MOCK_CASES.find(x=>x.case_id===caseId)!;
    const err = spend(s, k.tool_costs.metadata); if (err) throw new Error(err);
    return { flags: [k.solution.flags_metadata[0] || ""], ip_remaining: s.ip };
  }
  async toolFinancial(caseId:string, h:Record<string,string>, body:any) {
    const s = gs(h); if(!s) throw new Error("Invalid or inactive session.");
    const k = MOCK_CASES.find(x=>x.case_id===caseId)!;
    const err = spend(s, k.tool_costs.financial); if (err) throw new Error(err);
    return { flags: [k.solution.flags_financial[0] || ""], ip_remaining: s.ip };
  }
  async guess(caseId:string, h:Record<string,string>, body:any) {
    const s = gs(h); if(!s) throw new Error("Invalid or inactive session.");
    const k = MOCK_CASES.find(x=>x.case_id===caseId)!;
    s.status = "finished";
    const pick = Number((body||{}).image_index ?? -1);
    const correct = pick === k.solution.answer_index;
    const sum = score(correct, s, k);
    const uid = s.user?.id || `anon_${s.id.slice(-6)}`; const uname = s.user?.name || "anon";
    plays[k.case_id] ||= {}; plays[k.case_id][uid] = { user_id:uid, username:uname, score:sum.score, ts:Date.now() };
    return { correct, score:sum.score, timeLeft:sum.seconds_left, ipLeft:sum.ip_left,
      reveal:{ authentic_index:k.solution.answer_index, explanation:k.solution.explanation,
        flags_signature:k.solution.flags_signature, flags_metadata:k.solution.flags_metadata, flags_financial:k.solution.flags_financial } };
  }
  async leaderboard(h:Record<string,string>) {
    const k = pickCase();
    const rows = Object.values(plays[k.case_id] || {}).sort((a,b)=>b.score-a.score).slice(0,50);
    return { case_id: k.case_id, top: rows };
  }
}
