export type StartTodayResponse = { session_id: string; case: any };
export interface HiddenStrokeProvider {
  health(): Promise<any>;
  startToday(headers: Record<string,string>, body?: any): Promise<StartTodayResponse>;
  toolSignature(caseId: string, headers: Record<string,string>, body: any): Promise<any>;
  toolMetadata(caseId: string, headers: Record<string,string>, body: any): Promise<any>;
  toolFinancial(caseId: string, headers: Record<string,string>, body: any): Promise<any>;
  guess(caseId: string, headers: Record<string,string>, body: any): Promise<any>;
  leaderboard(headers: Record<string,string>): Promise<any>;
}
