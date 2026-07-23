import type { UsageSnapshot } from "../providers/types.js";

const SNAPSHOT_KEY = "latestSnapshots";

export type SnapshotMap = Partial<Record<UsageSnapshot["provider"], UsageSnapshot>>;

export async function saveSnapshot(snapshot: UsageSnapshot): Promise<void> {
  const current = await getAllSnapshots();
  current[snapshot.provider] = snapshot;
  await chrome.storage.local.set({ [SNAPSHOT_KEY]: current });
}

export async function getAllSnapshots(): Promise<SnapshotMap> {
  const result = await chrome.storage.local.get(SNAPSHOT_KEY);
  return (result[SNAPSHOT_KEY] as SnapshotMap) ?? {};
}
