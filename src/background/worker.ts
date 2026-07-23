import { claudeReader } from "../providers/claude.js";
import { saveSnapshot } from "../lib/storage.js";
import { getSettings } from "../lib/settings.js";
import { checkAndFireAlerts } from "../lib/alerts.js";
import { pushSnapshot } from "../lib/backend.js";
import { ALARM_NAME, syncBackgroundPollingAlarm } from "../lib/background-alarm.js";
import { isCheckNowRequest } from "../lib/messages.js";
import type { UsageSnapshot } from "../providers/types.js";

// Default behavior is human-initiated: a read only happens when the popup
// is opened or "Check Now" is clicked (see the onMessage listener below).
// chrome.alarms only fires at all if the user has opted into Advanced
// background polling in settings — MV3 service workers are ephemeral, so
// when it is enabled, chrome.alarms (not setInterval) is what survives the
// worker being killed and restarted between fires.
chrome.runtime.onInstalled.addListener(() => {
  void syncAlarmFromSettings();
});

chrome.runtime.onStartup.addListener(() => {
  void syncAlarmFromSettings();
});

async function syncAlarmFromSettings(): Promise<void> {
  const settings = await getSettings();
  await syncBackgroundPollingAlarm(settings.backgroundPollingEnabled);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    void pollAll();
  }
});

// The popup asks for a fresh read through this message instead of
// duplicating the read/save/badge/alert/push pipeline itself — this stays
// the single source of truth for it regardless of what triggered a check.
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isCheckNowRequest(message)) {
    void pollAll().then((snapshots) => sendResponse({ snapshots }));
    return true; // keep the message channel open for the async sendResponse above
  }
  return undefined;
});

async function pollAll(): Promise<UsageSnapshot[]> {
  const settings = await getSettings();

  const snapshots: UsageSnapshot[] = await Promise.all([claudeReader.read()]);

  for (const snapshot of snapshots) {
    await saveSnapshot(snapshot);
  }

  updateBadge(snapshots);
  await checkAndFireAlerts(snapshots, settings);

  // Fire-and-forget: a slow or unreachable LAN backend must never delay the
  // badge update or alert check above.
  if (settings.backendUrl) {
    for (const snapshot of snapshots) {
      void pushSnapshot(settings.backendUrl, snapshot).catch((err) => {
        console.error("Failed to push snapshot to backend:", err);
      });
    }
  }

  return snapshots;
}

function updateBadge(snapshots: UsageSnapshot[]): void {
  const okSnapshots = snapshots.filter((s) => s.ok);

  if (okSnapshots.length === 0) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#888888" });
    return;
  }

  const highestPct = Math.max(
    ...okSnapshots.flatMap((s) => s.limits.map((l) => l.usedPct))
  );

  const color =
    highestPct >= 80 ? "#e03131" : highestPct >= 50 ? "#f59f00" : "#2f9e44";

  chrome.action.setBadgeText({ text: `${Math.round(highestPct)}` });
  chrome.action.setBadgeBackgroundColor({ color });
}
