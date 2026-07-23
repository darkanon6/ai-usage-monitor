// shared with options.ts so it can flip the alarm on/off directly on save,
// no need to message the service worker to do it
export const ALARM_NAME = "usage-poll";
export const POLL_MINUTES = 5;

export async function syncBackgroundPollingAlarm(enabled: boolean): Promise<void> {
  if (enabled) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
  } else {
    await chrome.alarms.clear(ALARM_NAME);
  }
}
