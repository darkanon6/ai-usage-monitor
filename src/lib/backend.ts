import type { UsageSnapshot } from "../providers/types.js";

// Pushes a snapshot to the user's self-hosted backend (see backend/). Only
// called when a backendUrl is configured; the caller is expected to treat
// this as fire-and-forget so a slow/unreachable LAN box never delays the
// badge update or alert check.
export async function pushSnapshot(backendUrl: string, snapshot: UsageSnapshot): Promise<void> {
  const base = backendUrl.replace(/\/$/, "");
  await fetch(`${base}/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
}
