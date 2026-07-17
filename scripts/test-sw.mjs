import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const swSource = await readFile(path.join(ROOT, "sw.js"), "utf8");

assert.match(swSource, /const CACHE_VERSION\s*=/, "harus punya CACHE_VERSION tunggal");
assert.match(swSource, /const CACHE_STATIC\s*=/, "harus punya CACHE_STATIC");
assert.match(swSource, /bibletime-v9-sw-pr002/, "cache version PR-002 harus di-bump");

assert.doesNotMatch(
  swSource,
  /cache\.addAll\(\s*APP_SHELL\s*\)/,
  "APP_SHELL tidak boleh memakai cache.addAll all-or-nothing",
);
assert.match(swSource, /precacheUrls|cache\.add\(url\)/, "install harus precache toleran per-asset");

assert.match(swSource, /fresh\.ok|res\.ok|response\.ok/, "write cache wajib cek response.ok");
assert.match(swSource, /mode === ["']navigate["']/, "fallback HTML hanya untuk navigate");
assert.match(swSource, /Response\.error\(\)/, "non-navigate offline harus Response.error");

assert.match(swSource, /\/api\/ai\//, "AI API harus di-bypass dari cache");
assert.match(swSource, /\/bible\//, "bible proxy harus di-bypass dari cache");

// Simulasikan helper logic yang sama dengan SW (tanpa browser Cache API).
function putIfOk(store, key, res) {
  if (!res || !res.ok) return false;
  store.set(key, { status: res.status, body: res.body });
  return true;
}

function offlineFallback(req, store) {
  if (store.has(req.url)) return store.get(req.url);
  if (req.mode === "navigate" && store.has("./index.html")) return store.get("./index.html");
  return { type: "error" };
}

const store = new Map();
store.set("./index.html", { status: 200, body: "<html></html>" });
store.set("./app.js", { status: 200, body: "console.log(1)" });

assert.equal(putIfOk(store, "./x.js", { ok: false, status: 500, body: "err" }), false);
assert.equal(store.has("./x.js"), false, "500 tidak boleh masuk cache");

assert.equal(putIfOk(store, "./x.js", { ok: true, status: 200, body: "ok" }), true);
assert.equal(store.get("./x.js").body, "ok");

const htmlFallback = offlineFallback({ mode: "navigate", url: "./missing" }, store);
assert.equal(htmlFallback.body, "<html></html>");

const jsFallback = offlineFallback({ mode: "cors", url: "./missing.js" }, store);
assert.equal(jsFallback.type, "error", "JS miss tidak boleh dapat index.html");

console.log("VALID: Service Worker reliability — versioning, ok-only cache, MIME-safe fallback, tolerant install.");
