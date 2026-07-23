import { getSettings, saveSettings } from "../lib/settings.js";
import {
  isValidDiscordWebhook,
  isValidSlackWebhook,
  isValidTelegramBotToken,
  isValidTelegramChatId,
  isValidThreshold,
  isValidBackendUrl,
} from "../lib/validators.js";

async function load(): Promise<void> {
  const settings = await getSettings();

  (document.getElementById("threshold") as HTMLInputElement).value =
    String(settings.alertThresholdPct);
  (document.getElementById("webhook") as HTMLInputElement).value =
    settings.discordWebhookUrl ?? "";
  (document.getElementById("telegram-token") as HTMLInputElement).value =
    settings.telegramBotToken ?? "";
  (document.getElementById("telegram-chatid") as HTMLInputElement).value =
    settings.telegramChatId ?? "";
  (document.getElementById("slack-webhook") as HTMLInputElement).value =
    settings.slackWebhookUrl ?? "";
  (document.getElementById("backend-url") as HTMLInputElement).value =
    settings.backendUrl ?? "";
}

function setError(fieldId: string, message: string | null): void {
  const el = document.getElementById(`${fieldId}-error`);
  if (!el) return;
  el.textContent = message ?? "";
  el.style.display = message ? "block" : "none";
}

async function save(): Promise<void> {
  const thresholdRaw = (document.getElementById("threshold") as HTMLInputElement).value.trim();
  const webhookRaw = (document.getElementById("webhook") as HTMLInputElement).value.trim();
  const telegramTokenRaw = (document.getElementById("telegram-token") as HTMLInputElement).value.trim();
  const telegramChatIdRaw = (document.getElementById("telegram-chatid") as HTMLInputElement).value.trim();
  const slackWebhookRaw = (document.getElementById("slack-webhook") as HTMLInputElement).value.trim();
  const backendUrlRaw = (document.getElementById("backend-url") as HTMLInputElement).value.trim();

  // Each field is optional (blank disables that channel), but if filled in,
  // it must actually look like the thing it claims to be — otherwise a typo
  // fails silently later, only visible in the service worker console.
  let hasError = false;

  if (!isValidThreshold(thresholdRaw)) {
    setError("threshold", "Enter a number between 1 and 100.");
    hasError = true;
  } else {
    setError("threshold", null);
  }

  if (webhookRaw.length > 0 && !isValidDiscordWebhook(webhookRaw)) {
    setError("webhook", "Doesn't look like a Discord webhook URL (https://discord.com/api/webhooks/...).");
    hasError = true;
  } else {
    setError("webhook", null);
  }

  if (telegramTokenRaw.length > 0 && !isValidTelegramBotToken(telegramTokenRaw)) {
    setError("telegram-token", "Bot tokens look like 123456789:AAxxxxxxxxxxxxxxxxxxxxxx.");
    hasError = true;
  } else {
    setError("telegram-token", null);
  }

  if (telegramChatIdRaw.length > 0 && !isValidTelegramChatId(telegramChatIdRaw)) {
    setError("telegram-chatid", "Chat ID should be numeric (from the getUpdates response).");
    hasError = true;
  } else {
    setError("telegram-chatid", null);
  }

  if (slackWebhookRaw.length > 0 && !isValidSlackWebhook(slackWebhookRaw)) {
    setError("slack-webhook", "Doesn't look like a Slack webhook URL (https://hooks.slack.com/services/...).");
    hasError = true;
  } else {
    setError("slack-webhook", null);
  }

  if (backendUrlRaw.length > 0 && !isValidBackendUrl(backendUrlRaw)) {
    setError("backend-url", "Enter a full URL, e.g. http://192.168.1.50:3000.");
    hasError = true;
  } else {
    setError("backend-url", null);
  }

  if (hasError) return;

  // The extension has no host_permissions for arbitrary addresses up front
  // (declared as optional_host_permissions instead) — request access to
  // this specific origin only once the user actually configures it.
  if (backendUrlRaw.length > 0) {
    const origin = new URL(backendUrlRaw);
    const granted = await chrome.permissions.request({
      origins: [`${origin.protocol}//${origin.host}/*`],
    });
    if (!granted) {
      setError("backend-url", "Permission to reach that address was denied, so it wasn't saved.");
      return;
    }
  }

  await saveSettings({
    discordWebhookUrl: webhookRaw.length > 0 ? webhookRaw : null,
    telegramBotToken: telegramTokenRaw.length > 0 ? telegramTokenRaw : null,
    telegramChatId: telegramChatIdRaw.length > 0 ? telegramChatIdRaw : null,
    slackWebhookUrl: slackWebhookRaw.length > 0 ? slackWebhookRaw : null,
    alertThresholdPct: Number(thresholdRaw),
    backendUrl: backendUrlRaw.length > 0 ? backendUrlRaw : null,
  });

  const savedEl = document.getElementById("saved")!;
  savedEl.style.display = "inline";
  setTimeout(() => (savedEl.style.display = "none"), 1500);
}

document.getElementById("save")!.addEventListener("click", () => void save());
void load();
