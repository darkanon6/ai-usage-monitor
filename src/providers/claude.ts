import type { ProviderReader, UsageSnapshot, UsageLimit } from "./types.js";

const CLAUDE_ORIGIN = "https://claude.ai";

// --- Shapes of Claude's own internal usage response (reverse-engineered
// from DevTools). Undocumented and may change — if it does, this is the
// only file that needs fixing. ---
export interface ClaudeLimitEntry {
  kind: string; // "session" | "weekly_all" | "weekly_scoped" | ...
  group: string;
  percent: number;
  resets_at: string | null;
  is_active: boolean;
  scope?: {
    model?: { id: string | null; display_name: string };
    surface?: unknown;
  } | null;
}

interface ClaudeUsageResponse {
  limits: ClaudeLimitEntry[];
}

async function getOrgId(): Promise<string> {
  const cookie = await chrome.cookies.get({
    url: CLAUDE_ORIGIN,
    name: "lastActiveOrg",
  });
  if (!cookie?.value) {
    throw new Error("lastActiveOrg cookie not found — are you logged into claude.ai?");
  }
  return cookie.value;
}

export function mapLimit(entry: ClaudeLimitEntry): UsageLimit {
  switch (entry.kind) {
    case "session":
      return {
        type: "session",
        label: "5-hour session",
        usedPct: entry.percent,
        resetsAt: entry.resets_at,
      };
    case "weekly_all":
      return {
        type: "weekly",
        label: "7-day (all models)",
        usedPct: entry.percent,
        resetsAt: entry.resets_at,
      };
    case "weekly_scoped": {
      const modelName = entry.scope?.model?.display_name ?? "model";
      return {
        type: "per_model",
        label: `7-day (${modelName})`,
        usedPct: entry.percent,
        resetsAt: entry.resets_at,
        model: modelName,
      };
    }
    default:
      return {
        type: "weekly",
        label: entry.kind,
        usedPct: entry.percent,
        resetsAt: entry.resets_at,
      };
  }
}

async function read(): Promise<UsageSnapshot> {
  const fetchedAt = new Date().toISOString();
  try {
    const orgId = await getOrgId();

    const res = await fetch(
      `${CLAUDE_ORIGIN}/api/organizations/${orgId}/usage`,
      { credentials: "include" }
    );

    if (!res.ok) {
      throw new Error(`Usage endpoint returned ${res.status}`);
    }

    const data = (await res.json()) as ClaudeUsageResponse;
    const limits = (data.limits ?? []).map(mapLimit);

    return { provider: "claude", limits, fetchedAt, ok: true };
  } catch (err) {
    return {
      provider: "claude",
      limits: [],
      fetchedAt,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const claudeReader: ProviderReader = { provider: "claude", read };
