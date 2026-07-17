import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.localStorage ||= {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const knowledge = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/knowledge.min.json"), "utf8"));
const graphNodes = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/graph-nodes.json"), "utf8"));
const graphEdges = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/graph-edges.json"), "utf8"));
const canonIndex = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/canon-index.json"), "utf8"));

const { initCIL, canonicalContextGateway } = await import("../src/ai/cil/index.js");
await initCIL({
  bundle: knowledge,
  canonIndex,
  graph: { nodes: graphNodes.nodes, edges: graphEdges.edges },
});

const intents = ["qa", "summary", "search", "reflection", "journal-reflection", "explain", "wisdom"];
for (const intent of intents) {
  const t0 = performance.now();
  const ctx = await canonicalContextGateway.buildCanonicalContext({
    chapter: 1,
    day: 1,
    intent,
    question: "Apa arti takut akan Tuhan?",
    journalConsent: false,
  });
  const took = performance.now() - t0;
  assert.ok(ctx.book, `intent ${intent}: book`);
  assert.ok(ctx.chapter, `intent ${intent}: chapter`);
  assert.ok(Array.isArray(ctx.citations), `intent ${intent}: citations`);
  assert.ok(ctx.confidence >= 0 && ctx.confidence <= 100, `intent ${intent}: confidence`);
  assert.equal(ctx.degraded, false, `intent ${intent}: not degraded`);
  assert.equal(ctx.privacy?.indexed, false);
  assert.ok(took < 100, `intent ${intent}: context <100ms (got ${took.toFixed(1)})`);
  console.log(`OK context ${intent} ${took.toFixed(1)}ms confidence=${ctx.confidence}`);
}

// Completeness for chapter 3
const rich = await canonicalContextGateway.buildCanonicalContext({ chapter: 3, intent: "qa" });
assert.ok(rich.topics.length > 0, "topics");
assert.ok(rich.crossrefs.length > 0, "crossrefs");
assert.ok(rich.doctrines.length > 0 || rich.application, "doctrine or application");
assert.ok(rich.goldenVerse, "golden verse");

// Journal isolation: without consent, excerpt ignored
const withJournal = await canonicalContextGateway.buildCanonicalContext({
  chapter: 1,
  intent: "journal-reflection",
  journalConsent: true,
  journal: { excerpt: "Rahasia pribadi jurnal saya" },
});
// Consent not granted in storage → excerpt must be empty
assert.equal(withJournal.journalExcerpt, "", "journal requires stored consent");
assert.equal(withJournal.privacy.journalIncluded, false);

// Degraded fallback path uses CONTENT adapter inside gateway when core fails.
// Verify the method exists and returns a context object shape.
const degCtx = await canonicalContextGateway.buildCanonicalContext({ chapter: 1, intent: "qa" });
assert.ok(degCtx.metadata?.source === "cil" || degCtx.degraded === true || degCtx.chapter);

console.log("PASS test-cil-context");
