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
const { analyzeBiblicalIntent, BIBLICAL_INTENTS } = await import("../src/ai/reasoning/intent-analyzer.js");
const { buildThemePath } = await import("../src/ai/reasoning/theme-reasoner.js");
const { validateCanonicalAnswer } = await import("../src/ai/reasoning/canonical-validator.js");
const { runBiblicalReasoning } = await import("../src/ai/reasoning/reasoning-engine.js");
const { AIService } = await import("../src/ai/ai-service.js");

const intentCases = [
  ["Apa arti ayat ini?", BIBLICAL_INTENTS.MEANING],
  ["Bagaimana penerapan praktisnya?", BIBLICAL_INTENTS.APPLICATION],
  ["Apa doktrin keselamatan di sini?", BIBLICAL_INTENTS.DOCTRINE],
  ["Jelaskan latar belakang sejarahnya", BIBLICAL_INTENTS.HISTORICAL],
  ["Siapa tokoh Salomo?", BIBLICAL_INTENTS.CHARACTER],
  ["Di mana tempat ini berada?", BIBLICAL_INTENTS.PLACE],
  ["Apakah ini janji Tuhan?", BIBLICAL_INTENTS.PROMISE],
  ["Peringatan apa yang diberikan?", BIBLICAL_INTENTS.WARNING],
  ["Perintah apa yang harus ditaati?", BIBLICAL_INTENTS.COMMAND],
  ["Tolong buat doa dari ayat ini", BIBLICAL_INTENTS.PRAYER],
  ["Hikmat apa untuk keputusan ini?", BIBLICAL_INTENTS.WISDOM],
  ["Ayat terkait dan referensi silang", BIBLICAL_INTENTS.CROSS_REFERENCE],
  ["Bagaimana urutan waktu dan kronologinya?", BIBLICAL_INTENTS.TIMELINE],
  ["Apakah nubuat ini sudah digenapi?", BIBLICAL_INTENTS.PROPHECY],
  ["Apa tema utama pasal ini?", BIBLICAL_INTENTS.THEME],
];

for (const [question, expected] of intentCases) {
  assert.equal(analyzeBiblicalIntent(question).intent, expected, question);
}
console.log("PASS: 15 biblical intent categories");

const themes = buildThemePath(["Takut akan Tuhan", "Hikmat", "Ketaatan", "Integritas"]);
assert.deepEqual(themes.path.slice(0, 3), ["Takut akan Tuhan", "Hikmat", "Ketaatan"]);
assert.ok(themes.links.some((link) => link.from === "Takut akan Tuhan" && link.to === "Hikmat"));
console.log("PASS: explainable canonical theme path");

const canonicalFixture = {
  book: { slug: "proverbs" },
  chapter: { chapter: 1 },
  citations: [{ display: "Amsal 1", canonicalId: "chapter:proverbs.01", verified: true }],
  degraded: false,
};
const blockedValidation = validateCanonicalAnswer({
  citations: canonicalFixture.citations,
  guardrails: { status: "refuse", inventedRefs: ["Amsal 99:99"], warnings: [] },
}, canonicalFixture);
assert.equal(blockedValidation.valid, false);
assert.equal(blockedValidation.status, "blocked");
console.log("PASS: canonical validation blocks invented references");

const inconsistentValidation = validateCanonicalAnswer({
  content: "Jawaban pengujian.",
  citations: canonicalFixture.citations,
  metadata: { book: "psalms", chapter: 9 },
  guardrails: { status: "pass", inventedRefs: [], warnings: [] },
}, canonicalFixture);
assert.equal(inconsistentValidation.status, "warn");
assert.equal(
  inconsistentValidation.checks.find((check) => check.id === "metadata-consistency")?.pass,
  false,
);
console.log("PASS: canonical validation detects metadata contradictions");

