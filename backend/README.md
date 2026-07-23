# AI Usage Monitor — Backend

A small self-hosted receiver + dashboard for the snapshots the extension
already collects. Run it on your own hardware — **LAN-only, no auth**, meant
to sit on your home network, not be exposed to the internet.

## Run it (Docker)

```bash
cd backend
docker compose up -d --build
```

That builds the image, starts the container, and persists data to
`backend/data/usage.db` on the host (bind-mounted, survives container
recreation). Check it came up:

```bash
docker compose logs -f
curl http://localhost:3000/snapshots/latest
```

Default port is `3000` — change the host side of the `ports:` mapping in
`docker-compose.yml` if that's taken on your server.

## Point the extension at it

1. Find your server's LAN IP (e.g. `192.168.1.50`) — same address other
   devices on your network would use to reach it.
2. Open the extension's options page → **Self-hosted dashboard** → set
   **Backend URL** to `http://<that-ip>:3000` → Save.
3. Chrome will prompt for permission to reach that address (the extension
   doesn't request broad host access up front — only for what you configure
   here). Approve it.
4. Every 5-minute poll now also pushes the snapshot to the backend,
   fire-and-forget — a slow/unreachable backend never blocks the badge or
   alerts.

## View the dashboard

Visit `http://<server-ip>:3000` from any device on the same network —
phone, laptop, whatever. It's a PWA: on a phone browser, use "Add to Home
Screen" for an app-like icon and full-screen view.

## API

| Method | Path | Notes |
|---|---|---|
| `POST` | `/snapshots` | Body: a `UsageSnapshot` (see `src/types.ts`). Returns `201`, or `400` if the body doesn't look like one. |
| `GET` | `/snapshots/latest?provider=claude` | Latest snapshot for that provider, or `null`. Omit `provider` to get the latest per provider as an array. |
| `GET` | `/snapshots/history?provider=claude&limit=200` | Up to `limit` (max 1000) past snapshots, newest first. |

Everything else under `/` serves the dashboard's static files (`public/`).

## Local development (without Docker)

```bash
npm install
npm run build
npm start        # PORT, DATA_DIR, PUBLIC_DIR env vars all have sane defaults
npm test         # node:test — db.ts (in-memory SQLite) + server.ts (real HTTP, ephemeral port)
```

## Why no auth

This only listens on your LAN and stores nothing more sensitive than Claude
usage percentages. If you ever want it reachable from outside your home
network, add authentication (a shared-secret header checked in `server.ts`
is the smallest addition) before doing so — don't port-forward this as-is.

## Why hand-rolled HTTP instead of Express/Fastify

Same reasoning as the extension itself (see the root `CLAUDE_CODE_HANDOFF.md`):
three routes plus static file serving doesn't need a framework. The one
real dependency is `better-sqlite3` (native binding, prebuilt binaries for
common platforms) — chosen over a hand-rolled file store because SQL makes
`getLatestAll()` and `getHistory()` trivial instead of hand-written file
parsing.
