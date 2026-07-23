import { test } from "node:test";
import assert from "node:assert/strict";
import { openStore, rowToSnapshot } from "./db.js";
import type { UsageSnapshot } from "./types.js";

function makeSnapshot(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    provider: "claude",
    fetchedAt: new Date().toISOString(),
    ok: true,
    limits: [{ type: "session", label: "5-hour session", usedPct: 42, resetsAt: null }],
    ...overrides,
  };
}

test("insertSnapshot + getLatest round-trips a snapshot", () => {
  const store = openStore(":memory:");
  store.insertSnapshot(makeSnapshot({ fetchedAt: "2026-01-01T00:00:00Z" }));

  const row = store.getLatest("claude");
  assert.ok(row);
  assert.deepEqual(rowToSnapshot(row), makeSnapshot({ fetchedAt: "2026-01-01T00:00:00Z" }));
  store.close();
});

test("getLatest returns the most recently fetched snapshot for that provider", () => {
  const store = openStore(":memory:");
  store.insertSnapshot(makeSnapshot({ fetchedAt: "2026-01-01T00:00:00Z" }));
  store.insertSnapshot(makeSnapshot({ fetchedAt: "2026-01-02T00:00:00Z" }));
  store.insertSnapshot(makeSnapshot({ fetchedAt: "2026-01-01T12:00:00Z" }));

  const row = store.getLatest("claude");
  assert.equal(row?.fetched_at, "2026-01-02T00:00:00Z");
  store.close();
});

test("getLatestAll returns one row per provider", () => {
  const store = openStore(":memory:");
  store.insertSnapshot(makeSnapshot({ provider: "claude", fetchedAt: "2026-01-01T00:00:00Z" }));
  store.insertSnapshot(makeSnapshot({ provider: "chatgpt", fetchedAt: "2026-01-01T00:00:00Z" }));
  store.insertSnapshot(makeSnapshot({ provider: "claude", fetchedAt: "2026-01-02T00:00:00Z" }));

  const rows = store.getLatestAll();
  assert.equal(rows.length, 2);
  const claudeRow = rows.find((r) => r.provider === "claude");
  assert.equal(claudeRow?.fetched_at, "2026-01-02T00:00:00Z");
  store.close();
});

test("getHistory returns rows newest-first, capped at the given limit", () => {
  const store = openStore(":memory:");
  for (const day of [1, 2, 3, 4]) {
    store.insertSnapshot(makeSnapshot({ fetchedAt: `2026-01-0${day}T00:00:00Z` }));
  }

  const rows = store.getHistory("claude", 2);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fetched_at, "2026-01-04T00:00:00Z");
  assert.equal(rows[1].fetched_at, "2026-01-03T00:00:00Z");
  store.close();
});

test("rowToSnapshot maps ok=0 and a stored error back out", () => {
  const store = openStore(":memory:");
  store.insertSnapshot(
    makeSnapshot({ ok: false, error: "lastActiveOrg cookie not found", limits: [] })
  );

  const row = store.getLatest("claude");
  assert.ok(row);
  const snapshot = rowToSnapshot(row);
  assert.equal(snapshot.ok, false);
  assert.equal(snapshot.error, "lastActiveOrg cookie not found");
  assert.deepEqual(snapshot.limits, []);
  store.close();
});
