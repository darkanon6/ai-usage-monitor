import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAndFireAlerts, formatForDiscord, formatForSlack, formatForTelegram } from "./alerts.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import type { UsageSnapshot } from "../providers/types.js";

function makeSnapshot(usedPct: number): UsageSnapshot {
  return {
    provider: "claude",
    fetchedAt: new Date().toISOString(),
    ok: true,
    limits: [{ type: "session", label: "5-hour session", usedPct, resetsAt: null }],
  };
}

// checkAndFireAlerts talks to chrome.storage.local (de-dup state) and fetch
// (webhook delivery), neither of which exist under plain `node --test`. This
// mock is the minimal surface both need.
function installChromeStorageMock(): void {
  const store: Record<string, unknown> = {};
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (items: Record<string, unknown>) => {
          Object.assign(store, items);
        },
      },
    },
  };
}

test("formatForDiscord and formatForSlack bold with different syntax; formatForTelegram stays plain", () => {
  const ctx = { provider: "claude", label: "5-hour session", pct: 90, thresholdPct: 80 };
  assert.match(formatForDiscord(ctx), /\*\*claude\*\*/);
  assert.match(formatForSlack(ctx), /(?<!\*)\*claude\*(?!\*)/);
  assert.doesNotMatch(formatForTelegram(ctx), /\*/);
});

test("checkAndFireAlerts fires once on crossing threshold, then de-dups while sustained above it", async () => {
  installChromeStorageMock();
  const sentUrls: string[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    sentUrls.push(url);
    return { ok: true };
  };

  const settings = {
    ...DEFAULT_SETTINGS,
    discordWebhookUrl: "https://discord.com/api/webhooks/1/x",
  };

  await checkAndFireAlerts([makeSnapshot(90)], settings);
  assert.equal(sentUrls.length, 1);

  await checkAndFireAlerts([makeSnapshot(95)], settings);
  assert.equal(sentUrls.length, 1, "must not re-fire while still above threshold");
});

test("checkAndFireAlerts re-arms after usage drops back below threshold", async () => {
  installChromeStorageMock();
  const sentUrls: string[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    sentUrls.push(url);
    return { ok: true };
  };

  const settings = {
    ...DEFAULT_SETTINGS,
    discordWebhookUrl: "https://discord.com/api/webhooks/1/x",
  };

  await checkAndFireAlerts([makeSnapshot(90)], settings);
  await checkAndFireAlerts([makeSnapshot(50)], settings); // drop below -> re-arm
  await checkAndFireAlerts([makeSnapshot(90)], settings); // cross again -> fires

  assert.equal(sentUrls.length, 2);
});

test("checkAndFireAlerts does not fire when no channel is configured", async () => {
  installChromeStorageMock();
  const sentUrls: string[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    sentUrls.push(url);
    return { ok: true };
  };

  await checkAndFireAlerts([makeSnapshot(90)], DEFAULT_SETTINGS);
  assert.equal(sentUrls.length, 0);
});
