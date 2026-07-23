import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { UsageSnapshot, UsageLimit } from "./types.js";

export interface SnapshotRow {
  id: number;
  provider: string;
  fetched_at: string;
  ok: number;
  error: string | null;
  limits_json: string;
}

export interface SnapshotStore {
  insertSnapshot(snapshot: UsageSnapshot): void;
  getLatest(provider: string): SnapshotRow | undefined;
  getLatestAll(): SnapshotRow[];
  getHistory(provider: string, limit: number): SnapshotRow[];
  close(): void;
}

// Factory rather than a module-level singleton so tests can open an
// isolated (in-memory) store instead of touching the real usage.db file.
export function openStore(dbPath: string): SnapshotStore {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      ok INTEGER NOT NULL,
      error TEXT,
      limits_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_provider_fetched_at
      ON snapshots (provider, fetched_at DESC);
  `);

  const insertStmt = db.prepare(
    `INSERT INTO snapshots (provider, fetched_at, ok, error, limits_json) VALUES (?, ?, ?, ?, ?)`
  );
  const latestStmt = db.prepare(
    `SELECT * FROM snapshots WHERE provider = ? ORDER BY fetched_at DESC LIMIT 1`
  );
  const latestAllStmt = db.prepare(`
    SELECT s.* FROM snapshots s
    INNER JOIN (
      SELECT provider, MAX(fetched_at) AS max_fetched_at FROM snapshots GROUP BY provider
    ) latest ON s.provider = latest.provider AND s.fetched_at = latest.max_fetched_at
  `);
  const historyStmt = db.prepare(
    `SELECT * FROM snapshots WHERE provider = ? ORDER BY fetched_at DESC LIMIT ?`
  );

  return {
    insertSnapshot(snapshot: UsageSnapshot): void {
      insertStmt.run(
        snapshot.provider,
        snapshot.fetchedAt,
        snapshot.ok ? 1 : 0,
        snapshot.error ?? null,
        JSON.stringify(snapshot.limits)
      );
    },
    getLatest(provider: string): SnapshotRow | undefined {
      return latestStmt.get(provider) as SnapshotRow | undefined;
    },
    getLatestAll(): SnapshotRow[] {
      return latestAllStmt.all() as SnapshotRow[];
    },
    getHistory(provider: string, limit: number): SnapshotRow[] {
      return historyStmt.all(provider, limit) as SnapshotRow[];
    },
    close(): void {
      db.close();
    },
  };
}

export function rowToSnapshot(row: SnapshotRow): UsageSnapshot {
  return {
    provider: row.provider as UsageSnapshot["provider"],
    fetchedAt: row.fetched_at,
    ok: row.ok === 1,
    limits: JSON.parse(row.limits_json) as UsageLimit[],
    ...(row.error !== null ? { error: row.error } : {}),
  };
}
