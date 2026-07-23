import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStore, rowToSnapshot, type SnapshotStore } from "./db.js";
import type { UsageSnapshot, UsageLimit } from "./types.js";

const MAX_BODY_BYTES = 64 * 1024; // a real snapshot is a few hundred bytes; this is generous headroom

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

class BodyTooLargeError extends Error {}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > MAX_BODY_BYTES) {
      throw new BodyTooLargeError("request body too large");
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const VALID_PROVIDERS = new Set(["claude", "chatgpt", "gemini"]);
const VALID_LIMIT_TYPES = new Set(["session", "weekly", "daily", "per_model"]);
const MAX_STRING_FIELD_LENGTH = 500; // generous for a label/error message, not for injected payloads

function isUsageLimit(value: unknown): value is UsageLimit {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === "string" &&
    VALID_LIMIT_TYPES.has(v.type) &&
    typeof v.label === "string" &&
    v.label.length <= MAX_STRING_FIELD_LENGTH &&
    typeof v.usedPct === "number" &&
    Number.isFinite(v.usedPct) &&
    (v.resetsAt === null || typeof v.resetsAt === "string") &&
    (v.model === undefined || typeof v.model === "string")
  );
}

// strict on purpose - no auth on this endpoint so this is the only real gate.
// doesn't stop XSS by itself though (a valid string can still be markup),
// that's handled by escaping on the render side (app.js/popup.ts)
function isUsageSnapshot(value: unknown): value is UsageSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.provider === "string" &&
    VALID_PROVIDERS.has(v.provider) &&
    typeof v.fetchedAt === "string" &&
    typeof v.ok === "boolean" &&
    Array.isArray(v.limits) &&
    v.limits.length <= 50 &&
    v.limits.every(isUsageLimit) &&
    (v.error === undefined || (typeof v.error === "string" && v.error.length <= MAX_STRING_FIELD_LENGTH))
  );
}

function serveStatic(res: http.ServerResponse, publicDir: string, pathname: string): boolean {
  const relative = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, relative));
  const publicDirWithSep = publicDir.endsWith(path.sep) ? publicDir : publicDir + path.sep;

  // need the trailing slash here or a sibling dir like publicDir+"-evil" would pass startsWith too
  if (filePath !== publicDir && !filePath.startsWith(publicDirWithSep)) {
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

// factory so tests can spin up a real server on an ephemeral port
export function createServer(store: SnapshotStore, publicDir: string): http.Server {
  return http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      try {
        if (req.method === "POST" && url.pathname === "/snapshots") {
          // stops a CSRF trick: text/plain skips CORS preflight so a random
          // page you visit could blind-POST here otherwise. requiring real
          // JSON forces the preflight, which this server never approves
          const contentType = req.headers["content-type"] ?? "";
          if (!contentType.toLowerCase().includes("application/json")) {
            sendJson(res, 415, { error: "Content-Type must be application/json" });
            return;
          }

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
        if (err instanceof BodyTooLargeError) {
          sendJson(res, 413, { error: err.message });
          return;
        }
        if (err instanceof SyntaxError) {
          sendJson(res, 400, { error: "body is not valid JSON" });
          return;
        }
        // log it server-side, don't leak internals to the client
        console.error("Unhandled request error:", err);
        sendJson(res, 500, { error: "internal server error" });
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
