// Format checks for the options page. Kept as pure functions (no DOM) so
// they're easy to unit test and reuse if validation is ever needed elsewhere.

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
  return raw.trim().length > 0 && Number.isFinite(n) && n >= 1 && n <= 100;
}

export function isValidBackendUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
