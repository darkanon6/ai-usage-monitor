// Shared between popup.ts (sender) and background/worker.ts (receiver) so
// a manual or popup-open check funnels through the worker's single
// read -> save -> badge -> alerts -> backend-push pipeline, instead of the
// popup duplicating any of that itself.
import type { UsageSnapshot } from "../providers/types.js";

export const CHECK_NOW_MESSAGE = "CHECK_NOW";

export interface CheckNowRequest {
  type: typeof CHECK_NOW_MESSAGE;
}

export interface CheckNowResponse {
  snapshots: UsageSnapshot[];
}

export function isCheckNowRequest(message: unknown): message is CheckNowRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === CHECK_NOW_MESSAGE
  );
}
