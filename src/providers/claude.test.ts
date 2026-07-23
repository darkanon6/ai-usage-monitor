import { test } from "node:test";
import assert from "node:assert/strict";
import { mapLimit } from "./claude.js";

test("mapLimit maps a session entry", () => {
  const result = mapLimit({
    kind: "session",
    group: "g",
    percent: 42,
    resets_at: "2026-01-01T00:00:00Z",
    is_active: true,
  });
  assert.deepEqual(result, {
    type: "session",
    label: "5-hour session",
    usedPct: 42,
    resetsAt: "2026-01-01T00:00:00Z",
  });
});

test("mapLimit maps a weekly_all entry", () => {
  const result = mapLimit({
    kind: "weekly_all",
    group: "g",
    percent: 7,
    resets_at: null,
    is_active: true,
  });
  assert.equal(result.type, "weekly");
  assert.equal(result.label, "7-day (all models)");
});

test("mapLimit maps a weekly_scoped entry with the model name", () => {
  const result = mapLimit({
    kind: "weekly_scoped",
    group: "g",
    percent: 10,
    resets_at: null,
    is_active: true,
    scope: { model: { id: "claude-x", display_name: "Claude Opus" } },
  });
  assert.equal(result.type, "per_model");
  assert.equal(result.model, "Claude Opus");
  assert.match(result.label, /Claude Opus/);
});

test("mapLimit falls back to a generic weekly label for unknown kinds", () => {
  const result = mapLimit({
    kind: "mystery_kind",
    group: "g",
    percent: 5,
    resets_at: null,
    is_active: true,
  });
  assert.equal(result.type, "weekly");
  assert.equal(result.label, "mystery_kind");
});
