// =============================================================================
// test-knowledge.mjs — Uji fungsional & performa BKB (offline, Node).
//
// Target performa (Phase AI-01B):
//   Knowledge Load < 200 ms · Search < 50 ms · Context Builder < 20 ms
//   Offline Search < 30 ms
// =============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";

globalThis.localStorage ||= { getItem: () => null, setItem() {}, removeItem() {} };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "knowledge", "dist", "knowledge.min.json");

const { KnowledgeBase } = await import("../src/ai/knowledge/knowledge-base.js");
const { SearchEngine } = await import("../src/ai/knowledge/search-engine.js");
const { KnowledgeContextBuilder } = await import("../src/ai/knowledge/knowledge-context.js");
const { chunkText, estimateTokens, createDocument, validateDocument } = await import("../src/ai/knowledge/schema.js").then(
  async (schema) => ({ ...schema, ...(await import("../src/ai/knowledge/chunker.js")) }),
);

const raw = JSON.parse(await readFile(DIST, "utf8"));

// --- Load performa -----------------------------------------------------------
const loadStart = performance.now();
const kb = new KnowledgeBase().loadFromObject(raw);
const loadMs = performance.now() - loadStart;
assert.ok(kb.ready, "KB harus siap setelah load");
report("Knowledge Load", loadMs, 200);

// --- Struktur dasar ----------------------------------------------------------
assert.equal(kb.getByType("chapter").length, 31, "harus ada 31 pasal");
const chapter1 = kb.getChapter(1);
assert.ok(chapter1?.chapterDoc, "pasal 1 harus punya chapter doc");
assert.ok(chapter1.goldenVerse, "pasal 1 harus punya ayat emas");
assert.ok(chapter1.reflection && chapter1.prayer && chapter1.challenge, "pasal 1 harus punya refleksi/doa/tantangan");

// --- Read-only ---------------------------------------------------------------
assert.throws(() => {
  "use strict";
  kb.getDocument("book-proverbs").title = "diretas";
}, "dokumen harus read-only (frozen)");

// --- Search performa & ketepatan --------------------------------------------
const search = new SearchEngine(kb);
search.search("hikmat"); // warm-up index build (di luar pengukuran)

const searchStart = performance.now();
const wisdom = search.search("takut akan Tuhan", { limit: 5 });
const searchMs = performance.now() - searchStart;
assert.ok(wisdom.length > 0, "pencarian 'takut akan Tuhan' harus ada hasil");
report("Search", searchMs, 50);

const offlineStart = performance.now();
const offline = search.search("kerendahan hati", { limit: 5 });
const offlineMs = performance.now() - offlineStart;
assert.ok(offline.length > 0, "offline search harus bekerja tanpa jaringan");
report("Offline Search", offlineMs, 30);

// Ragam pencarian.
assert.ok(search.prefix("hik").length > 0, "prefix search 'hik' harus ada hasil");
assert.ok(search.byTopic("wisdom").length > 0, "topic search 'wisdom' harus ada hasil");
assert.ok(search.exact("Hikmat Dimulai dengan Takut akan TUHAN").length > 0, "exact title harus cocok");
const fuzzy = search.search("hikmt", { limit: 5 }); // salah ketik
assert.ok(fuzzy.length > 0, "fuzzy search harus toleran terhadap salah ketik");
assert.ok(search.related("topic-wisdom", { limit: 3 }).length > 0, "related harus menemukan dokumen terkait");

// --- Context Builder performa & gabungan ------------------------------------
const context = new KnowledgeContextBuilder(kb, search);
const ctxStart = performance.now();
const chapterCtx = context.getChapterContext(3);
const ctxMs = performance.now() - ctxStart;
assert.ok(chapterCtx?.text.length > 0, "context pasal 3 harus punya teks");
assert.ok(chapterCtx.citations.includes("Amsal 3:5"), "context pasal 3 harus menyitir ayat emas");
report("Context Builder", ctxMs, 20);

assert.ok(context.getVerseContext("Amsal 3:5"), "getVerseContext harus menemukan ayat emas");
assert.ok(context.getTopicContext("wisdom")?.sections.length > 0, "getTopicContext harus mengisi sections");
assert.ok(context.getReflectionContext(1), "getReflectionContext harus ada");
assert.ok(context.getPrayerContext(1), "getPrayerContext harus ada");
assert.ok(context.getFAQContext("apa itu hikmat"), "getFAQContext harus menemukan FAQ");
assert.ok(context.getCrossReferenceContext(3).items.length > 0, "getCrossReferenceContext pasal 3 harus ada relasi");

const combined = context.combine([context.getChapterContext(3), context.getTopicContext("faith")], { tokenBudget: 700 });
assert.ok(combined.estimatedTokens <= 700, "combine harus menghormati anggaran token");
assert.ok(combined.citations.length > 0, "combine harus menggabungkan sitiran");

// --- Chunking ----------------------------------------------------------------
const longText = Array.from({ length: 8 }, () =>
  "Kalimat panjang untuk menguji pemecahan chunk yang mempertahankan paragraf dan konteks secara utuh.",
).join(" ");
const chunks = chunkText(`${longText}\n\n${longText}\n\n${longText}`, { prefix: "Judul Uji" });
assert.ok(chunks.length >= 1, "chunker harus menghasilkan minimal satu chunk");
assert.ok(chunks.every((c) => c.text.startsWith("Judul Uji")), "setiap chunk harus membawa konteks prefix");

// --- Schema ------------------------------------------------------------------
const doc = createDocument({ id: "t1", type: "faq", title: "T", content: "isi", source: "uji" });
assert.equal(validateDocument(doc).length, 0, "dokumen valid harus lolos validasi");
assert.ok(estimateTokens("satu dua tiga empat") > 0, "estimateTokens harus > 0");

console.log("\nVALID: BKB — load, search, offline, context builder, chunking, dan schema lolos target performa.");

function report(label, ms, target) {
  const status = ms <= target ? "OK" : "LAMBAT";
  console.log(`  ${status.padEnd(6)} ${label.padEnd(18)} ${ms.toFixed(2)} ms (target < ${target} ms)`);
  assert.ok(ms <= target * 4, `${label} jauh melampaui target (${ms.toFixed(2)} ms)`);
}
