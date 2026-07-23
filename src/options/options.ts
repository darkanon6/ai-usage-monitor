import { getSettings, saveSettings } from "../lib/settings.js";
import { sendTestAlert } from "../lib/alerts.js";
import { syncBackgroundPollingAlarm } from "../lib/background-alarm.js";
import {
  isValidDiscordWebhook,
  isValidSlackWebhook,
  isValidTelegramBotToken,
  isValidTelegramChatId,
  isValidThreshold,
  isValidBackendUrl,
  normalizeThresholds,
} from "../lib/validators.js";

const MAX_THRESHOLDS = 5;

function thresholdsContainer(): HTMLElement {
  return document.getElementById("thresholds")!;
}

function thresholdInputs(): HTMLInputElement[] {
  return Array.from(thresholdsContainer().querySelectorAll<HTMLInputElement>(".threshold-input"));
}

function addThresholdRow(value: number): void {
  const row = document.createElement("div");
  row.className = "threshold-row";

  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "100";
  input.className = "threshold-input";
  input.value = String(value);

  const percent = document.createElement("span");
  percent.textContent = "%";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-secondary";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    row.remove();
    updateAddThresholdButton();
  });

  row.appendChild(input);
  row.appendChild(percent);
  row.appendChild(removeBtn);
  thresholdsContainer().appendChild(row);
  updateAddThresholdButton();
}

function updateAddThresholdButton(): void {
  const addBtn = document.getElementById("add-threshold") as HTMLButtonElement;
  addBtn.disabled = thresholdInputs().length >= MAX_THRESHOLDS;
}

document.getElementById("add-threshold")!.addEventListener("click", () => {
  const current = thresholdInputs()
    .map((i) => Number(i.value))
    .filter((n) => Number.isFinite(n));
  const highest = current.length > 0 ? Math.max(...current) : 0;
  const suggestion = Math.min(100, Math.round((highest + 100) / 2));
  addThresholdRow(suggestion);
});

async function load(): Promise<void> {
  const settings = await getSettings();

  thresholdsContainer().innerHTML = "";
  for (const threshold of settings.alertThresholds) {
    addThresholdRow(threshold);
  }

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
  (document.getElementById("background-polling") as HTMLInputElement).checked =
    settings.backgroundPollingEnabled;
}

function setError(fieldId: string, message: string | null): void {
  const el = document.getElementById(`${fieldId}-error`);
  if (!el) return;
  el.textContent = message ?? "";
  el.style.display = message ? "block" : "none";
}

async function save(): Promise<void> {
  const thresholdRaws = thresholdInputs().map((i) => i.value.trim());
  const webhookRaw = (document.getElementById("webhook") as HTMLInputElement).value.trim();
  const telegramTokenRaw = (document.getElementById("telegram-token") as HTMLInputElement).value.trim();
  const telegramChatIdRaw = (document.getElementById("telegram-chatid") as HTMLInputElement).value.trim();
  const slackWebhookRaw = (document.getElementById("slack-webhook") as HTMLInputElement).value.trim();
  const backendUrlRaw = (document.getElementById("backend-url") as HTMLInputElement).value.trim();
  const backgroundPollingEnabled = (document.getElementById("background-polling") as HTMLInputElement).checked;

  // blank = disabled, but if you did type something it needs to look right,
  // otherwise a typo just fails silently later in the service worker console
  let hasError = false;

  if (thresholdRaws.some((raw) => !isValidThreshold(raw))) {
    setError("thresholds", "Each threshold must be a whole number between 1 and 100.");
    hasError = true;
  } else {
    setError("thresholds", null);
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

  // no broad host_permissions up front - only ask for this one origin, right now
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
    alertThresholds: normalizeThresholds(thresholdRaws.map(Number)),
    backendUrl: backendUrlRaw.length > 0 ? backendUrlRaw : null,
    backgroundPollingEnabled,
  });

  // apply now instead of waiting for the worker's next onInstalled/onStartup sync
  await syncBackgroundPollingAlarm(backgroundPollingEnabled);

  const savedEl = document.getElementById("saved")!;
  savedEl.style.display = "inline";
  setTimeout(() => (savedEl.style.display = "none"), 1500);
}

const CHANNEL_LABELS: Record<string, string> = {
  discord: "Discord",
  telegram: "Telegram",
  slack: "Slack",
};

async function runTestAlert(): Promise<void> {
  const resultsEl = document.getElementById("test-results")!;
  resultsEl.innerHTML = "";

  const webhookRaw = (document.getElementById("webhook") as HTMLInputElement).value.trim();
  const telegramTokenRaw = (document.getElementById("telegram-token") as HTMLInputElement).value.trim();
  const telegramChatIdRaw = (document.getElementById("telegram-chatid") as HTMLInputElement).value.trim();
  const slackWebhookRaw = (document.getElementById("slack-webhook") as HTMLInputElement).value.trim();

  const results = await sendTestAlert({
    discordWebhookUrl: webhookRaw.length > 0 ? webhookRaw : null,
    telegramBotToken: telegramTokenRaw.length > 0 ? telegramTokenRaw : null,
    telegramChatId: telegramChatIdRaw.length > 0 ? telegramChatIdRaw : null,
    slackWebhookUrl: slackWebhookRaw.length > 0 ? slackWebhookRaw : null,
  });

  if (results.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No channels configured to test.";
    resultsEl.appendChild(li);
    return;
  }

  for (const result of results) {
    const li = document.createElement("li");
    const label = CHANNEL_LABELS[result.channel];
    li.textContent = result.ok ? `✅ ${label} sent` : `❌ ${label} failed: ${result.error}`;
    resultsEl.appendChild(li);
  }
}

document.getElementById("test-alert")!.addEventListener("click", () => void runTestAlert());
document.getElementById("save")!.addEventListener("click", () => void save());
void load();
