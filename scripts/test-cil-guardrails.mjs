import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const knowledge = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/knowledge.min.json"), "utf8"));
const canonIndex = JSON.parse(await readFile(path.join(ROOT, "knowledge/dist/canon-index.json"), "utf8"));

const { initCIL, citationEngine, theologicalGuardrails, createCanonicalContext } = await import("../src/ai/cil/index.js");
await initCIL({ bundle: knowledge, canonIndex, graph: { nodes: [], edges: [] } });

const ok = citationEngine.verify("Amsal 1:7");
assert.equal(ok.ok, true);
assert.equal(ok.canonicalId, "ref:proverbs.1.7");

const bad = citationEngine.verify("Amsal 99:1");
assert.equal(bad.ok, false);
assert.equal(bad.invented, true);

const ctx = createCanonicalContext({
  intent: "qa",
  title: "Takut akan TUHAN",
  theme: "Fondasi hikmat",
  summary: "Permulaan pengetahuan.",
  book: { bookName: "Amsal", names: { id: "Amsal" } },
  chapter: { chapter: 1, bookName: "Amsal", canonicalId: "chapter:proverbs.01" },
  goldenVerse: { ref: "Amsal 1:7", text: "Takut akan TUHAN adalah permulaan pengetahuan." },
  citations: [{ display: "Amsal 1:7", canonicalId: "ref:proverbs.1.7", verified: true }],
  allowedCitations: [{ display: "Amsal 1:7", canonicalId: "ref:proverbs.1.7", verified: true }],
  interpretiveNotes: ["Beberapa tradisi menekankan tafsiran kristologis."],
  application: { invitation: "Pertimbangkan satu langkah praktis minggu ini." },
  crossrefs: [{ source: "Amsal 1", target: "Mazmur 111:10" }],
  doctrines: [{ id: "doctrine:fear-of-the-lord", name: "Takut akan TUHAN" }],
  topics: [{ id: "topic:wisdom", name: "Hikmat" }],
  coverage: { score: 0.8 },
});

const pass = theologicalGuardrails.validate(
  "Menurut Amsal 1:7, takut akan TUHAN adalah permulaan pengetahuan. Ada tafsiran yang berbeda tentang penekanannya.",
  ctx,
  { intent: "qa" },
);
assert.ok(pass.status === "pass" || pass.status === "warn", pass.status);
assert.ok(pass.citations.length >= 1);

const invent = theologicalGuardrails.validate(
  "Lihat Amsal 99:99 yang mengatakan hal mustahil.",
  ctx,
  { intent: "qa" },
);
assert.ok(invent.status === "fallback" || invent.status === "refuse" || invent.inventedRefs.length > 0);

const absolute = theologicalGuardrails.validate(
  "Ikuti ini dan pasti berhasil serta harus selalu dilakukan tanpa kecuali.",
  ctx,
  { intent: "reflection" },
);
assert.ok(
  absolute.checks.some((c) => c.id === "non-absolute-application" && c.pass === false) ||
    absolute.status !== "pass",
);

const fallback = theologicalGuardrails.buildSafeFallback(ctx);
assert.ok(fallback.includes("Amsal") || fallback.includes("konteks"));

console.log("PASS test-cil-guardrails");
