import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "knowledge", "dist");

const required = [
  "knowledge.min.json",
  "canon-index.json",
  "reference-index.json",
  "doctrine-index.json",
  "character-index.json",
  "timeline-index.json",
  "symbol-index.json",
  "wisdom-index.json",
  "application-index.json",
  "graph-nodes.json",
  "graph-edges.json",
  "manifest.json",
];

for (const name of required) {
  const raw = await readFile(path.join(DIST, name), "utf8");
  assert.ok(raw.length > 2, name);
  JSON.parse(raw);
}

const knowledge = JSON.parse(await readFile(path.join(DIST, "knowledge.min.json"), "utf8"));
assert.ok((knowledge.domains?.doctrines || []).length >= 12);
assert.ok((knowledge.domains?.characters || []).length >= 8);
assert.ok((knowledge.domains?.timeline || []).length >= 6);
assert.ok((knowledge.domains?.symbols || []).length >= 15);
assert.ok((knowledge.domains?.wisdom || []).length >= 8);
assert.ok((knowledge.domains?.applications || []).length === 31);
assert.ok((knowledge.canon?.books || []).some((b) => b.status === "production"));
assert.ok((knowledge.canon?.books || []).some((b) => b.status === "seed"));

const sources = [
  "knowledge/canon/books-registry.json",
  "knowledge/doctrine/doctrines.json",
  "knowledge/characters/characters.json",
  "knowledge/timeline/events.json",
  "knowledge/symbols/symbols.json",
  "knowledge/wisdom/patterns.json",
  "knowledge/application/applications.json",
];
for (const rel of sources) {
  JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));
}

// Boundary: no runtime AI module outside cil/knowledge may import BKB engines directly.
const aiRoot = path.join(ROOT, "src", "ai");
const forbidden = [
  "knowledge-base.js",
  "search-engine.js",
  "knowledge-context.js",
  "knowledge-graph.js",
  "semantic-search.js",
];
const offenders = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "cil" || entry.name === "knowledge") continue;
      await walk(full);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;
    const text = await readFile(full, "utf8");
    for (const name of forbidden) {
      if (text.includes(`/${name}`) || text.includes(`"${name}"`) || text.includes(`'${name}'`)) {
        // Allow importing through cil gateway / index barrel only if not direct engine file
        if (text.includes(`knowledge/${name}`) || text.includes(`./knowledge/${name.replace(".js", "")}`)) {
          offenders.push(`${path.relative(ROOT, full)} -> ${name}`);
        }
      }
    }
  }
}
await walk(aiRoot);

// ai-service must not import semantic-search engine directly anymore
const aiService = await readFile(path.join(aiRoot, "ai-service.js"), "utf8");
assert.doesNotMatch(
  aiService,
  /(?:from\s+|import\s*\()\s*["'][^"']*knowledge\/semantic-search(?:\.js)?["']/,
  "ai-service must not import semantic-search directly",
);
assert.ok(aiService.includes("cil/index"), "ai-service must use CIL");

const controller = await readFile(path.join(aiRoot, "ai-controller.js"), "utf8");
assert.ok(controller.includes("cil"), "ai-controller must use CIL");
assert.ok(!controller.includes("data/content.js"), "ai-controller must not import CONTENT");

const retrieval = await readFile(path.join(aiRoot, "retrieval-engine.js"), "utf8");
assert.ok(!retrieval.includes("data/content.js"), "retrieval-engine must not import CONTENT");

const contextBuilder = await readFile(path.join(aiRoot, "context-builder.js"), "utf8");
assert.ok(!contextBuilder.includes("data/content.js"), "context-builder must not import CONTENT");

if (offenders.length) {
  console.error(offenders);
  assert.fail(`BKB import boundary violated: ${offenders.join("; ")}`);
}

console.log("PASS validate-cil");
