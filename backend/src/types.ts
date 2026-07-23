// Mirrors src/providers/types.ts in the extension. Kept as an independent
// copy rather than a cross-project import — the backend is a standalone
// deployable and shouldn't reach into the extension's build.

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
