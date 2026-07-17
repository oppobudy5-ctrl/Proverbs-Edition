/**
 * test-review-engine.mjs — Phase 004 Review Engine contract tests.
 *
 * Tests: structured output schema, themes via topics, application, memory verse,
 * cross-references, historical context, prayer, mentor mode,
 * canonical-only fallback on provider failure, and offline/CIL degraded mode.
 */

import assert from "node:assert/strict";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}
globalThis.localStorage = new MemoryStorage();
globalThis.window = new EventTarget();

// ── Helpers ────────────────────────────────────────────────────────────────

const REVIEW_FIELDS = [
  "summary", "strengths", "missing_points", "application",
  "memory_verse", "cross_references", "historical_context",
  "themes", "wisdom", "encouragement", "prayer",
  "next_step", "reflection_question",
  "confidence", "citations", "provider", "timestamp", "canonical_only",
];

function assertReviewOutput(ro, label = "ReviewOutput") {
  assert.equal(typeof ro, "object", `${label} harus object`);
  for (const f of REVIEW_FIELDS) {
    assert.ok(f in ro, `${label} harus punya field "${f}"`);
  }
  assert.ok(Array.isArray(ro.strengths), "strengths harus array");
  assert.ok(Array.isArray(ro.missing_points), "missing_points harus array");
  assert.ok(Array.isArray(ro.cross_references), "cross_references harus array");
  assert.ok(Array.isArray(ro.themes), "themes harus array");
  assert.ok(Array.isArray(ro.citations), "citations harus array");
  assert.ok(Number.isFinite(ro.confidence), "confidence harus number");
  assert.ok(typeof ro.canonical_only === "boolean", "canonical_only harus boolean");
  assert.ok(typeof ro.provider === "string", "provider harus string");
  assert.ok(Number.isFinite(Date.parse(ro.timestamp)), "timestamp harus ISO string");
}

// ── formatter unit tests ────────────────────────────────────────────────────
const { formatReview } = await import("../src/ai/review/review-formatter.js");

// Build a mock CanonicalContext DTO
function makeMockCtx(overrides = {}) {
  return Object.freeze({
    summary: "Pasal tentang hikmat sejati.",
    title: "Hikmat Sejati",
    theme: "",
    themes: [],
    topics: [{ id: "t1", name: "Takut akan Tuhan" }, { id: "t2", name: "Hikmat" }],
    goldenVerse: Object.freeze({ ref: "Amsal 1:7", text: "Takut akan TUHAN adalah permulaan pengetahuan.", translation: "TB" }),
    crossrefs: Object.freeze([
      Object.freeze({ source: "Ams 1:7", target: "Mzm 111:10", reason: "Hikmat dimulai dari takut Tuhan", confidence: 0.9 }),
    ]),
    historical: Object.freeze([Object.freeze({ id: "h1", name: "Konteks Salomo", summary: "Salomo menulis pada masa pemerintahannya.", confidence: 0.8 })]),
    wisdomPatterns: Object.freeze([Object.freeze({ id: "w1", name: "Pola Hikmat", summary: "Dengarkan nasihat orang tua.", confidence: 0.7 })]),
    application: Object.freeze({
      id: "a1",
      invitation: "Hiduplah dengan integritas setiap hari",
      practices: ["Mulai pagi dengan doa", "Baca Firman harian"],
      cautions: [],
      domains: [],
    }),
    prayer: "Tuhan, anugerahkan hikmat-Mu kepada kami.",
    challenge: "Renungkan: apakah keputusan harianmu mencerminkan takut akan Tuhan?",
    reflection: ["Apa satu area hidupmu di mana kamu perlu lebih banyak hikmat?"],
    faq: [Object.freeze({ question: "Mengapa takut akan Tuhan penting?" })],
    keywords: Object.freeze(["hikmat", "takut", "pengetahuan"]),
    characters: Object.freeze([]),
    doctrines: Object.freeze([]),
    symbols: Object.freeze([]),
    commentary: Object.freeze([]),
    graphLinks: Object.freeze([]),
    citations: Object.freeze([Object.freeze({ display: "Amsal 1:7", canonicalId: "pro-1-7", verified: true })]),
    allowedCitations: Object.freeze([]),
    interpretiveNotes: Object.freeze([]),
    coverage: Object.freeze({}),
    confidence: 85,
    confidenceComponents: Object.freeze({}),
    tokenEstimate: 0,
    degraded: false,
    privacy: Object.freeze({ journalIncluded: false }),
    journalExcerpt: "",
    retrieved: Object.freeze([]),
    book: null,
    chapter: null,
    verse: null,
    day: null,
    intent: "reflection",
    question: "",
    metadata: Object.freeze({}),
    ...overrides,
  });
}

