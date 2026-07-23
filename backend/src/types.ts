// mirrors src/providers/types.ts - kept separate since this deploys on its own

export interface UsageLimit {
  type: "session" | "weekly" | "daily" | "per_model";
  label: string;
  usedPct: number;
  resetsAt: string | null;
  model?: string;
}

export interface UsageSnapshot {
  provider: "claude" | "chatgpt" | "gemini";
  limits: UsageLimit[];
  fetchedAt: string;
  ok: boolean;
  error?: string;
}
