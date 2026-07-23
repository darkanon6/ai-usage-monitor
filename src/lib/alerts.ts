import type { UsageSnapshot } from "../providers/types.js";
import type { Settings } from "./settings.js";

// armed = eligible to fire again. below threshold = armed, crossing it fires
// once and disarms, only re-arms by dropping back below. otherwise we'd spam
// a Discord message every 5 min forever once you're over the threshold
const ALERT_STATE_KEY = "alertState";
type AlertState = Record<string, { armed: boolean }>;

function limitKey(provider: string, type: string, model: string | undefined, threshold: number): string {
  return `${provider}:${type}:${model ?? ""}:${threshold}`;
}

async function getAlertState(): Promise<AlertState> {
  const result = await chrome.storage.local.get(ALERT_STATE_KEY);
  return (result[ALERT_STATE_KEY] as AlertState) ?? {};
}

async function saveAlertState(state: AlertState): Promise<void> {
  await chrome.storage.local.set({ [ALERT_STATE_KEY]: state });
}

export interface AlertContext {
  provider: string;
  label: string;
  pct: number;
  thresholdPct: number;
}

// discord/slack bold differently (** vs *), telegram needs parse_mode to render
// markdown at all so it just stays plain to avoid literal asterisks showing up
export function formatForDiscord(ctx: AlertContext): string {
  return `⚠️ **${ctx.provider}** — ${ctx.label} crossed **${ctx.thresholdPct}%** (now at ${ctx.pct}%)`;
}

export function formatForSlack(ctx: AlertContext): string {
  return `⚠️ *${ctx.provider}* — ${ctx.label} crossed *${ctx.thresholdPct}%* (now at ${ctx.pct}%)`;
}

export function formatForTelegram(ctx: AlertContext): string {
  return `⚠️ ${ctx.provider} — ${ctx.label} crossed ${ctx.thresholdPct}% (now at ${ctx.pct}%)`;
}

// plain text in, not AlertContext, so sendTestAlert() can reuse these with a canned message
async function sendDiscordAlert(webhookUrl: string, text: string): Promise<Response> {
  return fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text }),
  });
}

async function sendTelegramAlert(botToken: string, chatId: string, text: string): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendSlackAlert(webhookUrl: string, text: string): Promise<Response> {
  return fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

async function fanOutAlert(settings: Settings, ctx: AlertContext): Promise<void> {
  const sends: Promise<Response>[] = [];

  if (settings.discordWebhookUrl) {
    sends.push(sendDiscordAlert(settings.discordWebhookUrl, formatForDiscord(ctx)));
  }
  if (settings.telegramBotToken && settings.telegramChatId) {
    sends.push(sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, formatForTelegram(ctx)));
  }
  if (settings.slackWebhookUrl) {
    sends.push(sendSlackAlert(settings.slackWebhookUrl, formatForSlack(ctx)));
  }

  // one bad channel (bad token, rate limit) shouldn't block the rest
  await Promise.allSettled(sends);
}

export async function checkAndFireAlerts(
  snapshots: UsageSnapshot[],
  settings: Settings
): Promise<void> {
  const state = await getAlertState();
  let stateChanged = false;

  for (const snapshot of snapshots) {
    if (!snapshot.ok) continue;

    for (const limit of snapshot.limits) {
      // each threshold armed/disarmed independently - a jump from 40% to 96%
      // crosses 50/80/95 all at once and should fire all three, not just one
      for (const threshold of settings.alertThresholds) {
        const key = limitKey(snapshot.provider, limit.type, limit.model, threshold);
        const entry = state[key] ?? { armed: true };

        if (limit.usedPct < threshold) {
          if (!entry.armed) {
            state[key] = { armed: true };
            stateChanged = true;
          }
          continue;
        }

        if (entry.armed) {
          state[key] = { armed: false };
          stateChanged = true;

          if (settings.discordWebhookUrl || settings.telegramBotToken || settings.slackWebhookUrl) {
            await fanOutAlert(settings, {
              provider: snapshot.provider,
              label: limit.label,
              pct: Math.round(limit.usedPct),
              thresholdPct: threshold,
            });
          }
        }
      }
    }
  }

  if (stateChanged) {
    await saveAlertState(state);
  }
}

export interface TestAlertInput {
  discordWebhookUrl: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  slackWebhookUrl: string | null;
}

export interface TestAlertResult {
  channel: "discord" | "telegram" | "slack";
  ok: boolean;
  error?: string;
}

const TEST_ALERT_MESSAGE =
  "✅ Test alert from Usage Monitor — if you see this, the connection works.";

async function testSend(
  channel: TestAlertResult["channel"],
  send: () => Promise<Response>
): Promise<TestAlertResult> {
  try {
    const res = await send();
    if (res.ok) {
      return { channel, ok: true };
    }
    return { channel, ok: false, error: `${res.status} ${res.statusText}`.trim() };
  } catch (err) {
    return { channel, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// canned message through the same send functions, skips checkAndFireAlerts
// entirely - never touches armed/disarmed state. takes raw input instead of
// Settings so the options page can test values before hitting Save
export async function sendTestAlert(input: TestAlertInput): Promise<TestAlertResult[]> {
  const tasks: Promise<TestAlertResult>[] = [];

  if (input.discordWebhookUrl) {
    const webhookUrl = input.discordWebhookUrl;
    tasks.push(testSend("discord", () => sendDiscordAlert(webhookUrl, TEST_ALERT_MESSAGE)));
  }
  if (input.telegramBotToken && input.telegramChatId) {
    const { telegramBotToken, telegramChatId } = input;
    tasks.push(
      testSend("telegram", () => sendTelegramAlert(telegramBotToken, telegramChatId, TEST_ALERT_MESSAGE))
    );
  }
  if (input.slackWebhookUrl) {
    const webhookUrl = input.slackWebhookUrl;
    tasks.push(testSend("slack", () => sendSlackAlert(webhookUrl, TEST_ALERT_MESSAGE)));
  }

  return Promise.all(tasks);
}
