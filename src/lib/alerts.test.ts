import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkAndFireAlerts,
  formatForDiscord,
  formatForSlack,
  formatForTelegram,
  sendTestAlert,
} from "./alerts.js";
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

// need to fake chrome.storage.local and fetch since neither exist under plain node --test
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

test("formatForDiscord names the crossed threshold and the current usage separately", () => {
  const ctx = { provider: "claude", label: "7-day (all models)", pct: 82, thresholdPct: 80 };
  const msg = formatForDiscord(ctx);
  assert.match(msg, /crossed \*\*80%\*\*/);
  assert.match(msg, /now at 82%/);
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
    alertThresholds: [80],
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
    alertThresholds: [80],
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

test("checkAndFireAlerts fires once per threshold when several are crossed in the same poll", async () => {
  installChromeStorageMock();
  const sentUrls: string[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    sentUrls.push(url);
    return { ok: true };
  };

  const settings = {
    ...DEFAULT_SETTINGS,
    alertThresholds: [50, 80, 95],
    discordWebhookUrl: "https://discord.com/api/webhooks/1/x",
  };

  await checkAndFireAlerts([makeSnapshot(40)], settings); // below all three
  assert.equal(sentUrls.length, 0);

  await checkAndFireAlerts([makeSnapshot(96)], settings); // jumps past 50, 80, and 95 at once
  assert.equal(sentUrls.length, 3);
});

test("dropping back below one threshold re-arms only that threshold, not others", async () => {
  installChromeStorageMock();
  const sentUrls: string[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    sentUrls.push(url);
    return { ok: true };
  };

  const settings = {
    ...DEFAULT_SETTINGS,
    alertThresholds: [50, 80, 95],
    discordWebhookUrl: "https://discord.com/api/webhooks/1/x",
  };

  await checkAndFireAlerts([makeSnapshot(96)], settings); // crosses 50, 80, 95
  assert.equal(sentUrls.length, 3);

  await checkAndFireAlerts([makeSnapshot(85)], settings); // drops below 95 only
  assert.equal(sentUrls.length, 3, "no new fires just from dropping back down");

  await checkAndFireAlerts([makeSnapshot(97)], settings); // crosses 95 again; 50/80 stay disarmed
  assert.equal(sentUrls.length, 4, "only the re-armed threshold (95) fires again");
});

test("empty alertThresholds array never fires, even far above 100%", async () => {
  installChromeStorageMock();
  const sentUrls: string[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    sentUrls.push(url);
    return { ok: true };
  };

  const settings = {
    ...DEFAULT_SETTINGS,
    alertThresholds: [],
    discordWebhookUrl: "https://discord.com/api/webhooks/1/x",
  };

  await checkAndFireAlerts([makeSnapshot(150)], settings);
  assert.equal(sentUrls.length, 0);
});

test("sendTestAlert sends to every configured channel and reports success", async () => {
  const calls: string[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    calls.push(url);
    return { ok: true, status: 200, statusText: "OK" };
  };

  const results = await sendTestAlert({
    discordWebhookUrl: "https://discord.com/api/webhooks/1/x",
    telegramBotToken: "123:abc",
    telegramChatId: "456",
    slackWebhookUrl: "https://hooks.slack.com/services/T/B/x",
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(
    results.map((r) => r.channel).sort(),
    ["discord", "slack", "telegram"]
  );
  assert.ok(results.every((r) => r.ok));
});

test("sendTestAlert reports a per-channel failure without throwing", async () => {
  (globalThis as unknown as { fetch: unknown }).fetch = async () => ({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
  });

  const results = await sendTestAlert({
    discordWebhookUrl: "https://discord.com/api/webhooks/1/x",
    telegramBotToken: null,
    telegramChatId: null,
    slackWebhookUrl: null,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].ok, false);
  assert.match(results[0].error!, /401/);
});

test("sendTestAlert returns an empty array when no channels are configured", async () => {
  const results = await sendTestAlert({
    discordWebhookUrl: null,
    telegramBotToken: null,
    telegramChatId: null,
    slackWebhookUrl: null,
  });
  assert.deepEqual(results, []);
});

test("sendTestAlert requires both a telegram token and chat id before attempting to send", async () => {
  const calls: string[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
    calls.push(url);
    return { ok: true };
  };

  const results = await sendTestAlert({
    discordWebhookUrl: null,
    telegramBotToken: "123:abc",
    telegramChatId: null,
    slackWebhookUrl: null,
  });

  assert.equal(calls.length, 0);
  assert.deepEqual(results, []);
});
