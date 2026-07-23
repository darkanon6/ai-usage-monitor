export interface Settings {
  discordWebhookUrl: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  slackWebhookUrl: string | null;
  alertThresholdPct: number; // fire an alert once usage crosses this, per limit
  backendUrl: string | null; // self-hosted dashboard backend, e.g. http://192.168.1.50:3000
}

const SETTINGS_KEY = "settings";

export const DEFAULT_SETTINGS: Settings = {
  discordWebhookUrl: null,
  telegramBotToken: null,
  telegramChatId: null,
  slackWebhookUrl: null,
  alertThresholdPct: 80,
  backendUrl: null,
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
