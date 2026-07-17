// =============================================================================
// schema.js — Skema dokumen tunggal Bible Knowledge Base (BKB).
//
// Semua domain (chapter, verse, golden verse, topic, dictionary, dll.) dinormal-
// isasi menjadi satu bentuk dokumen agar Retrieval, Search, dan Context Builder
// dapat memperlakukannya secara seragam. Skema ini juga menyiapkan field semantik
// untuk masa depan (embeddings) tanpa mengubah struktur.
// =============================================================================

export const DOCUMENT_TYPES = Object.freeze({
  BOOK: "book",
  CHAPTER: "chapter",
  VERSE: "verse",
  GOLDEN_VERSE: "golden-verse",
  TOPIC: "topic",
  DICTIONARY: "dictionary",
  CROSSREF: "crossref",
  COMMENTARY: "commentary",
  QUOTE: "quote",
  REFLECTION: "reflection",
  PRAYER: "prayer",
  CHALLENGE: "challenge",
  FAQ: "faq",
  APOLOGETICS: "apologetics",
  DEVOTIONAL: "devotional",
  // CIL domain documents
  DOCTRINE: "doctrine",
  CHARACTER: "character",
  TIMELINE: "timeline",
  SYMBOL: "symbol",
  WISDOM_PATTERN: "wisdom-pattern",
  APPLICATION: "application",
  CANON_BOOK: "canon-book",
});

/** Language-independent canonical ID helpers */
export function canonicalBookId(slug) {
  return `book:${String(slug || "").trim().toLowerCase()}`;
}

export function canonicalChapterId(bookSlug, chapter) {
  const ch = Number(chapter);
  return `chapter:${String(bookSlug || "").trim().toLowerCase()}.${String(ch).padStart(2, "0")}`;
}

export function canonicalRefId(bookSlug, chapter, verse) {
  const base = `ref:${String(bookSlug || "").trim().toLowerCase()}.${Number(chapter)}`;
  return verse == null || verse === "" ? base : `${base}.${Number(verse)}`;
}

export function canonicalTopicId(topic) {
  return String(topic || "").startsWith("topic:") ? String(topic) : `topic:${String(topic || "").trim()}`;
}

export const EMBEDDING_STATUS = Object.freeze({
  PENDING: "pending",
  READY: "ready",
});

export const DOCUMENT_FIELDS = Object.freeze([
  "id",
  "type",
  "title",
  "content",
  "summary",
  "tags",
  "keywords",
  "topics",
  "references",
  "source",
  "license",
  "language",
  "version",
  "updatedAt",
  // Semantic preparation (belum dipakai, tetapi selalu tersedia).
  "embeddingStatus",
  "chunkId",
  "chunkOrder",
  "estimatedTokens",
  "vectorReady",
]);

const DEFAULTS = Object.freeze({
  language: "id",
  version: "1.0.0",
  license: "editorial-cc-by-nc",
  source: "Bible Time Knowledge Base",
});

/**
 * Perkiraan jumlah token kasar (≈ 1 token / 0.75 kata untuk teks Indonesia).
 * Cukup untuk chunking dan anggaran konteks; bukan tokenizer presisi.
 */
export function estimateTokens(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(0, Math.round(words / 0.75));
}

/**
 * Membuat dokumen BKB yang sudah tervalidasi bentuknya.
 * Field yang hilang diisi default agar tidak ada metadata kosong tak terduga.
 */
export function createDocument(input = {}) {
  const type = input.type || DOCUMENT_TYPES.CHAPTER;
  const content = String(input.content ?? "").trim();
  const doc = {
    id: String(input.id || "").trim(),
    type,
    title: String(input.title ?? "").trim(),
    content,
    summary: String(input.summary ?? "").trim(),
    tags: dedupeStrings(input.tags),
    keywords: dedupeStrings(input.keywords),
    topics: dedupeStrings(input.topics),
    references: dedupeStrings(input.references),
    source: String(input.source ?? DEFAULTS.source).trim(),
    license: String(input.license ?? DEFAULTS.license).trim(),
    language: String(input.language ?? DEFAULTS.language).trim(),
    version: String(input.version ?? DEFAULTS.version).trim(),
    updatedAt: input.updatedAt || new Date().toISOString().slice(0, 10),
    embeddingStatus: input.embeddingStatus || EMBEDDING_STATUS.PENDING,
    chunkId: input.chunkId ?? null,
    chunkOrder: Number.isFinite(input.chunkOrder) ? input.chunkOrder : 0,
    estimatedTokens: Number.isFinite(input.estimatedTokens)
      ? input.estimatedTokens
      : estimateTokens(`${input.title || ""} ${content}`),
    vectorReady: Boolean(input.vectorReady) || false,
    // Metadata tambahan spesifik-domain disimpan di `meta` (tidak menjadi teks retrieval).
    meta: input.meta && typeof input.meta === "object" ? input.meta : {},
  };
  return doc;
}

/**
 * Memvalidasi satu dokumen. Mengembalikan daftar pesan error (kosong = valid).
 */
export function validateDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") return ["dokumen bukan objek"];
  if (!doc.id) errors.push("id kosong");
  if (!doc.type || !Object.values(DOCUMENT_TYPES).includes(doc.type)) errors.push(`type tidak valid: ${doc.type}`);
  if (!doc.title && !doc.content) errors.push("title dan content kosong");
  if (!doc.source) errors.push("source kosong");
  if (!doc.language) errors.push("language kosong");
  if (!Array.isArray(doc.keywords)) errors.push("keywords bukan array");
  if (!Array.isArray(doc.topics)) errors.push("topics bukan array");
  return errors;
}

function dedupeStrings(value) {
  if (!Array.isArray(value)) {
    if (value == null || value === "") return [];
    return [String(value)];
  }
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const str = typeof item === "string" ? item.trim() : String(item?.term || item?.name || item || "").trim();
    if (str && !seen.has(str)) {
      seen.add(str);
      out.push(str);
    }
  }
  return out;
}