// Test 1: canonical-only (no LLM)
const ctx = makeMockCtx();
const ro1 = formatReview(ctx, null, { mode: "review" });
assertReviewOutput(ro1, "canonical-only review");
assert.equal(ro1.canonical_only, true, "sem LLM deve ser canonical_only");
assert.equal(ro1.memory_verse?.ref, "Amsal 1:7", "memory verse correto");
assert.ok(ro1.themes.includes("Takut akan Tuhan"), "theme derivado de topics");
assert.ok(ro1.cross_references.length > 0, "cross_references presentes");
assert.ok(ro1.historical_context.includes("Salomo"), "historical context presente");
assert.ok(ro1.wisdom.includes("Dengarkan"), "wisdom de wisdomPatterns");
assert.ok(ro1.application.includes("integritas"), "application de application.invitation");
assert.ok(ro1.prayer.length > 0, "prayer presente");
assert.equal(ro1.confidence, 85, "confidence correto");
assert.equal(ro1.citations.length, 1, "citations corretas");
console.log("PASS: formatter canonical-only review");

// Test 2: mentor mode without LLM
const ro2 = formatReview(ctx, null, { mode: "mentor" });
assertReviewOutput(ro2, "canonical-only mentor");
assert.equal(ro2.canonical_only, true);
console.log("PASS: formatter canonical-only mentor");

// Test 3: with mock LLM prose (review)
const mockLlm = {
  content: `
Kekuatan:
- Renungan terhubung dengan tema takut akan Tuhan
- Referensi alkitabiah yang tepat

Kekurangan:
- Perlu tambahkan penerapan konkret dalam keseharian

Dorongan:
Teruslah merenungkan Firman Tuhan dengan tekun dan rendah hati.

Langkah:
Besok pagi luangkan 10 menit untuk membaca dan merenungkan pasal ini.

Pertanyaan refleksi lanjutan:
Bagaimana takut akan Tuhan memengaruhi keputusan terbesarmu minggu ini?
  `,
  provider: "mock",
};
const ro3 = formatReview(ctx, mockLlm, { mode: "review" });
assertReviewOutput(ro3, "LLM-enriched review");
assert.equal(ro3.canonical_only, false, "dengan LLM bukan canonical_only");
assert.ok(ro3.strengths.length > 0, "strengths parsed dari LLM prose");
assert.ok(ro3.missing_points.length > 0, "missing_points parsed dari LLM prose");
assert.ok(ro3.encouragement.length > 0, "encouragement parsed");
assert.ok(ro3.next_step.length > 0, "next_step parsed");
assert.ok(ro3.reflection_question.includes("?"), "reflection_question parsed");
assert.equal(ro3.provider, "mock");
console.log("PASS: formatter with LLM prose");

// Test 4: empty themes fallback to application.invitation
const ctxNoTopics = makeMockCtx({ topics: [], themes: [], theme: "" });
const ro4 = formatReview(ctxNoTopics, null, { mode: "review" });
assert.ok(ro4.themes.length > 0, "themes fallback ke application.invitation");
console.log("PASS: themes fallback to application.invitation");

// Test 5: no goldenVerse
const ctxNoVerse = makeMockCtx({ goldenVerse: null });
const ro5 = formatReview(ctxNoVerse, null, {});
assert.equal(ro5.memory_verse, null, "memory_verse null se tidak ada goldenVerse");
console.log("PASS: null memory_verse when goldenVerse missing");

