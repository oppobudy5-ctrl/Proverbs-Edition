import { normalizeText } from "./ai-utils.js";

// Preparation layer for future embeddings/vector storage.
// Today it keeps normalized documents in memory and performs deterministic
// lexical scoring. A future adapter can implement the same four methods.
export class SemanticIndex {
  #documents = new Map();

  async indexDocument(document) {
    if (!document?.id) throw new TypeError("Semantic document requires an id");
    const normalized = normalizeDocument(document);
    this.#documents.set(String(document.id), normalized);
    return normalized;
  }

  async search(query, options = {}) {
    const terms = normalizeText(query).split(" ").filter(Boolean);
    if (!terms.length) return [];
    const limit = Math.max(1, options.limit || 5);
    return Array.from(this.#documents.values())
      .map((document) => ({ document: document.source, score: lexicalScore(document.text, terms), engine: "lexical-preparation" }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async rebuild(documents = []) {
    await this.clear();
    for (const document of documents) await this.indexDocument(document);
    return { indexed: this.#documents.size };
  }

  async clear() {
    this.#documents.clear();
  }

  get size() {
    return this.#documents.size;
  }
}

function normalizeDocument(document) {
  return Object.freeze({
    id: String(document.id),
    text: normalizeText([
      document.title,
      document.theme,
      document.text,
      document.content,
      document.summary,
      document.goldenVerse?.ref,
      document.goldenVerse?.text,
      ...(document.keywords || []),
      ...(document.topics || []),
    ].join(" ")),
    // Future vector search preparation — same shape as BKB documents.
    embeddingStatus: document.embeddingStatus || "pending",
    vectorReady: Boolean(document.vectorReady),
    chunkId: document.chunkId ?? null,
    chunkOrder: Number.isFinite(document.chunkOrder) ? document.chunkOrder : 0,
    estimatedTokens: document.estimatedTokens ?? null,
    source: Object.freeze({ ...document }),
  });
}

function lexicalScore(text, terms) {
  return terms.reduce((score, term) => {
    let index = 0;
    let occurrences = 0;
    while ((index = text.indexOf(term, index)) !== -1) {
      occurrences++;
      index += term.length;
    }
    return score + Math.min(occurrences, 5);
  }, 0) / terms.length;
}

export const semanticIndex = new SemanticIndex();
