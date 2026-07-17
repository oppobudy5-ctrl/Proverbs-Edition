// =============================================================================
// index.js — Barrel export untuk Bible Knowledge Base (BKB).
//
// Titik masuk tunggal bagi fase AI berikutnya (AI-02 s/d AI-10). Struktur data
// dan API di sini dijaga stabil agar tidak memerlukan perubahan struktur.
// =============================================================================

export * from "./schema.js";
export * from "./chunker.js";
export { KnowledgeBase, knowledgeBase } from "./knowledge-base.js";
export { SearchEngine, searchEngine } from "./search-engine.js";
export { KnowledgeContextBuilder, knowledgeContextBuilder } from "./knowledge-context.js";
export { analyzeQuery, SEARCH_INTENTS } from "./query-analyzer.js";
export { KnowledgeGraph, knowledgeGraph } from "./knowledge-graph.js";
export { SemanticSearchEngine, semanticSearchEngine } from "./semantic-search.js";

import { knowledgeBase } from "./knowledge-base.js";
import { semanticSearchEngine } from "./semantic-search.js";

/**
 * Inisialisasi BKB untuk lingkungan browser (fetch artefak dist).
 * Aman dipanggil berkali-kali; hanya memuat sekali.
 */
export async function initKnowledgeBase(options = {}) {
  if (knowledgeBase.ready && !options.force) return knowledgeBase;
  if (options.data) {
    knowledgeBase.loadFromObject(options.data);
    return knowledgeBase;
  }
  await knowledgeBase.load(options);
  return knowledgeBase;
}

/**
 * Inisialisasi Semantic Search (BKB + situations/synonyms bila tersedia).
 */
export async function initSemanticSearch(options = {}) {
  await initKnowledgeBase(options);
  if (semanticSearchEngine.ready && !options.force) return semanticSearchEngine;

  let situations = options.situations || null;
  let synonyms = options.synonyms || null;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? "";
  if ((!situations || !synonyms) && typeof fetchImpl === "function") {
    try {
      const [sitRes, synRes] = await Promise.all([
        situations ? Promise.resolve(null) : fetchImpl(`${baseUrl}knowledge/situations/situations.json`, { cache: "force-cache" }),
        synonyms ? Promise.resolve(null) : fetchImpl(`${baseUrl}knowledge/synonyms/synonyms.json`, { cache: "force-cache" }),
      ]);
      if (sitRes?.ok) situations = await sitRes.json();
      if (synRes?.ok) synonyms = await synRes.json();
    } catch {
      // Offline: lanjut tanpa situations/synonyms file jika gagal; topic ontology tetap ada.
    }
  }

  const knowledge = options.data || {
    meta: knowledgeBase.meta,
    book: knowledgeBase.book,
    topics: knowledgeBase.allTopics(),
    documents: knowledgeBase.allDocuments(),
    indexes: {},
  };
  semanticSearchEngine.loadFromObject(knowledge, { situations, synonyms });
  return semanticSearchEngine;
}
