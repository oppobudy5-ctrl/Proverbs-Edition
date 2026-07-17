import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const knowledge = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/knowledge.min.json"), "utf8"));
const graphNodes = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/graph-nodes.json"), "utf8"));
const graphEdges = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/graph-edges.json"), "utf8"));
const canonIndex = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/canon-index.json"), "utf8"));

const {
  initCIL,
  canonicalEngine,
  topicEngine,
  relationshipEngine,
  knowledgeGraphEngine,
  doctrineEngine,
  characterEngine,
  timelineEngine,
  symbolEngine,
  wisdomEngine,
  applicationEngine,
} = await import("../src/ai/cil/index.js");

await initCIL({
  bundle: knowledge,
  canonIndex,
  graph: { nodes: graphNodes.nodes, edges: graphEdges.edges },
});

function timed(label, limitMs, fn) {
  const t0 = performance.now();
  const result = fn();
  const took = performance.now() - t0;
  assert.ok(took < limitMs, `${label} took ${took.toFixed(1)}ms >= ${limitMs}`);
  console.log(`OK ${label} ${took.toFixed(1)}ms`);
  return result;
}

timed("canon parse", 50, () => {
  const ref = canonicalEngine.parseReference("Amsal 1:7");
  assert.equal(ref.canonicalId, "ref:proverbs.1.7");
  assert.ok(canonicalEngine.getBook("book:proverbs"));
  assert.ok(canonicalEngine.listBooks({ status: "seed" }).length >= 5);
});

timed("topic", 50, () => {
  const wisdom = topicEngine.get("wisdom");
  assert.ok(wisdom);
  assert.ok(topicEngine.children("wisdom").length >= 1);
  assert.ok(topicEngine.forChapter(1).length >= 0);
});

timed("relationship", 100, () => {
  const rels = relationshipEngine.related("chapter:proverbs.01", { limit: 10 });
  assert.ok(Array.isArray(rels));
  const why = relationshipEngine.whyRelated;
  assert.equal(typeof why, "function");
});

timed("graph", 80, () => {
  const n = knowledgeGraphEngine.neighbors("book:proverbs", { limit: 10 });
  assert.ok(n.length > 0);
  const sub = knowledgeGraphEngine.subgraph(["chapter:proverbs.01"], { depth: 1, limit: 20 });
  assert.ok(sub.nodes.length > 0);
});

assert.ok(doctrineEngine.all().length >= 12);
assert.ok(characterEngine.all().length >= 8);
assert.ok(timelineEngine.all().length >= 6);
assert.ok(symbolEngine.all().length >= 15);
assert.ok(wisdomEngine.all().length >= 8);
assert.ok(applicationEngine.all().length === 31);
assert.ok(applicationEngine.forChapter(31));
assert.ok(doctrineEngine.forChapter(1).length >= 1 || doctrineEngine.byTopic("wisdom").length >= 1);

console.log("PASS test-cil-engines");
