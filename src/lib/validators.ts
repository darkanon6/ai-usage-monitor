// pure functions, no DOM - easy to unit test

export function isValidDiscordWebhook(url: string): boolean {
  return /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+\/?$/.test(url);
}

export function isValidSlackWebhook(url: string): boolean {
  return /^https:\/\/hooks\.slack\.com\/services\/[\w/-]+$/.test(url);
}

export function isValidTelegramBotToken(token: string): boolean {
  return /^\d+:[\w-]+$/.test(token);
}

export function isValidTelegramChatId(chatId: string): boolean {
  return /^-?\d+$/.test(chatId);
}

export function isValidThreshold(raw: string): boolean {
  const n = Number(raw);
  return raw.trim().length > 0 && Number.isInteger(n) && n >= 1 && n <= 100;
}

// dedupe + sort so save() is idempotent no matter what order rows got edited in
export function normalizeThresholds(thresholds: number[]): number[] {
  return Array.from(new Set(thresholds)).sort((a, b) => a - b);
}

export function isValidBackendUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
