import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { handleAiProxyRequest, publicAiConfig } from "./ai-proxy.mjs";

const ROOT = resolve(import.meta.dirname, "..");
loadDotEnv(resolve(ROOT, ".env"));
const PORT = Number(process.env.PORT) || 8080;
const BIBLE_API = "https://mayicu.id/api/alkitab/v1/";

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function sendFile(req, res, filePath) {
  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": filePath.endsWith(`${sep}sw.js`) ? "no-store" : "no-cache",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(filePath).pipe(res);
}

async function proxyBible(req, res, pathname, search) {
  try {
    const upstreamPath = pathname.slice("/bible/".length);
    const upstream = await fetch(BIBLE_API + upstreamPath + search, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await upstream.arrayBuffer();
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(Buffer.from(body));
  } catch {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Bible API tidak tersedia" }));
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function proxyAi(req, res, pathname) {
  const parts = pathname.replace(/^\/api\/ai\/?/, "").split("/").filter(Boolean);
  const head = parts[0] || "";

  if (head === "config" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(publicAiConfig()));
    return;
  }

  if (head === "health" && req.method === "GET") {
    const config = publicAiConfig();
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({
      ok: true,
      providers: config.providers,
      defaultProvider: config.defaultProvider,
      healthTimestamp: new Date().toISOString(),
    }));
    return;
  }

  const provider = head || "openai";
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const result = await handleAiProxyRequest({
    provider,
    method: req.method || "GET",
    body,
    signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 30000),
  });
  res.writeHead(result.status, result.headers);
  res.end(result.body);
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/bible/")) {
    await proxyBible(req, res, url.pathname, url.search);
    return;
  }
  if (url.pathname.startsWith("/api/ai")) {
    await proxyAi(req, res, url.pathname);
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  const candidate = resolve(ROOT, `.${pathname}`);
  if (!candidate.startsWith(ROOT + sep) && candidate !== ROOT) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const stats = statSync(candidate);
    if (stats.isFile()) {
      sendFile(req, res, candidate);
      return;
    }
    if (stats.isDirectory()) {
      const index = resolve(candidate, "index.html");
      if (statSync(index).isFile()) {
        sendFile(req, res, index);
        return;
      }
    }
  } catch {
    // SPA routes fall through to index.html.
  }

  sendFile(req, res, resolve(ROOT, "index.html"));
}).listen(PORT, () => {
  console.log(`Bible Time dev server: http://localhost:${PORT}`);
});

/** Minimal .env loader — does not override existing process.env values. */
function loadDotEnv(filePath) {
  try {
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
    }
  } catch {
    /* .env is optional */
  }
}
