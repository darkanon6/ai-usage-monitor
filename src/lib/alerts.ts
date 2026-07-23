import type { UsageSnapshot } from "../providers/types.js";
import type { Settings } from "./settings.js";

// De-dup state: for each limit (keyed by provider+type+model), track whether
// it's "armed" — i.e. eligible to fire again. A limit is armed when its usage
// is below the threshold. Crossing the threshold while armed fires an alert
// and disarms it; it only re-arms once usage drops back below the threshold
// (e.g. after a session/weekly reset). Without this, we'd send a Discord
// message every 5 minutes forever once you're over 80%.
const ALERT_STATE_KEY = "alertState";
type AlertState = Record<string, { armed: boolean }>;

function limitKey(provider: string, type: string, model?: string): string {
  return `${provider}:${type}:${model ?? ""}`;
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
  return `⚠️ **${ctx.provider}** — ${ctx.label} is at **${ctx.pct}%** (threshold: ${ctx.thresholdPct}%)`;
}

export function formatForSlack(ctx: AlertContext): string {
  return `⚠️ *${ctx.provider}* — ${ctx.label} is at *${ctx.pct}%* (threshold: ${ctx.thresholdPct}%)`;
}

export function formatForTelegram(ctx: AlertContext): string {
  return `⚠️ ${ctx.provider} — ${ctx.label} is at ${ctx.pct}% (threshold: ${ctx.thresholdPct}%)`;
}

async function sendDiscordAlert(webhookUrl: string, ctx: AlertContext): Promise<void> {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: formatForDiscord(ctx) }),
  });
}

async function sendTelegramAlert(botToken: string, chatId: string, ctx: AlertContext): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: formatForTelegram(ctx) }),
  });
}

async function sendSlackAlert(webhookUrl: string, ctx: AlertContext): Promise<void> {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: formatForSlack(ctx) }),
  });
}

async function fanOutAlert(settings: Settings, ctx: AlertContext): Promise<void> {
  const sends: Promise<void>[] = [];

  if (settings.discordWebhookUrl) {
    sends.push(sendDiscordAlert(settings.discordWebhookUrl, ctx));
  }
  if (settings.telegramBotToken && settings.telegramChatId) {
    sends.push(sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, ctx));
  }
  if (settings.slackWebhookUrl) {
    sends.push(sendSlackAlert(settings.slackWebhookUrl, ctx));
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
      const key = limitKey(snapshot.provider, limit.type, limit.model);
      const entry = state[key] ?? { armed: true };

      if (limit.usedPct < settings.alertThresholdPct) {
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
            thresholdPct: settings.alertThresholdPct,
          });
        }
      }
    }
  }

  if (stateChanged) {
    await saveAlertState(state);
  }
}
