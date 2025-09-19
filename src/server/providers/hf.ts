import type { HiddenStrokeProvider, StartTodayResponse } from "./types";

const HF_BASE = process.env.HF_BASE || "https://rairo-dev-stroke.hf.space";

async function j(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}: ${t}`);
  return t ? JSON.parse(t) : {};
}

function hdr(extra?: Record<string,string>) {
  return { "Content-Type":"application/json", "User-Agent":"DevvitStrokeApp/1.0", ...(extra||{}) };
}

export class HFProvider implements HiddenStrokeProvider {
  async health() { return j(`${HF_BASE}/health`, { method:"GET", headers: hdr() }); }

  async startToday(h: Record<string,string>, body?: any): Promise<StartTodayResponse> {
    return j(`${HF_BASE}/cases/today/start`, { method:"POST", headers: hdr(h), body: JSON.stringify(body||{}) });
  }

  async toolSignature(caseId: string, h: Record<string,string>, body: any) {
    return j(`${HF_BASE}/cases/${caseId}/tool/signature`, { method:"POST", headers: hdr(h), body: JSON.stringify(body||{}) });
  }
  async toolMetadata(caseId: string, h: Record<string,string>, body: any) {
    return j(`${HF_BASE}/cases/${caseId}/tool/metadata`, { method:"POST", headers: hdr(h), body: JSON.stringify(body||{}) });
  }
  async toolFinancial(caseId: string, h: Record<string,string>, body: any) {
    return j(`${HF_BASE}/cases/${caseId}/tool/financial`, { method:"POST", headers: hdr(h), body: JSON.stringify(body||{}) });
  }
  async guess(caseId: string, h: Record<string,string>, body: any) {
    return j(`${HF_BASE}/cases/${caseId}/guess`, { method:"POST", headers: hdr(h), body: JSON.stringify(body||{}) });
  }
  async leaderboard(h: Record<string,string>) {
    return j(`${HF_BASE}/leaderboard/daily`, { method:"GET", headers: hdr(h) });
  }
}
