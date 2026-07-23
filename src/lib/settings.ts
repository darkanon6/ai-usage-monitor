export interface Settings {
  discordWebhookUrl: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  slackWebhookUrl: string | null;
  alertThresholds: number[]; // fire once per limit, per threshold crossed; sorted ascending, deduped
  backendUrl: string | null; // self-hosted dashboard backend, e.g. http://192.168.1.50:3000
  // Opt-in only. Default is human-initiated checks (popup open / Check Now);
  // this re-enables the old always-on 5-minute chrome.alarms poll.
  backgroundPollingEnabled: boolean;
}

const SETTINGS_KEY = "settings";

export const DEFAULT_SETTINGS: Settings = {
  discordWebhookUrl: null,
  telegramBotToken: null,
  telegramChatId: null,
  slackWebhookUrl: null,
  alertThresholds: [50, 80, 95],
  backendUrl: null,
  backgroundPollingEnabled: false,
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
