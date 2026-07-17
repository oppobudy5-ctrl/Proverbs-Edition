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
const chapterOverlays = JSON.parse(
  await readFile(path.join(ROOT, "knowledge/metadata/chapter-overlays.json"), "utf8"),
);
const { CONTENT } = await import("../data/content.js");
const { AIService } = await import("../src/ai/ai-service.js");

const rows = [];
for (let chapter = 1; chapter <= 31; chapter += 1) {
  const bundlePath = path.join(
    ROOT,
    "knowledge/books/proverbs",
    `chapter-${String(chapter).padStart(2, "0")}.json`,
  );
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  assert.equal(bundle.book, "proverbs");
  assert.equal(bundle.chapter, chapter);
  const types = new Set(bundle.documents.map((document) => document.type));
  for (const type of [
    "chapter", "golden-verse", "reflection", "prayer", "challenge", "devotional",
  ]) {
    assert.ok(types.has(type), `Amsal ${chapter}: dokumen ${type} harus ada`);
  }
  const chapterDocument = bundle.documents.find((document) => document.type === "chapter");
  const challengeDocument = bundle.documents.find((document) => document.type === "challenge");
  const goldenVerseDocument = bundle.documents.find((document) => document.type === "golden-verse");

  const response = await AIService.companion({
    book: "proverbs",
    chapter,
    chapterOverlays,
    llmEnabled: false,
    cache: false,
    persist: false,
  });
  assert.equal(response.success, true, `Amsal ${chapter}: response harus sukses`);
  const companion = response.companion;
  const editorial = CONTENT[chapter];

  assert.equal(companion.available, true);
  assert.equal(companion.availability, "available");
  assert.equal(companion.summary, editorial.summary);
  assert.equal(companion.chapter_overview, editorial.lead);
  assert.equal(companion.chapter_title, editorial.title);
  assert.equal(companion.main_theme, editorial.theme);
  assert.ok(companion.themes.includes(editorial.theme));
  assert.deepEqual(companion.keywords, chapterDocument.keywords);
  assert.equal(companion.application, challengeDocument.content);
  assert.doesNotMatch(companion.application, /^Pertimbangkan bagaimana tema/);
  assert.equal(companion.prayer, editorial.prayer);
  assert.equal(companion.memory_verse.ref, goldenVerseDocument.references[0]);
  assert.equal(companion.memory_verse.text, goldenVerseDocument.content);
  assert.equal(companion.book_overview.purpose, companion.purpose);
  assert.ok(companion.book_overview.authors.length);
  assert.ok(companion.purpose);
  const expectedHistorical = {
    ...chapterOverlays.defaults,
    ...(chapterOverlays.chapters?.[String(chapter)] || {}),
  }.historicalContext;
  assert.ok(companion.historical_context.startsWith(expectedHistorical));
  assert.equal(companion.historical_source, "chapter");
  assert.ok(companion.literary_context);
  assert.ok(companion.structure.length);
  assert.ok(companion.metadata.canonical_id);
  assert.ok(companion.citations.length);
  assert.ok(companion.reasoning_metadata?.intent);
  assert.equal(companion.metadata.reasoning_engine, true);
  assert.equal(companion.status_message, "");

  rows.push({
    chapter,
    summary: true,
    theme: true,
    prayer: true,
    application: true,
    status: "active",
  });
}

for (const chapter of [1, 5, 10, 15, 20, 25, 31]) {
  const row = rows.find((item) => item.chapter === chapter);
  assert.equal(row?.status, "active");
}

const ui = await readFile(path.join(ROOT, "js/ui/bible-companion.js"), "utf8");
for (const falseFallback of [
  "Ringkasan belum tersedia dalam Knowledge Base.",
  "Penerapan belum tersedia.",
  "Belum ada referensi lintas kitab yang tervalidasi untuk konteks ini.",
]) {
  assert.doesNotMatch(ui, new RegExp(falseFallback.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.match(ui, /companion\.memory_verse/);
assert.match(ui, /companion\.keywords/);
assert.match(ui, /companion\.metadata/);
assert.match(ui, /renderChips\("Tema", companion\.themes/);
assert.match(ui, /renderChips\("Kata kunci", companion\.keywords/);
assert.equal(
  (ui.match(/const \w+ = el\("article"/g) || []).length,
  4,
  "Refinement tidak boleh menambah card Companion",
);
assert.doesNotMatch(ui, /Dataset Metadata/);
assert.doesNotMatch(ui, /Canonical Context/);

console.log("Chapter | Summary | Theme | Prayer | Application | Status");
for (const row of rows) {
  console.log(
    `${String(row.chapter).padStart(2, "0")}      | ✓       | ✓     | ✓      | ✓           | ACTIVE`,
  );
}
console.log("VALID: 31 Proverbs chapters use existing canonical editorial data without false fallbacks.");
