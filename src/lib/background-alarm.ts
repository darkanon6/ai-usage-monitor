// Shared between background/worker.ts (which listens for this alarm) and
// options.ts (which creates/clears it directly when the user toggles
// Advanced background polling, without needing to message the service
// worker to do it).
export const ALARM_NAME = "usage-poll";
export const POLL_MINUTES = 5;

export async function syncBackgroundPollingAlarm(enabled: boolean): Promise<void> {
  if (enabled) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
  } else {
    await chrome.alarms.clear(ALARM_NAME);
  }
}
