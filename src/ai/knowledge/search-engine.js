// =============================================================================
// search-engine.js — Local Search untuk BKB (offline, tanpa jaringan).
//
// Mendukung: Exact, Partial, Prefix, Fuzzy, Topic, dan Related search.
// Ranking berbasis skor: topic match, keyword match, verse match, popularity,
// importanceScore, dan confidence. Dirancang untuk < 50 ms pada korpus BKB.
// =============================================================================

import { normalizeText } from "../ai-utils.js";
import { knowledgeBase } from "./knowledge-base.js";

const WEIGHTS = Object.freeze({
  exactTitle: 60,
  exactKeyword: 40,
  topic: 30,
  partialTitle: 18,
  verse: 16,
  partialKeyword: 14,
  prefix: 10,
  summary: 6,
  content: 2,
  fuzzy: 8,
});

export class SearchEngine {
  #kb;
  #index = [];
  #signature = null;

  constructor(kb = knowledgeBase) {
    this.#kb = kb;
  }

  #ensureIndex() {
    const signature = this.#kb.meta?.version + ":" + (this.#kb.allDocuments().length || 0);
    if (this.#signature === signature && this.#index.length) return;
    this.#index = this.#kb.allDocuments().map((doc) => ({
      doc,
      title: normalizeText(doc.title),
      summary: normalizeText(doc.summary),
      content: normalizeText(doc.content),
      keywords: (doc.keywords || []).map(normalizeText).filter(Boolean),
      topics: new Set(doc.topics || []),
      references: (doc.references || []).map((r) => normalizeText(r)),
      importance: clampScore(doc.meta?.importanceScore, 0.5),
      popularity: clampScore(doc.meta?.popularity, 0.3),
      confidence: clampScore(doc.meta?.confidence, 1),
    }));
    this.#signature = signature;
  }

  /**
   * @param {string} query
   * @param {object} [options]
   * @param {string|string[]} [options.type] filter tipe dokumen
   * @param {number} [options.chapter] filter pasal
   * @param {string} [options.topic] filter/boost topik
   * @param {number} [options.limit=10]
   * @param {boolean} [options.fuzzy=true]
   */
  search(query, options = {}) {
    this.#ensureIndex();
    const limit = Math.max(1, options.limit || 10);
    const types = options.type ? new Set([].concat(options.type)) : null;
    const chapter = Number(options.chapter);
    const topicFilter = options.topic || null;
    const normalized = normalizeText(query);
    const terms = normalized.split(" ").filter(Boolean);
    const useFuzzy = options.fuzzy !== false;

    const results = [];
    for (const entry of this.#index) {
      if (types && !types.has(entry.doc.type)) continue;
      if (Number.isFinite(chapter) && Number(entry.doc.meta?.chapter) !== chapter) continue;
      if (topicFilter && !entry.topics.has(topicFilter)) continue;

      const { score, matches } = this.#scoreEntry(entry, terms, normalized, { topicFilter, useFuzzy });
      // Filter kosong hanya jika ada query; tanpa query kembalikan berdasarkan filter.
      if (terms.length && score <= 0 && !topicFilter) continue;
      results.push({ document: entry.doc, score: round(score + entry.importance * 4 + entry.popularity * 3), matches });
    }

    results.sort((a, b) => b.score - a.score || String(a.document.id).localeCompare(String(b.document.id)));
    return results.slice(0, limit);
  }

  exact(query, options = {}) {
    const normalized = normalizeText(query);
    return this.search(query, { ...options, fuzzy: false }).filter((r) =>
      normalizeText(r.document.title) === normalized || (r.document.keywords || []).some((k) => normalizeText(k) === normalized),
    );
  }

  prefix(query, options = {}) {
    this.#ensureIndex();
    const normalized = normalizeText(query);
    if (!normalized) return [];
    const limit = Math.max(1, options.limit || 10);
    return this.#index
      .filter((entry) => entry.title.startsWith(normalized) || entry.keywords.some((k) => k.startsWith(normalized)))
      .map((entry) => ({ document: entry.doc, score: WEIGHTS.prefix, matches: ["prefix"] }))
      .slice(0, limit);
  }

  byTopic(topicId, options = {}) {
    return this.search("", { ...options, topic: topicId });
  }

  /** Related: dokumen yang berbagi topik/keyword/referensi dengan dokumen sumber. */
  related(docId, options = {}) {
    this.#ensureIndex();
    const source = this.#kb.getDocument(docId);
    if (!source) return [];
    const limit = Math.max(1, options.limit || 5);
    const topics = new Set(source.topics || []);
    const keywords = new Set((source.keywords || []).map(normalizeText));
    const references = new Set((source.references || []).map(normalizeText));

    const results = [];
    for (const entry of this.#index) {
      if (entry.doc.id === docId) continue;
      let score = 0;
      for (const t of entry.topics) if (topics.has(t)) score += WEIGHTS.topic;
      for (const k of entry.keywords) if (keywords.has(k)) score += WEIGHTS.partialKeyword;
      for (const r of entry.references) if (references.has(r)) score += WEIGHTS.verse;
      if (score > 0) results.push({ document: entry.doc, score: round(score), matches: ["related"] });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  #scoreEntry(entry, terms, normalizedQuery, { topicFilter, useFuzzy }) {
    let score = 0;
    const matches = [];
    if (topicFilter && entry.topics.has(topicFilter)) {
      score += WEIGHTS.topic;
      matches.push("topic");
    }
    if (!terms.length) return { score, matches };

    if (entry.title === normalizedQuery) {
      score += WEIGHTS.exactTitle;
      matches.push("exact-title");
    }
    for (const term of terms) {
      if (entry.keywords.includes(term)) {
        score += WEIGHTS.exactKeyword;
        matches.push("keyword");
      } else if (entry.keywords.some((k) => k.includes(term))) {
        score += WEIGHTS.partialKeyword;
        matches.push("keyword-partial");
      }
      if (entry.title.includes(term)) {
        score += WEIGHTS.partialTitle;
        matches.push("title");
      } else if (entry.title.split(" ").some((w) => w.startsWith(term))) {
        score += WEIGHTS.prefix;
        matches.push("prefix");
      }
      if (entry.references.some((r) => r.includes(term))) {
        score += WEIGHTS.verse;
        matches.push("verse");
      }
      if (entry.summary.includes(term)) {
        score += WEIGHTS.summary;
        matches.push("summary");
      } else if (entry.content.includes(term)) {
        score += WEIGHTS.content;
        matches.push("content");
      }
      if (useFuzzy && score === 0) {
        const near = entry.keywords.some((k) => isFuzzyMatch(term, k));
        if (near) {
          score += WEIGHTS.fuzzy;
          matches.push("fuzzy");
        }
      }
    }
    return { score, matches: [...new Set(matches)] };
  }
}

function isFuzzyMatch(a, b) {
  if (!a || !b) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  return levenshtein(a, b) <= (a.length <= 4 ? 1 : 2);
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function clampScore(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

export const searchEngine = new SearchEngine();
