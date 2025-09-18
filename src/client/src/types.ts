export type ToolCosts = { signature: number; metadata: number; financial: number };

export type CaseMetadata = {
  title: string;
  year: string;
  medium: string;
  ink_or_pigment: string;
  catalog_ref: string;
  ownership_chain: string[];
  notes: string;
};

export type CasePublic = {
  case_id: string;
  mode: 'knowledge' | 'observation';
  brief: string;
  style_period: string;
  images: string[];
  signature_crops: string[];
  metadata: CaseMetadata[];
  ledger_summary: string;
  timer_seconds: number;
  initial_ip: number;
  tool_costs: ToolCosts;
  credits: {
    source: string;
    identifier?: string;
    title?: string;
    creator?: string;
    rights?: string;
    licenseurl?: string;
  };
};

export type StartResponse = {
  session_id: string;
  case: CasePublic;
};

export type SignatureToolResponse = {
  crop_url: string;
  hint?: string;
  ip_remaining: number;
};

export type HintToolResponse = {
  flags: string[];
  ip_remaining: number;
};

export type GuessResponse = {
  correct: boolean;
  score: number;
  timeLeft: number;
  ipLeft: number;
  reveal: {
    authentic_index: number;
    explanation: string;
    flags_signature: string[];
    flags_metadata: string[];
    flags_financial: string[];
  };
};

export type LeaderboardRow = {
  user_id: string;
  username: string;
  score: number;
  ts: string;
};

export type LeaderboardDaily = {
  case_id: string;
  top: LeaderboardRow[];
  me: { score?: number; rank?: number | null };
};
