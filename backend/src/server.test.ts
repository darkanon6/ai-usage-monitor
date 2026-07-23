import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createServer } from "./server.js";
import { openStore } from "./db.js";
import type { UsageSnapshot } from "./types.js";

function makeSnapshot(usedPct: number): UsageSnapshot {
  return {
    provider: "claude",
    fetchedAt: new Date().toISOString(),
    ok: true,
    limits: [{ type: "session", label: "5-hour session", usedPct, resetsAt: null }],
  };
}

async function withServer(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const store = openStore(":memory:");
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-usage-monitor-test-"));
  fs.writeFileSync(path.join(publicDir, "index.html"), "<h1>dashboard</h1>");

  const server = createServer(store, publicDir);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
}

test("POST /snapshots accepts a valid snapshot and rejects a malformed body", async () => {
  await withServer(async (base) => {
    const ok = await fetch(`${base}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeSnapshot(50)),
    });
    assert.equal(ok.status, 201);

    const bad = await fetch(`${base}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ not: "a snapshot" }),
    });
    assert.equal(bad.status, 400);
  });
});

test("POST /snapshots rejects a snapshot with a malformed limit entry", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "claude",
        fetchedAt: new Date().toISOString(),
        ok: true,
        limits: [{ type: "session", label: "5-hour session", usedPct: "not a number", resetsAt: null }],
      }),
    });
    assert.equal(res.status, 400);
  });
});

test("POST /snapshots rejects a request without a JSON Content-Type, even with a valid-looking body", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(makeSnapshot(50)),
    });
    assert.equal(res.status, 415);
  });
});

test("POST /snapshots rejects an oversized body", async () => {
  await withServer(async (base) => {
    const oversized = makeSnapshot(50);
    oversized.limits[0].label = "x".repeat(100_000);
    const res = await fetch(`${base}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(oversized),
    });
    assert.equal(res.status, 413);
  });
});

test("GET path traversal outside publicDir is rejected", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/../../../../etc/passwd`);
    assert.notEqual(res.status, 200);
  });
});

test("GET /snapshots/latest?provider= returns the most recent snapshot, or null with no data", async () => {
  await withServer(async (base) => {
    const empty = await fetch(`${base}/snapshots/latest?provider=claude`);
    assert.equal(await empty.json(), null);

    await fetch(`${base}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeSnapshot(77)),
    });

    const res = await fetch(`${base}/snapshots/latest?provider=claude`);
    const snapshot = (await res.json()) as UsageSnapshot;
    assert.equal(snapshot.limits[0].usedPct, 77);
  });
});

test("GET /snapshots/history returns newest-first and respects limit", async () => {
  await withServer(async (base) => {
    for (const pct of [10, 20, 30]) {
      await fetch(`${base}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeSnapshot(pct)),
      });
    }

    const res = await fetch(`${base}/snapshots/history?provider=claude&limit=2`);
    const history = (await res.json()) as UsageSnapshot[];
    assert.equal(history.length, 2);
    assert.equal(history[0].limits[0].usedPct, 30);
  });
});

test("GET / serves the dashboard's static index.html", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /dashboard/);
  });
});

test("unknown routes return 404", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/nonexistent`);
    assert.equal(res.status, 404);
  });
});
