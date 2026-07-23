import { getAllSnapshots } from "../lib/storage.js";
import type { SnapshotMap } from "../lib/storage.js";
import { CHECK_NOW_MESSAGE } from "../lib/messages.js";
import type { CheckNowResponse } from "../lib/messages.js";

function barColor(pct: number): string {
  if (pct >= 80) return "#e03131";
  if (pct >= 50) return "#f59f00";
  return "#2f9e44";
}

// label/error ultimately trace back to Claude's own API response — trusted
// today, but this is rendered via innerHTML, so escape it anyway rather than
// assume that trust boundary never changes.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(snapshots: SnapshotMap): void {
  const limitsEl = document.getElementById("limits")!;
  const statusEl = document.getElementById("status")!;
  const claude = snapshots.claude;

  if (!claude) {
    limitsEl.innerHTML = `<em style="font-size:12px;color:#999;">No data yet — waiting for first check.</em>`;
    statusEl.textContent = "";
    return;
  }

  if (!claude.ok) {
    limitsEl.innerHTML = `<em style="font-size:12px;color:#e03131;">${escapeHtml(claude.error ?? "Read failed")}</em>`;
    statusEl.textContent = "";
    return;
  }

  limitsEl.innerHTML = claude.limits
    .map(
      (l) => `
      <div class="limit-row">
        <div class="limit-label"><span>${escapeHtml(l.label)}</span><span>${Math.round(l.usedPct)}%</span></div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${l.usedPct}%;background:${barColor(l.usedPct)}"></div>
        </div>
      </div>`
    )
    .join("");

  statusEl.textContent = `Last checked ${new Date(claude.fetchedAt).toLocaleTimeString()}`;
}

async function checkNow(): Promise<void> {
  const statusEl = document.getElementById("status")!;
  const button = document.getElementById("check-now") as HTMLButtonElement;
  button.disabled = true;
  statusEl.textContent = "Checking…";

  const response = (await chrome.runtime.sendMessage({ type: CHECK_NOW_MESSAGE })) as CheckNowResponse;
  const claude = response.snapshots.find((s) => s.provider === "claude");
  render(claude ? { claude } : {});

  button.disabled = false;
}

document.getElementById("check-now")!.addEventListener("click", () => void checkNow());

// Show whatever's cached instantly (fast paint, works even if the network
// check that follows is slow or fails), then trigger a fresh check right
// away — opening the popup is itself the "human-initiated" read, per the
// human-initiated-default design (background polling is opt-in only).
async function init(): Promise<void> {
  render(await getAllSnapshots());
  void checkNow();
}

void init();
