import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = new EventTarget();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { AILogger } = await import("../src/ai/ai-utils.js");
AILogger.setMode("production");
const { AIService, AI_SERVICE_STATUS } = await import("../src/ai/ai-service.js");

const REQUIRED_FIELDS = [
  "success",
  "status",
  "provider",
  "source",
  "citation",
  "citations",
  "content",
  "metadata",
  "error",
  "timestamp",
];

function assertEnvelope(response, { success = true, method } = {}) {
  assert.equal(typeof response, "object");
  REQUIRED_FIELDS.forEach((field) => assert.ok(field in response, `response harus punya ${field}`));
  assert.equal(response.success, success);
  assert.equal(response.status, success ? AI_SERVICE_STATUS.SUCCESS : response.status);
  assert.equal(response.metadata.method, method);
  assert.ok(Array.isArray(response.citations));
  assert.equal(typeof response.content, "string");
  assert.ok(Number.isFinite(Date.parse(response.timestamp)));
  if (success) assert.equal(response.error, null);
  else assert.ok(response.error?.code);
}

const common = { day: 1, chapter: 1, book: "Amsal", cache: false, persist: false };

const ask = await AIService.ask("Apa dasar hikmat?", common);
assertEnvelope(ask, { method: "ask" });
assert.equal(ask.provider, "mock");

const summary = await AIService.summary(common);
assertEnvelope(summary, { method: "summary" });

const summaryAlias = await AIService.summarize(common);
assertEnvelope(summaryAlias, { method: "summary" });

const reflect = await AIService.reflect(common);
assertEnvelope(reflect, { method: "reflect" });

const review = await AIService.review({ ...common, text: "Tinjau refleksi ini — pasal ini mengajarkan takut akan Tuhan." });
assertEnvelope(review, { method: "review" });
// Phase 004: structured review output
assert.ok("review" in review, "review response harus punya field review terstruktur");
if (review.review) {
  const ro = review.review;
  ["summary", "strengths", "missing_points", "application", "cross_references",
   "themes", "encouragement", "prayer", "next_step", "reflection_question",
   "confidence", "citations", "provider", "timestamp", "canonical_only"].forEach((f) => {
    assert.ok(f in ro, `review output harus punya field ${f}`);
  });
  assert.ok(Array.isArray(ro.strengths));
  assert.ok(Array.isArray(ro.cross_references));
  assert.ok(Array.isArray(ro.themes));
  assert.ok(Array.isArray(ro.citations));
  assert.ok(Number.isFinite(ro.confidence));
  assert.ok(typeof ro.canonical_only === "boolean");
}

const mentor = await AIService.mentor({ ...common, text: "Saya ingin menerapkan hikmat ini dalam keputusan harian." });
assertEnvelope(mentor, { method: "mentor" });
assert.ok("review" in mentor, "mentor response harus punya field review");

const search = await AIService.search("takut akan Tuhan", common);
assertEnvelope(search, { method: "search" });

const explain = await AIService.explain("Jelaskan takut akan Tuhan.", common);
assertEnvelope(explain, { method: "explain" });

const wisdom = await AIService.wisdom(common);
assertEnvelope(wisdom, { method: "wisdom" });

const crossReference = await AIService.crossReference(common);
assertEnvelope(crossReference, { method: "crossReference" });
assert.ok(Array.isArray(crossReference.crossrefs));

const books = await AIService.books();
assertEnvelope(books, { method: "books" });
assert.equal(books.books.length, 66);

const book = await AIService.book("Mazmur");
assertEnvelope(book, { method: "book" });
assert.equal(book.book.slug, "psalms");

const companion = await AIService.companion({ ...common, book: "proverbs", llmEnabled: false });
assertEnvelope(companion, { method: "companion" });
assert.ok(companion.companion);
assert.equal(companion.companion.book.slug, "proverbs");

const semantic = await AIService.semanticSearch("hikmat dalam keputusan", { remember: false });
assertEnvelope(semantic, { method: "semanticSearch" });
assert.ok(Array.isArray(semantic.results), "field hasil lama tetap kompatibel");

const canonical = await AIService.buildCanonicalContext(common);
assertEnvelope(canonical, { method: "buildCanonicalContext" });
assert.ok(Array.isArray(canonical.crossrefs), "field CIL lama tetap kompatibel");

const invalid = await AIService.ask("");
assertEnvelope(invalid, { success: false, method: "ask" });
assert.equal(invalid.error.code, "INVALID_REQUEST");

const prayer = await AIService.prayer();
assertEnvelope(prayer, { success: false, method: "prayer" });
assert.equal(prayer.status, AI_SERVICE_STATUS.NOT_IMPLEMENTED);
assert.equal(prayer.error.code, "NOT_IMPLEMENTED");

// UI hanya boleh mengakses AI melalui AIService.
const uiFiles = [
  "js/ui/ai-lesson-assist.js",
  "js/ui/ai-reflection-panel.js",
  "js/ui/semantic-search-ui.js",
];
for (const relative of uiFiles) {
  const source = await readFile(path.join(ROOT, relative), "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["'][^"']*(?:ai-controller|cil\/gateway|prompt-builder|providers\/)[^"']*["']/,
    `${relative} tidak boleh import engine/provider langsung`,
  );
  assert.match(source, /AIService/, `${relative} harus memakai AIService`);
}

console.log("VALID: unified AIService contract, safe errors, all existing engines, and UI boundary pass.");
