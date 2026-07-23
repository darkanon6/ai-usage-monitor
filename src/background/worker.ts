import { claudeReader } from "../providers/claude.js";
import { saveSnapshot } from "../lib/storage.js";
import { getSettings } from "../lib/settings.js";
import { checkAndFireAlerts } from "../lib/alerts.js";
import { pushSnapshot } from "../lib/backend.js";
import type { UsageSnapshot } from "../providers/types.js";

const ALARM_NAME = "usage-poll";
const POLL_MINUTES = 5;

// MV3 service workers are ephemeral — never use setInterval here.
// chrome.alarms is what survives the worker being killed and restarted.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
  void pollAll(); // run once immediately on install, don't wait for first alarm
});

chrome.runtime.onStartup.addListener(() => {
  void pollAll();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    void pollAll();
  }
});

async function pollAll(): Promise<void> {
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
