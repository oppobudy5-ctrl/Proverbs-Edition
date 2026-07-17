import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
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

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/bible/")) {
    await proxyBible(req, res, url.pathname, url.search);
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
