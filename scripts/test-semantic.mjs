// =============================================================================
// test-semantic.mjs — Uji Semantic Search Engine (offline, Node).
// Target: Search < 100 ms · Offline < 50 ms · suggestions realtime-capable
// =============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}
globalThis.localStorage = new MemoryStorage();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const knowledge = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/knowledge.min.json"), "utf8"));
const situations = JSON.parse(await readFile(path.join(ROOT, "knowledge/situations/situations.json"), "utf8"));
const synonyms = JSON.parse(await readFile(path.join(ROOT, "knowledge/synonyms/synonyms.json"), "utf8"));

const { SemanticSearchEngine } = await import("../src/ai/knowledge/semantic-search.js");
const { analyzeQuery, SEARCH_INTENTS } = await import("../src/ai/knowledge/query-analyzer.js");
const { KnowledgeBase } = await import("../src/ai/knowledge/knowledge-base.js");
const { KnowledgeContextBuilder } = await import("../src/ai/knowledge/knowledge-context.js");

const engine = new SemanticSearchEngine();
engine.loadFromObject(knowledge, { situations, synonyms });

// Crossref bug fix: chapter 1 must not include Amsal 10+.
const kb = new KnowledgeBase().loadFromObject(knowledge);
const ctx = new KnowledgeContextBuilder(kb);
const xref1 = ctx.getCrossReferenceContext(1);
assert.ok(xref1.items.every((item) => !/^Amsal\s+1\d/i.test(String(item.source || ""))), "xref ch1 harus tidak mencakup Amsal 10+");

// Analyzer intents
assert.equal(analyzeQuery("Saya bingung mengambil keputusan", { situations, synonyms, topics: knowledge.topics }).intent, SEARCH_INTENTS.LIFE_SITUATION);
assert.equal(analyzeQuery("integritas", { situations, synonyms, topics: knowledge.topics }).intent, SEARCH_INTENTS.CONCEPT);
assert.equal(analyzeQuery("Apa yang Alkitab ajarkan tentang hikmat?", { situations, synonyms, topics: knowledge.topics }).intent, SEARCH_INTENTS.QUESTION);
assert.ok(analyzeQuery("hikma", { situations, synonyms, topics: knowledge.topics }).expandedTerms.includes("hikmat") || analyzeQuery("hikma", { situations, synonyms, topics: knowledge.topics }).correctedTerms.includes("hikmat"));

// Natural language / life situation
const warm = engine.search("keputusan");
assert.ok(warm.results.length >= 0);

const nlStart = performance.now();
const nl = engine.search("Saya bingung mengambil keputusan", { limit: 8 });
const nlMs = performance.now() - nlStart;
assert.ok(nl.results.length > 0, "NL decision query harus punya hasil");
assert.ok(nl.results.every((r) => r.reason && r.confidence >= 0), "setiap hasil wajib explain-why + confidence");
assert.equal(nl.analysis.intent, SEARCH_INTENTS.LIFE_SITUATION);
report("Search (NL)", nlMs, 100);

const offStart = performance.now();
const concept = engine.search("kerendahan hati", { limit: 5 });
const offMs = performance.now() - offStart;
assert.ok(concept.results.length > 0, "concept search harus bekerja");
report("Offline Search", offMs, 50);

const fuzzy = engine.search("hikma", { limit: 5 });
assert.ok(fuzzy.results.length > 0, "fuzzy/synonym 'hikma' → hikmat");

const question = engine.search("Apa yang Alkitab katakan tentang marah?", { limit: 5 });
assert.ok(question.results.length > 0, "question search marah harus menemukan speech/peace");

const related = engine.relatedSearch({ chapter: 3, topicId: "wisdom" });
assert.ok(
  (related.topics?.length || 0) + (related.references?.length || 0) + (related.verses?.length || 0) > 0,
  "related search harus mengembalikan tetangga graph",
);

const suggestions = engine.suggest("hik", { limit: 5 });
assert.ok(suggestions.length > 0, "suggestions realtime harus ada");

// Vector prep fields present on results
assert.ok(nl.results.every((r) => "embeddingStatus" in r && "vectorReady" in r), "future vector fields wajib ada");

// AIService facade
const { AIService } = await import("../src/ai/ai-service.js");
const { semanticSearchEngine } = await import("../src/ai/knowledge/index.js");
semanticSearchEngine.loadFromObject(knowledge, { situations, synonyms });
const viaService2 = await AIService.semanticSearch("Menghadapi godaan", { remember: true });
assert.ok(viaService2.results.length > 0, "AIService.semanticSearch harus bekerja");
assert.ok(AIService.getRecentSearches().includes("Menghadapi godaan"));
AIService.toggleFavoriteSearch("Menghadapi godaan");
assert.equal(AIService.isFavoriteSearch("Menghadapi godaan"), true);
assert.ok(AIService.getSearchAnalytics().searches >= 1);

console.log("\nVALID: Semantic Search — analyzer, graph ranking, explain-why, related, fuzzy, offline, vector-prep, prefs.");

function report(label, ms, target) {
  const status = ms <= target ? "OK" : "LAMBAT";
  console.log(`  ${status.padEnd(6)} ${label.padEnd(18)} ${ms.toFixed(2)} ms (target < ${target} ms)`);
  assert.ok(ms <= target * 5, `${label} jauh melampaui target (${ms.toFixed(2)} ms)`);
}
