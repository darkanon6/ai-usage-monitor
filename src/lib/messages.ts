// shared between popup.ts (sender) and worker.ts (receiver) - a popup-open
// check goes through the worker's one pipeline instead of duplicating it
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