const common = {
  book: "proverbs",
  chapter: 1,
  cache: false,
  persist: false,
};
const reason = await AIService.reason(
  "Apa arti takut akan Tuhan dan bagaimana prinsip ini membentuk hikmat?",
  common,
);
assert.equal(reason.success, true);
assert.equal(reason.source, "biblical-reasoning-engine");
assert.equal(reason.metadata.method, "reason");
assert.ok(reason.summary);
assert.ok(Array.isArray(reason.reasoning) && reason.reasoning.length >= 3);
assert.ok(Array.isArray(reason.themes));
assert.ok(Array.isArray(reason.cross_references));
assert.ok(Array.isArray(reason.citations) && reason.citations.length > 0);
assert.ok(reason.validation?.status);
assert.ok(reason.explainability?.intent);
assert.ok(Array.isArray(reason.explainability?.reasoning_path));
assert.ok(Array.isArray(reason.explainability?.context_used));
assert.ok(Array.isArray(reason.explainability?.references_used));
assert.doesNotMatch(JSON.stringify(reason), /system prompt|KONTEKS KANONIK \(CIL\)|METADATA:/i);
console.log("PASS: structured explainable reasoning output without prompt leakage");

const ask = await AIService.ask("Mengapa hikmat penting?", common);
assert.equal(ask.success, true);
assert.ok(Array.isArray(ask.reasoning), "ask() harus melalui reasoning pipeline");
assert.equal(ask.metadata.method, "ask");
console.log("PASS: AIService.ask uses Biblical Reasoning Engine");

let receivedCanonical = null;
const injected = await runBiblicalReasoning("Apa tema utama pasal ini?", {
  ...common,
  _executeFn: async (_intent, payload) => {
    receivedCanonical = payload.canonical;
    return {
      content: "Tema utama dijelaskan dari konteks yang tersedia.",
      provider: "test",
      confidence: 88,
      citations: payload.canonical.citations,
      guardrails: { status: "pass", inventedRefs: [], warnings: [] },
    };
  },
});
assert.ok(receivedCanonical, "canonical context harus diteruskan ke controller/provider path");
assert.equal(injected.provider, "test");
assert.equal(injected.explainability.canonical_only, false);
console.log("PASS: one prebuilt canonical context is reused for LLM synthesis");

const fallback = await runBiblicalReasoning("Apa makna pasal ini?", {
  ...common,
  _executeFn: async () => { throw new Error("offline"); },
});
assert.equal(fallback.provider, "local");
assert.equal(fallback.explainability.canonical_only, true);
assert.equal(fallback.validation.status, "fallback");
assert.ok(fallback.summary);
assert.ok(fallback.citations.length > 0);
console.log("PASS: provider failure returns canonical-only offline answer");

const metadataOnly = await AIService.reason("Apa tema Mazmur 1?", {
  book: "psalms",
  chapter: 1,
  llmEnabled: false,
  cache: false,
  persist: false,
});
assert.equal(metadataOnly.success, true);
assert.equal(metadataOnly.explainability.canonical_only, true);
assert.equal(metadataOnly.validation.status, "insufficient_context");
assert.doesNotMatch(metadataOnly.summary, /Amsal 1/i);
console.log("PASS: metadata-only book does not inherit Proverbs reasoning");

const uiSource = await readFile(path.join(ROOT, "js/ui/ai-dialog.js"), "utf8");
const lessonSource = await readFile(path.join(ROOT, "js/ui/ai-lesson-assist.js"), "utf8");
assert.match(uiSource, /Dasar Jawaban/);
assert.match(uiSource, /aiReasoningBasis/);
assert.match(lessonSource, /aiReasoningBasis\(result\)/);
assert.doesNotMatch(uiSource, /systemPrompt|prompt\.messages|KONTEKS KANONIK/);
console.log("PASS: Dasar Jawaban UI exposes evidence only");

console.log("VALID: Phase 006 intent, context reuse, theme reasoning, validation, explainability, offline, and UI.");
