// every provider reader returns this shape - badge/popup/alerts only ever
// talk to this, never a provider's raw response

export interface UsageLimit {
  type: "session" | "weekly" | "daily" | "per_model";
  label: string;       // human-readable, e.g. "5-hour session"
  usedPct: number;      // 0–100
  resetsAt: string | null; // ISO timestamp, or null if unknown
  model?: string;        // present for per_model limits
}

export interface UsageSnapshot {
  provider: "claude" | "chatgpt" | "gemini";
  limits: UsageLimit[];
  fetchedAt: string;    // ISO timestamp of when we read this
  ok: boolean;           // false if the read failed (not logged in, endpoint changed, etc.)
  error?: string;         // present when ok === false
}

// Every provider module implements this.
export interface ProviderReader {
  provider: UsageSnapshot["provider"];
  read(): Promise<UsageSnapshot>;

}
