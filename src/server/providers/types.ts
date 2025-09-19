// src/server/providers/types.ts
export type StartTodayResponse = {
  session_id: string;
  case: any; // we pass through the MockCase public bits
};

export interface HiddenStrokeProvider {
  health(): Promise<{ ok: true; source: string; time: string }>;

  startToday(
    headers: Record<string, string>,
    body?: unknown
  ): Promise<StartTodayResponse>;

  toolSignature(
    caseId: string,
    headers: Record<string, string>,
    body: any
  ): Promise<{ crop_url?: string; hint?: string; ip_remaining: number }>;

  toolMetadata(
    caseId: string,
    headers: Record<string, string>,
    body: any
  ): Promise<{ flags: string[]; ip_remaining: number }>;

  toolFinancial?(
    caseId: string,
    headers: Record<string, string>,
    body: any
  ): Promise<{ flags: string[]; ip_remaining: number }>;

  guess(
    caseId: string,
    headers: Record<string, string>,
    body: { image_index: number; rationale?: string }
  ): Promise<{ correct: boolean; score: number; timeLeft: number; ipLeft: number; message?: string }>;

  leaderboard(headers: Record<string, string>): Promise<{ top: Array<{ user: string; score: number }> }>;
}
