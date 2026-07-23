import { claudeReader } from "../providers/claude.js";
import { saveSnapshot } from "../lib/storage.js";
import { getSettings } from "../lib/settings.js";
import { checkAndFireAlerts } from "../lib/alerts.js";
import { pushSnapshot } from "../lib/backend.js";
import { ALARM_NAME, syncBackgroundPollingAlarm } from "../lib/background-alarm.js";
import { isCheckNowRequest } from "../lib/messages.js";
import type { UsageSnapshot } from "../providers/types.js";

// default is human-initiated (popup open / Check Now). alarms only fire if
// Advanced mode is on - using chrome.alarms not setInterval since MV3 kills
// this worker whenever it feels like it
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

// popup asks for a check through here instead of duplicating the pipeline itself
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isCheckNowRequest(message)) {
    void pollAll().then((snapshots) => sendResponse({ snapshots }));
    return true; // keeps the channel open so the async sendResponse above actually works
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

  // fire-and-forget - a dead backend shouldn't hold up the badge/alerts above
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
