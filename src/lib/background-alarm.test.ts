import { test } from "node:test";
import assert from "node:assert/strict";
import { ALARM_NAME, POLL_MINUTES, syncBackgroundPollingAlarm } from "./background-alarm.js";

function installChromeAlarmsMock(): { created: unknown[]; cleared: string[] } {
  const created: unknown[] = [];
  const cleared: string[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    alarms: {
      create: async (name: string, info: unknown) => {
        created.push({ name, info });
      },
      clear: async (name: string) => {
        cleared.push(name);
      },
    },
  };
  return { created, cleared };
}

test("syncBackgroundPollingAlarm creates the alarm when enabled", async () => {
  const { created, cleared } = installChromeAlarmsMock();
  await syncBackgroundPollingAlarm(true);
  assert.deepEqual(created, [{ name: ALARM_NAME, info: { periodInMinutes: POLL_MINUTES } }]);
  assert.equal(cleared.length, 0);
});

test("syncBackgroundPollingAlarm clears the alarm when disabled", async () => {
  const { created, cleared } = installChromeAlarmsMock();
  await syncBackgroundPollingAlarm(false);
  assert.equal(created.length, 0);
  assert.deepEqual(cleared, [ALARM_NAME]);
});
