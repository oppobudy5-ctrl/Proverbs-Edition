/* Bible Time — Service Worker
   Strategi:
   - HTML, JS, CSS, data/*.js  -> network-first (update kode langsung tampil)
   - Aset lain (ikon, gambar)  -> cache-first (cepat & hemat data)
   - Font Google               -> stale-while-revalidate
   - Audio (Range req)         -> bypass (browser handle native streaming)
   - Proxy teks /bible/*        -> selalu jaringan (tidak di-cache)
*/
const VERSION = "bibletime-v8-cil-ci01";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon-180.png",
  "./data/schedule.js",
  "./data/content.js",
  "./data/proverbs/part-01.js",
  "./data/proverbs/part-02.js",
  "./data/proverbs/part-03.js",
  "./data/proverbs/part-04.js",
  "./js/main.js",
  "./js/router.js",
  "./js/date-helper.js",
  "./js/plan.js",
  "./js/store.js",
  "./js/versions.js",
  "./js/dom.js",
  "./js/bible-api.js",
  "./js/search.js",
  "./js/safe-store.js",
  "./js/theme.js",
  "./js/settings.js",
  "./js/a11y.js",
  "./js/lifecycle.js",
  "./js/progress.js",
  "./js/bookmark.js",
  "./js/favorites.js",
  "./js/journal.js",
  "./js/journal/schema.js",
  "./js/journal/store.js",
  "./js/journal/idb.js",
  "./js/journal/consent.js",
  "./js/journal/search.js",
  "./js/journal/tags.js",
  "./js/journal/export.js",
  "./js/journal/import.js",
  "./js/journal/insights.js",
  "./js/journal/timeline.js",
  "./js/journal/analytics.js",
  "./js/journal/crypto.js",
  "./js/history.js",
  "./js/achievement.js",
  "./js/reading-time.js",
  "./js/complete.js",
  "./js/ui/version-dropdown.js",
  "./js/ui/reader.js",
  "./js/ui/quiz.js",
  "./js/ui/streak.js",
  "./js/ui/hero-title.js",
  "./js/ui/day.js",
  "./js/ui/calendar.js",
  "./js/ui/about.js",
  "./js/ui/bgm.js",
  "./js/ui/settings-panel.js",
  "./js/ui/celebrate.js",
  "./js/ui/day-runtime.js",
  "./js/ui/dashboard.js",
  "./js/ui/library.js",
  "./js/ui/continue-card.js",
  "./js/ui/offline.js",
  "./js/ui/journal-box.js",
  "./js/ui/journal-editor.js",
  "./js/ui/ai-reflection-panel.js",
  "./js/ui/journal-insights.js",
  "./js/ui/growth-timeline.js",
  "./js/ui/save-actions.js",
  "./config/ai.config.js",
  "./src/ai/ai-service.js",
  "./src/ai/ai-controller.js",
  "./src/ai/prompt-builder.js",
  "./src/ai/context-builder.js",
  "./src/ai/retrieval-engine.js",
  "./src/ai/semantic-index.js",
  "./src/ai/conversation-store.js",
  "./src/ai/ai-settings.js",
  "./src/ai/ai-cache.js",
  "./src/ai/ai-utils.js",
  "./src/ai/providers/provider-base.js",
  "./src/ai/providers/openai-provider.js",
  "./src/ai/providers/gemini-provider.js",
  "./src/ai/providers/claude-provider.js",
  "./src/ai/providers/ollama-provider.js",
  "./src/ai/providers/mock-provider.js",
  "./src/ai/prompts/summary.prompt.js",
  "./src/ai/prompts/qa.prompt.js",
  "./src/ai/prompts/reflection.prompt.js",
  "./src/ai/prompts/journal-reflection.prompt.js",
  "./src/ai/prompts/wisdom.prompt.js",
  "./src/ai/prompts/search.prompt.js",
  "./src/ai/types/ai-message.js",
  "./src/ai/types/ai-context.js",
  "./src/ai/types/ai-response.js",
  "./src/ai/cil/index.js",
  "./src/ai/cil/gateway.js",
  "./src/ai/cil/canonical-context.js",
  "./src/ai/cil/compatibility-adapter.js",
  "./src/ai/cil/citation-engine.js",
  "./src/ai/cil/confidence.js",
  "./src/ai/cil/theological-guardrails.js",
  "./src/ai/cil/engines/canonical-engine.js",
  "./src/ai/cil/engines/topic-engine.js",
  "./src/ai/cil/engines/relationship-engine.js",
  "./src/ai/cil/engines/knowledge-graph-engine.js",
  "./src/ai/cil/engines/doctrine-engine.js",
  "./src/ai/cil/engines/character-engine.js",
  "./src/ai/cil/engines/timeline-engine.js",
  "./src/ai/cil/engines/symbol-engine.js",
  "./src/ai/cil/engines/wisdom-engine.js",
  "./src/ai/cil/engines/application-engine.js",
  "./src/ai/knowledge/index.js",
  "./src/ai/knowledge/schema.js",
  "./src/ai/knowledge/chunker.js",
  "./src/ai/knowledge/knowledge-base.js",
  "./src/ai/knowledge/search-engine.js",
  "./src/ai/knowledge/knowledge-context.js",
  "./src/ai/knowledge/query-analyzer.js",
  "./src/ai/knowledge/knowledge-graph.js",
  "./src/ai/knowledge/semantic-search.js",
  "./src/ai/search-prefs.js",
  "./src/ai/search-analytics.js",
  "./js/ui/semantic-search-ui.js",
  "./knowledge/dist/knowledge.min.json",
  "./knowledge/dist/search-index.json",
  "./knowledge/dist/canon-index.json",
  "./knowledge/dist/reference-index.json",
  "./knowledge/dist/doctrine-index.json",
  "./knowledge/dist/character-index.json",
  "./knowledge/dist/timeline-index.json",
  "./knowledge/dist/symbol-index.json",
  "./knowledge/dist/wisdom-index.json",
  "./knowledge/dist/application-index.json",
  "./knowledge/dist/graph-nodes.json",
  "./knowledge/dist/graph-edges.json",
  "./knowledge/dist/manifest.json",
  "./knowledge/situations/situations.json",
  "./knowledge/synonyms/synonyms.json",
];
const OPTIONAL_ASSETS = [
  "./assets/audio/bgm.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(APP_SHELL);
    await Promise.all(OPTIONAL_ASSETS.map((url) => cache.add(url).catch(() => {})));
    return self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.headers.get("range")) return; // audio/video streaming — biar browser handle

  const url = new URL(req.url);
  // Teks Alkitab paralel (proxy ke API eksternal) — selalu ambil dari jaringan
  if (url.pathname.startsWith("/bible/") || url.pathname.startsWith("/api/ai/")) return;

  const isSameOrigin = url.origin === self.location.origin;
  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  const isCode = isSameOrigin && /\.(js|css)(\?|$)/.test(url.pathname);
  const isFont = url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com");

  if (isHTML || isCode) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (isFont) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (isSameOrigin) {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(VERSION);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return caches.match("./index.html");
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    const cache = await caches.open(VERSION);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    return caches.match("./index.html");
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => { cache.put(req, res.clone()); return res; }).catch(() => null);
  return cached || network;
}
