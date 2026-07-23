import { getAllSnapshots } from "../lib/storage.js";

function barColor(pct: number): string {
  if (pct >= 80) return "#e03131";
  if (pct >= 50) return "#f59f00";
  return "#2f9e44";
}

async function render(): Promise<void> {
  const limitsEl = document.getElementById("limits")!;
  const statusEl = document.getElementById("status")!;
  const snapshots = await getAllSnapshots();
  const claude = snapshots.claude;

  if (!claude) {
    limitsEl.innerHTML = `<em style="font-size:12px;color:#999;">No data yet — waiting for first read.</em>`;
    return;
  }

  if (!claude.ok) {
    limitsEl.innerHTML = `<em style="font-size:12px;color:#e03131;">${claude.error ?? "Read failed"}</em>`;
    return;
  }

  limitsEl.innerHTML = claude.limits
    .map(
      (l) => `
      <div class="limit-row">
        <div class="limit-label"><span>${l.label}</span><span>${Math.round(l.usedPct)}%</span></div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${l.usedPct}%;background:${barColor(l.usedPct)}"></div>
        </div>
      </div>`
    )
    .join("");

  statusEl.textContent = `Updated ${new Date(claude.fetchedAt).toLocaleTimeString()}`;
}

void render();
