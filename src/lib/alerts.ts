import type { UsageSnapshot } from "../providers/types.js";
import type { Settings } from "./settings.js";

// De-dup state: for each limit+threshold pair (keyed by provider+type+model+
// threshold), track whether it's "armed" — i.e. eligible to fire again. A
// limit is armed when its usage is below that specific threshold. Crossing
// the threshold while armed fires an alert and disarms it; it only re-arms
// once usage drops back below that same threshold (e.g. after a session/
// weekly reset). Without this, we'd send a Discord message every 5 minutes
// forever once you're over the threshold. Each configured threshold is
// tracked independently, so crossing 50%, 80%, and 95% in the same poll
// fires all three.
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

// Discord and Slack both render basic Markdown in messages by default, but
// use different bold syntax (** vs *). Telegram needs an explicit parse_mode
// to render Markdown at all, so its message is kept plain to avoid literal
// asterisks showing up in the chat.
export function formatForDiscord(ctx: AlertContext): string {
  return `⚠️ **${ctx.provider}** — ${ctx.label} crossed **${ctx.thresholdPct}%** (now at ${ctx.pct}%)`;
}

export function formatForSlack(ctx: AlertContext): string {
  return `⚠️ *${ctx.provider}* — ${ctx.label} crossed *${ctx.thresholdPct}%* (now at ${ctx.pct}%)`;
}

export function formatForTelegram(ctx: AlertContext): string {
  return `⚠️ ${ctx.provider} — ${ctx.label} crossed ${ctx.thresholdPct}% (now at ${ctx.pct}%)`;
}

// These take a pre-formatted message body rather than an AlertContext so
// that sendTestAlert() below can reuse the exact same HTTP-sending code
// with a canned test message, instead of a real threshold-crossing message.
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

  // Don't let one channel's failure (bad token, rate limit, etc.) block the others.
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
      // Each configured threshold is armed/disarmed independently, so a jump
      // that crosses several at once (e.g. 40% -> 96% crossing 50/80/95) fires
      // once per threshold in this same pass rather than just the first one.
      for (const threshold of settings.alertThresholds) {
        const key = limitKey(snapshot.provider, limit.type, limit.model, threshold);
        const entry = state[key] ?? { armed: true };

        if (limit.usedPct < threshold) {
          // Below threshold — make sure it's armed for next time it climbs.
          if (!entry.armed) {
            state[key] = { armed: true };
            stateChanged = true;
          }
          continue;
        }

        // At/above threshold: fire only if still armed.
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

// Fires a canned message straight through the same per-channel send
// functions real alerts use, bypassing checkAndFireAlerts entirely — this
// must never read or write the armed/disarmed alert state. Takes raw
// input rather than a full Settings object so the options page can test
// values typed into the form before they've been saved.
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
