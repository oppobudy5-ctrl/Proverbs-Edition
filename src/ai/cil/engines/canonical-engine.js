import { normalizeText } from "../../ai-utils.js";
import { canonicalBookId, canonicalChapterId, canonicalRefId } from "../../knowledge/schema.js";

/**
 * Canon engine: normalize/parse references and book/chapter metadata.
 */
export class CanonicalEngine {
  #canon = null;
  #ready = false;

  get ready() {
    return this.#ready;
  }

  load(canonIndex) {
    this.#canon = canonIndex || { byId: {}, aliases: {}, bySlug: {}, byOsis: {} };
    this.#ready = true;
    return this;
  }

  getBook(bookIdOrSlug) {
    const id = this.resolveBookId(bookIdOrSlug);
    return id ? this.#canon.byId[id] || null : null;
  }

  listBooks({ status } = {}) {
    const books = Object.values(this.#canon?.byId || {});
    return status ? books.filter((b) => b.status === status) : books;
  }

  resolveBookId(input) {
    const raw = String(input || "").trim();
    if (!raw) return null;
    if (!this.#canon) return null;
    if (raw.startsWith("book:") && this.#canon.byId?.[raw]) return raw;
    const key = normalizeText(raw).replace(/\s+/g, "");
    return (
      this.#canon.aliases?.[key] ||
      this.#canon.bySlug?.[key] ||
      this.#canon.byOsis?.[raw] ||
      this.#canon.byId?.[canonicalBookId(key)] ||
      null
    );
  }

  parseReference(text) {
    if (!this.#ready || !this.#canon) return null;
    const raw = String(text || "").trim();
    if (!raw) return null;
    if (raw.startsWith("ref:") || raw.startsWith("chapter:") || raw.startsWith("book:")) {
      return this.#fromCanonicalId(raw);
    }
    const match = raw.match(/^([1-3]?\s*[A-Za-z\u00C0-\u024F.]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/u);
    if (!match) return null;
    const bookId = this.resolveBookId(match[1].replace(/\./g, ""));
    if (!bookId) return null;
    const book = this.#canon.byId[bookId];
    const chapter = Number(match[2]);
    const verse = match[3] ? Number(match[3]) : null;
    const verseEnd = match[4] ? Number(match[4]) : null;
    if (book?.status === "production" && (chapter < 1 || chapter > book.chapterCount)) return null;
    const canonicalId = verse
      ? canonicalRefId(book.slug, chapter, verse)
      : canonicalChapterId(book.slug, chapter);
    return Object.freeze({
      canonicalId,
      display: raw,
      bookId,
      bookSlug: book.slug,
      bookName: book.names?.id || book.slug,
      chapter,
      verse,
      verseEnd,
      status: book.status,
      testament: book.testament,
      genre: book.genre,
      author: book.authors || [],
      audience: book.audience || "",
      purpose: book.purpose || "",
    });
  }

  getChapterMeta(bookSlugOrId, chapter) {
    const book = this.getBook(bookSlugOrId);
    if (!book) return null;
    const ch = Number(chapter);
    if (book.status === "production" && (ch < 1 || ch > book.chapterCount)) return null;
    return Object.freeze({
      canonicalId: canonicalChapterId(book.slug, ch),
      bookId: book.bookId,
      bookSlug: book.slug,
      bookName: book.names?.id || book.slug,
      chapter: ch,
      status: book.status,
      testament: book.testament,
      genre: book.genre,
      authors: book.authors || [],
      audience: book.audience || "",
      purpose: book.purpose || "",
      position: book.status === "production" ? ch / book.chapterCount : null,
    });
  }

  normalizeToCanonicalId(text) {
    if (String(text || "").startsWith("ref:") || String(text || "").startsWith("chapter:") || String(text || "").startsWith("book:")) {
      return String(text);
    }
    return this.parseReference(text)?.canonicalId || null;
  }

  #fromCanonicalId(id) {
    if (id.startsWith("book:")) {
      const book = this.#canon.byId[id];
      if (!book) return null;
      return Object.freeze({
        canonicalId: id,
        display: book.names?.id || book.slug,
        bookId: id,
        bookSlug: book.slug,
        bookName: book.names?.id || book.slug,
        chapter: null,
        verse: null,
        status: book.status,
      });
    }
    const parts = id.split(":");
    const body = parts[1] || "";
    const [slug, chapter, verse] = body.split(".");
    const book = this.getBook(slug);
    if (!book) return null;
    return Object.freeze({
      canonicalId: id,
      display: verse
        ? `${book.names?.id || slug} ${Number(chapter)}:${Number(verse)}`
        : `${book.names?.id || slug} ${Number(chapter)}`,
      bookId: book.bookId,
      bookSlug: book.slug,
      bookName: book.names?.id || book.slug,
      chapter: Number(chapter),
      verse: verse ? Number(verse) : null,
      status: book.status,
    });
  }
}

export const canonicalEngine = new CanonicalEngine();
