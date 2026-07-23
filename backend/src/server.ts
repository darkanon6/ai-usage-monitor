import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStore, rowToSnapshot, type SnapshotStore } from "./db.js";
import type { UsageSnapshot } from "./types.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function isUsageSnapshot(value: unknown): value is UsageSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.provider === "string" &&
    typeof v.fetchedAt === "string" &&
    typeof v.ok === "boolean" &&
    Array.isArray(v.limits)
  );
}

function serveStatic(res: http.ServerResponse, publicDir: string, pathname: string): boolean {
  const relative = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, relative));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end();
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// Factory rather than a top-level side effect so tests can spin up a server
// against an in-memory store + temp public dir on an ephemeral port.
export function createServer(store: SnapshotStore, publicDir: string): http.Server {
  return http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      try {
        if (req.method === "POST" && url.pathname === "/snapshots") {
          const body = await readBody(req);
          const parsed: unknown = JSON.parse(body);
          if (!isUsageSnapshot(parsed)) {
            sendJson(res, 400, { error: "body doesn't look like a UsageSnapshot" });
            return;
          }
          store.insertSnapshot(parsed);
          sendJson(res, 201, { ok: true });
          return;
        }

        if (req.method === "GET" && url.pathname === "/snapshots/latest") {
          const provider = url.searchParams.get("provider");
          if (provider) {
            const row = store.getLatest(provider);
            sendJson(res, 200, row ? rowToSnapshot(row) : null);
          } else {
            sendJson(res, 200, store.getLatestAll().map(rowToSnapshot));
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/snapshots/history") {
          const provider = url.searchParams.get("provider") ?? "claude";
          const limitParam = Number(url.searchParams.get("limit") ?? 200);
          const limit = Math.min(1000, Number.isFinite(limitParam) ? limitParam : 200);
          sendJson(res, 200, store.getHistory(provider, limit).map(rowToSnapshot));
          return;
        }

        if (req.method === "GET" && serveStatic(res, publicDir, url.pathname)) {
          return;
        }

        sendJson(res, 404, { error: "not found" });
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    })();
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const PORT = Number(process.env.PORT ?? 3000);
  const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  const PUBLIC_DIR = process.env.PUBLIC_DIR ?? path.join(process.cwd(), "public");

  const store = openStore(path.join(DATA_DIR, "usage.db"));
  const server = createServer(store, PUBLIC_DIR);

  server.listen(PORT, () => {
    console.log(`ai-usage-monitor backend listening on :${PORT} (data: ${DATA_DIR})`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => {
        store.close();
        process.exit(0);
      });
    });
  }
}
