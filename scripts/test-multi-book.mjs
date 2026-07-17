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
const registry = JSON.parse(await readFile(path.join(ROOT, "knowledge/canon/books-registry.json"), "utf8"));
const { AIService } = await import("../src/ai/ai-service.js");
const { parsePath, buildPath } = await import("../js/router.js");
const { KnowledgeBase } = await import("../src/ai/knowledge/knowledge-base.js");

assert.equal(registry.schema, "multi-book-registry-v1");
assert.equal(registry.books.length, 66, "registry harus memuat 66 kitab");
assert.deepEqual(registry.books.map((book) => book.canonicalOrder), Array.from({ length: 66 }, (_, index) => index + 1));
for (const book of registry.books) {
  for (const field of [
    "bookId", "osis", "slug", "names", "shortName", "testament", "chapterCount",
    "canonicalOrder", "authors", "period", "category", "language", "status",
  ]) {
    assert.ok(book[field] != null, `${book.slug} harus punya ${field}`);
  }
  assert.ok(["OT", "NT"].includes(book.testament));
  assert.ok(Number.isInteger(book.chapterCount) && book.chapterCount > 0);
}
assert.equal(registry.books.filter((book) => book.status === "production").length, 1);
assert.equal(registry.books.find((book) => book.status === "production").slug, "proverbs");
console.log("PASS: 66-book registry metadata and availability");

const books = await AIService.books();
assert.equal(books.success, true);
assert.equal(books.books.length, 66);
assert.equal(books.books[0].names.id, "Kejadian");
assert.equal(books.books[65].names.id, "Wahyu");
console.log("PASS: AIService.books canonical order");

const psalms = await AIService.book("Mazmur");
assert.equal(psalms.success, true);
assert.equal(psalms.book.slug, "psalms");
assert.equal(psalms.book.chapterCount, 150);
assert.equal(psalms.book.available, false);
console.log("PASS: aliases resolve across books");

const isolatedKb = new KnowledgeBase().loadFromObject({
  documents: [
    { id: "proverbs-chapter-01", type: "chapter", title: "Amsal 1", content: "A", meta: { bookSlug: "proverbs", chapter: 1 } },
    { id: "psalms-chapter-01", type: "chapter", title: "Mazmur 1", content: "B", meta: { bookSlug: "psalms", chapter: 1 } },
  ],
  topics: [],
});
assert.equal(isolatedKb.getChapter(1, "proverbs").chapterDoc.title, "Amsal 1");
assert.equal(isolatedKb.getChapter(1, "psalms").chapterDoc.title, "Mazmur 1");
console.log("PASS: KnowledgeBase keys chapters by book and chapter");

const psalmsContext = await AIService.buildCanonicalContext({ book: "psalms", chapter: 1 });
assert.equal(psalmsContext.success, true);
assert.equal(psalmsContext.book.names.id, "Mazmur");
assert.equal(psalmsContext.chapter.bookName, "Mazmur");
assert.equal(psalmsContext.metadata.availability, "metadata-only");
assert.equal(psalmsContext.crossrefs.length, 0);
assert.equal(psalmsContext.topics.length, 0);
assert.doesNotMatch(psalmsContext.summary, /Amsal/i, "metadata-only book tidak boleh bocor konten Amsal");
console.log("PASS: CIL isolates metadata-only books without Proverbs leakage");

const proverbsCompanion = await AIService.companion({
  book: "proverbs",
  chapter: 1,
  llmEnabled: false,
});
assert.equal(proverbsCompanion.success, true);
assert.equal(proverbsCompanion.companion.available, true);
assert.equal(proverbsCompanion.companion.availability, "available");
assert.ok(proverbsCompanion.companion.summary);
assert.ok(proverbsCompanion.companion.cross_book_references.length > 0);
assert.ok(proverbsCompanion.companion.citations.length > 0);
console.log("PASS: available Bible Companion with cross-book references");

const offlineCompanion = await AIService.companion({
  book: "james",
  chapter: 1,
  llmEnabled: false,
});
assert.equal(offlineCompanion.success, true);
assert.equal(offlineCompanion.companion.available, false);
assert.equal(offlineCompanion.companion.availability, "metadata-only");
assert.match(offlineCompanion.companion.status_message, /belum tersedia offline/i);
assert.equal(offlineCompanion.companion.canonical_only, true);
console.log("PASS: clear offline metadata-only fallback");

const semantic = await AIService.semanticSearch("Mazmur", { remember: false });
assert.equal(semantic.success, true);
assert.ok(semantic.results.some((result) => result.id === "book:psalms"));
console.log("PASS: semantic search spans canonical registry");

assert.equal(buildPath("companion", { book: "james", chapter: 3 }), "/companion/james/3");
assert.deepEqual(parsePath("/companion/james/3"), {
  route: "companion",
  params: { book: "james", chapter: 3 },
});
assert.deepEqual(parsePath("/companion/psalms"), {
  route: "companion",
  params: { book: "psalms", chapter: 1 },
});
console.log("PASS: generic book/chapter deep links");

const ui = await readFile(path.join(ROOT, "js/ui/bible-companion.js"), "utf8");
assert.match(ui, /AIService\.books/);
assert.match(ui, /AIService\.companion/);
assert.doesNotMatch(ui, /from\s+["'][^"']*(?:ai-controller|cil\/gateway|providers\/)/);
assert.match(ui, /aria-label.*Pilih kitab/);
assert.match(ui, /aria-label.*Pilih pasal/);
console.log("PASS: accessible UI boundary");

const invalidChapter = await AIService.companion({ book: "jude", chapter: 2 });
assert.equal(invalidChapter.success, false);
assert.equal(invalidChapter.error.code, "INVALID_REQUEST");
console.log("PASS: chapter bounds fail safely");

console.log("VALID: Phase 005 multi-book registry, CIL isolation, Companion, navigation, search, and offline fallback.");
