import type { UsageSnapshot } from "../providers/types.js";

// pushes to your self-hosted backend if you've set one up - caller treats this
// as fire-and-forget so a dead box never delays the badge/alert check
export async function pushSnapshot(backendUrl: string, snapshot: UsageSnapshot): Promise<void> {
  const base = backendUrl.replace(/\/$/, "");
  await fetch(`${base}/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
}
