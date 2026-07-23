const PROVIDER = "claude";
const REFRESH_MS = 30_000;

function barColor(pct) {
  if (pct >= 80) return "#e03131";
  if (pct >= 50) return "#f59f00";
  return "#2f9e44";
}

// no auth on POST /snapshots means label/error could be anything - escape before innerHTML
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadLatest() {
  const limitsEl = document.getElementById("limits");
  const statusEl = document.getElementById("status");

  const res = await fetch(`/snapshots/latest?provider=${PROVIDER}`);
  const snapshot = await res.json();

  if (!snapshot) {
    limitsEl.innerHTML = `<em style="font-size:13px;color:#999;">No data yet — waiting for the extension's first push.</em>`;
    statusEl.textContent = "";
    return;
  }

  if (!snapshot.ok) {
    limitsEl.innerHTML = `<em style="font-size:13px;color:#e03131;">${escapeHtml(snapshot.error ?? "Read failed")}</em>`;
    statusEl.textContent = "";
    return;
  }

  limitsEl.innerHTML = snapshot.limits
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

  statusEl.textContent = `Last checked ${new Date(snapshot.fetchedAt).toLocaleString()}`;
}

async function loadHistory() {
  const body = document.getElementById("history-body");
  const res = await fetch(`/snapshots/history?provider=${PROVIDER}&limit=50`);
  const snapshots = await res.json();

  body.innerHTML = snapshots
    .map((s) => {
      const session = s.limits.find((l) => l.type === "session");
      const weekly = s.limits.find((l) => l.type === "weekly");
      const time = new Date(s.fetchedAt).toLocaleString();
      return `<tr>
        <td>${time}</td>
        <td>${session ? Math.round(session.usedPct) + "%" : "—"}</td>
        <td>${weekly ? Math.round(weekly.usedPct) + "%" : "—"}</td>
      </tr>`;
    })
    .join("");
}

async function refresh() {
  await Promise.all([loadLatest(), loadHistory()]);
}

void refresh();
setInterval(() => void refresh(), REFRESH_MS);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // meh, dashboard still works without it
    });
  });
}