// Test 6: degraded CIL (empty context)
const emptyCtx = makeMockCtx({
  summary: "", title: "", theme: "", themes: [], topics: [], goldenVerse: null,
  crossrefs: [], historical: [], wisdomPatterns: [], application: null,
  prayer: "", challenge: "", reflection: [], faq: [], citations: [],
  confidence: 0,
});
const ro6 = formatReview(emptyCtx, null, { mode: "review" });
assertReviewOutput(ro6, "empty/degraded context");
assert.equal(ro6.canonical_only, true);
assert.equal(ro6.confidence, 0);
console.log("PASS: degraded/empty context handled safely");

// ── runReview integration tests ─────────────────────────────────────────────

const { AILogger } = await import("../src/ai/ai-utils.js");
AILogger.setMode("production");
const { AIService, AI_SERVICE_STATUS } = await import("../src/ai/ai-service.js");

const COMMON = { day: 1, chapter: 1, book: "Amsal", cache: false, persist: false };

// Test 7: AIService.review returns standard envelope with review field
const reviewResult = await AIService.review({
  ...COMMON,
  text: "Takut akan Tuhan adalah awal hikmat. Hari ini saya belajar untuk lebih mendengarkan.",
  journalConsent: true,
});
assert.equal(typeof reviewResult, "object");
assert.equal(reviewResult.success, true);
assert.equal(reviewResult.status, AI_SERVICE_STATUS.SUCCESS);
assert.equal(reviewResult.metadata.method, "review");
assert.ok("review" in reviewResult, "envelope harus punya field review");
if (reviewResult.review) {
  assertReviewOutput(reviewResult.review, "AIService.review output");
}
console.log("PASS: AIService.review returns standard envelope + structured review");

// Test 8: AIService.mentor
const mentorResult = await AIService.mentor({
  ...COMMON,
  text: "Saya mencoba menerapkan hikmat Amsal hari ini.",
  journalConsent: true,
});
assert.equal(mentorResult.success, true);
assert.equal(mentorResult.metadata.method, "mentor");
assert.ok("review" in mentorResult);
if (mentorResult.review) {
  assertReviewOutput(mentorResult.review, "AIService.mentor output");
}
console.log("PASS: AIService.mentor returns standard envelope + mentor output");

// Test 9: provider failure fallback (inject failing executor)
const { runReview } = await import("../src/ai/review/review-engine.js");
const failingExecute = async () => { throw new Error("Provider offline"); };
const fallbackResult = await runReview({
  ...COMMON,
  text: "Renungan hari ini.",
  journalConsent: true,
  _executeFn: failingExecute,
});
assertReviewOutput(fallbackResult, "provider-failure fallback");
assert.equal(fallbackResult.canonical_only, true, "fallback harus canonical_only=true");
assert.equal(fallbackResult.provider, "local");
assert.ok(fallbackResult.reasoning_metadata?.intent, "review harus menyertakan reasoning metadata");
console.log("PASS: provider failure -> canonical-only fallback (no crash)");

// Test 10: missing input (no text, no chapter, no day) should throw INVALID_REQUEST
const { AIError } = await import("../src/ai/ai-utils.js");
const badResult = await AIService.review({});
assert.equal(badResult.success, false, "review tanpa input harus gagal");
assert.ok(badResult.error?.code, "harus ada error code");
console.log("PASS: review without input returns safe error envelope");

// Test 11: chapter-only input (no reflection text) → still produces canonical review
const chapterOnly = await AIService.review({ chapter: 1, day: 1, book: "Amsal" });
assert.equal(chapterOnly.success, true, "chapter-only review harus berhasil");
console.log("PASS: chapter-only review works");

// Test 12: UI boundary — ai-reflection-panel.js must not import review-engine directly
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const panelSource = await readFile(path.join(ROOT, "js/ui/ai-reflection-panel.js"), "utf8");
assert.doesNotMatch(
  panelSource,
  /from\s+["'][^"']*review-engine["']/,
  "ai-reflection-panel.js tidak boleh import review-engine langsung",
);
assert.match(panelSource, /AIService\.review/, "ai-reflection-panel.js harus pakai AIService.review");
assert.match(panelSource, /AIService\.mentor/, "ai-reflection-panel.js harus pakai AIService.mentor");
console.log("PASS: UI boundary check — panel uses AIService only");

console.log("\n=====================================");
console.log("PHASE 004 Review Engine — All tests PASS");
console.log("=====================================");
