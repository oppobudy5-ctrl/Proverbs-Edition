// =============================================================================
// semantic-search.js — Semantic Search Engine (Meaning First, offline-first).
//
// Pipeline: Query Analyzer → Intent/Topic → Knowledge Graph → Semantic Ranking
// → Retrieval → Explain Why → Related Results.
//
// Belum memakai embeddings, tetapi hasil & dokumen membawa field vector-ready.
// =============================================================================

import { normalizeText } from "../ai-utils.js";
import { knowledgeBase } from "./knowledge-base.js";
import { searchEngine } from "./search-engine.js";
import { knowledgeGraph } from "./knowledge-graph.js";
import { analyzeQuery, SEARCH_INTENTS } from "./query-analyzer.js";
import { DOCUMENT_TYPES } from "./schema.js";

const WEIGHTS = Object.freeze({
  topic: 28,
  meaning: 22,
  chapter: 18,
  importance: 12,
  crossref: 10,
  confidence: 8,
  popularity: 6,
  lexical: 14,
});

export class SemanticSearchEngine {
  #kb;
  #search;
  #graph;
  #resources = null;
  #ready = false;

  constructor({ kb = knowledgeBase, search = searchEngine, graph = knowledgeGraph } = {}) {
    this.#kb = kb;
    this.#search = search;
    this.#graph = graph;
  }

  get ready() {
    return this.#ready && this.#kb.ready;
  }

  /** Muat dari objek knowledge.min.json (+ situations/synonyms opsional). */
  loadFromObject(knowledge, extras = {}) {
    this.#kb.loadFromObject(knowledge);
    this.#resources = {
      topics: knowledge.topics || [],
      synonyms: extras.synonyms || null,
      situations: extras.situations || null,
      crossrefs: extras.crossrefs || null,
    };
    this.#graph.build({
      topics: knowledge.topics || [],
      documents: knowledge.documents || [],
      crossrefs: extras.crossrefs || { relations: knowledge.documents?.filter((d) => d.type === "crossref").map(docToRelation) || [] },
      situations: extras.situations || null,
    });
    this.#ready = true;
    return this;
  }

  async ensureReady(options = {}) {
    if (this.ready && !options.force) return this;
    if (!this.#kb.ready) await this.#kb.load(options);
    if (!this.#resources) {
      this.#resources = {
        topics: this.#kb.allTopics(),
        synonyms: options.synonyms || null,
        situations: options.situations || null,
        crossrefs: null,
      };
      this.#graph.build({
        topics: this.#resources.topics,
        documents: this.#kb.allDocuments(),
        crossrefs: { relations: this.#kb.getByType(DOCUMENT_TYPES.CROSSREF).map(docToRelation) },
        situations: this.#resources.situations,
      });
      this.#ready = true;
    }
    return this;
  }

  /**
   * @param {string} query
   * @param {object} [options]
   * @param {number} [options.limit=10]
   * @param {number} [options.chapter]
   * @param {string|string[]} [options.type]
   * @param {string} [options.topic]
   * @param {boolean} [options.fuzzy=true]
   * @param {boolean} [options.related=true]
   */
  search(query, options = {}) {
    if (!this.#kb.ready) throw new Error("SemanticSearchEngine: knowledge base belum siap.");
    const started = nowMs();
    const analysis = analyzeQuery(query, {
      synonyms: this.#resources?.synonyms,
      situations: this.#resources?.situations,
      topics: this.#resources?.topics || this.#kb.allTopics(),
    });

    if (analysis.isEmpty && !Number.isFinite(options.chapter) && !options.topic) {
      return emptyResponse(analysis, started);
    }

    const expandedTopicIds = this.#graph.expandTopics(
      unique([...(analysis.topicIds || []), ...(options.topic ? [options.topic] : []), ...analysis.situations.flatMap((s) => s.topics || [])]),
      1,
    );

    const lexicalQuery = analysis.expandedTerms.slice(0, 12).join(" ") || analysis.normalized;
    const lexicalHits = this.#search.search(lexicalQuery, {
      limit: Math.max(20, options.limit || 10),
      chapter: options.chapter,
      topic: options.topic,
      type: options.type,
      fuzzy: options.fuzzy !== false,
    });

    // Topic-direct hits.
    const topicHits = [];
    for (const topicId of expandedTopicIds.slice(0, 5)) {
      for (const hit of this.#search.byTopic(topicId, { limit: 6 })) {
        topicHits.push({ ...hit, viaTopic: topicId });
      }
    }

    const scored = new Map();
    const push = (hit, boost = 0, reasonBits = []) => {
      const doc = hit.document;
      if (!doc?.id) return;
      if (options.type) {
        const types = new Set([].concat(options.type));
        if (!types.has(doc.type)) return;
      }
      if (Number.isFinite(options.chapter) && Number(doc.meta?.chapter) !== Number(options.chapter)) {
        // Still allow topic/faq/dictionary without chapter.
        if (doc.meta?.chapter != null) return;
      }
      const existing = scored.get(doc.id) || {
        document: doc,
        score: 0,
        components: { topic: 0, meaning: 0, chapter: 0, importance: 0, crossref: 0, confidence: 0, popularity: 0, lexical: 0 },
        matches: new Set(),
        reasonBits: new Set(),
      };
      existing.score += (hit.score || 0) + boost;
      existing.components.lexical += hit.score || 0;
      for (const m of hit.matches || []) existing.matches.add(m);
      for (const r of reasonBits) existing.reasonBits.add(r);
      if (hit.viaTopic) {
        existing.components.topic += WEIGHTS.topic;
        existing.reasonBits.add(`topik:${hit.viaTopic}`);
      }
      scored.set(doc.id, existing);
    };

    for (const hit of lexicalHits) push(hit, 0, analysis.intent === SEARCH_INTENTS.KEYWORD ? ["kecocokan kata"] : ["makna/leksikal"]);
    for (const hit of topicHits) push(hit, WEIGHTS.topic / 2, ["topik ontologi"]);

    // Meaning / situation boost.
    for (const entry of scored.values()) {
      const docTopics = new Set(entry.document.topics || []);
      let topicOverlap = 0;
      for (const tid of expandedTopicIds) if (docTopics.has(tid)) topicOverlap++;
      if (topicOverlap) {
        entry.components.topic += topicOverlap * WEIGHTS.topic;
        entry.score += topicOverlap * WEIGHTS.topic;
        entry.reasonBits.add("kesesuaian topik");
      }
      if (analysis.situations.length && topicOverlap) {
        entry.components.meaning += WEIGHTS.meaning;
        entry.score += WEIGHTS.meaning;
        entry.reasonBits.add(analysis.situations[0].reason || "situasi hidup");
      }
      if (Number.isFinite(options.chapter) && Number(entry.document.meta?.chapter) === Number(options.chapter)) {
        entry.components.chapter += WEIGHTS.chapter;
        entry.score += WEIGHTS.chapter;
        entry.reasonBits.add("pasal aktif");
      }
      const importance = Number(entry.document.meta?.importanceScore);
      if (Number.isFinite(importance)) {
        entry.components.importance += importance * WEIGHTS.importance;
        entry.score += importance * WEIGHTS.importance;
      }
      const popularity = Number(entry.document.meta?.popularity) || (entry.document.type === DOCUMENT_TYPES.GOLDEN_VERSE ? 0.6 : 0.3);
      entry.components.popularity += popularity * WEIGHTS.popularity;
      entry.score += popularity * WEIGHTS.popularity;
      if (entry.document.type === DOCUMENT_TYPES.CROSSREF) {
        const conf = Number(entry.document.meta?.confidence) || 0.7;
        entry.components.crossref += conf * WEIGHTS.crossref;
        entry.components.confidence += conf * WEIGHTS.confidence;
        entry.score += conf * (WEIGHTS.crossref + WEIGHTS.confidence);
      }
    }

    const ranked = [...scored.values()]
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score || String(a.document.id).localeCompare(String(b.document.id)))
      .slice(0, options.limit || 10)
      .map((entry) => toSearchResult(entry, analysis, this.#graph));

    const related = options.related === false ? emptyRelated() : this.#buildRelated(ranked, analysis, options);

    return Object.freeze({
      query: analysis.raw,
      analysis,
      results: Object.freeze(ranked),
      related: Object.freeze(related),
      tookMs: Math.round((nowMs() - started) * 100) / 100,
      engine: "semantic-lexical-graph",
      vectorReady: false,
    });
  }

  suggest(query, options = {}) {
    const limit = options.limit || 8;
    const analysis = analyzeQuery(query, {
      synonyms: this.#resources?.synonyms,
      situations: this.#resources?.situations,
      topics: this.#resources?.topics || this.#kb.allTopics(),
    });
    const out = [];
    for (const topic of analysis.topics.slice(0, 4)) {
      out.push({ type: "topic", label: topic.name, value: topic.name, id: topic.id });
    }
    for (const sit of analysis.situations.slice(0, 2)) {
      out.push({ type: "situation", label: sit.label, value: sit.label, id: sit.id });
    }
    if (analysis.normalized.length >= 2) {
      for (const hit of this.#search.prefix(analysis.normalized, { limit: 4 })) {
        out.push({ type: hit.document.type, label: hit.document.title, value: hit.document.title, id: hit.document.id });
      }
      for (const hit of this.#search.search(analysis.normalized, { type: [DOCUMENT_TYPES.FAQ, DOCUMENT_TYPES.DICTIONARY], limit: 4 })) {
        out.push({ type: hit.document.type, label: hit.document.title, value: hit.document.title, id: hit.document.id });
      }
    }
    const dedup = [];
    const seen = new Set();
    for (const item of out) {
      const key = `${item.type}:${item.id || item.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(item);
      if (dedup.length >= limit) break;
    }
    return dedup;
  }

  relatedSearch({ chapter, topicId, documentId } = {}, options = {}) {
    const limit = options.limit || 8;
    const buckets = emptyRelated();
    if (Number.isFinite(chapter)) {
      for (const hit of this.#graph.relatedForChapter(chapter, limit)) {
        pushRelated(buckets, hit);
      }
      const chapterCtx = this.#kb.getChapter(chapter);
      if (chapterCtx?.prayer) buckets.prayers.push(toLite(chapterCtx.prayer));
      if (chapterCtx?.challenge) buckets.challenges.push(toLite(chapterCtx.challenge));
    }
    if (topicId) {
      for (const hit of this.#graph.relatedForTopic(topicId, limit)) pushRelated(buckets, hit);
      for (const hit of this.#search.byTopic(topicId, { limit: 5 })) {
        if (hit.document.type === DOCUMENT_TYPES.VERSE || hit.document.type === DOCUMENT_TYPES.GOLDEN_VERSE) {
          buckets.verses.push(toLite(hit.document));
        }
      }
    }
    if (documentId) {
      for (const hit of this.#search.related(documentId, { limit })) {
        buckets.similar.push(toLite(hit.document));
      }
    }
    return buckets;
  }

  #buildRelated(ranked, analysis, options) {
    const buckets = emptyRelated();
    const chapter = Number.isFinite(options.chapter)
      ? options.chapter
      : ranked.find((r) => Number.isFinite(r.chapter))?.chapter;
    const topicId = analysis.topicIds[0] || ranked.find((r) => r.topics?.length)?.topics[0];
    const base = this.relatedSearch({ chapter, topicId, documentId: ranked[0]?.id }, { limit: 6 });
    return base;
  }
}

function toSearchResult(entry, analysis, graph) {
  const doc = entry.document;
  const chapter = Number.isFinite(doc.meta?.chapter) ? doc.meta.chapter : null;
  const references = doc.references || [];
  const reference = references[0] || (chapter ? `Amsal ${chapter}` : doc.title);
  const topics = doc.topics || [];
  const reason = explainWhy(entry, analysis, topics);
  const confidence = clamp01(entry.score / 120);
  const relatedChapters = [];
  for (const tid of topics.slice(0, 2)) {
    for (const hit of graph.relatedForTopic(tid, 4)) {
      if (hit.node.type === "chapter" && !relatedChapters.includes(hit.node.ref)) relatedChapters.push(hit.node.ref);
    }
  }
  return Object.freeze({
    id: doc.id,
    type: doc.type,
    reference,
    title: doc.title,
    snippet: snippetOf(doc),
    topics,
    reason,
    confidence,
    score: Math.round(entry.score * 100) / 100,
    relatedChapters: Object.freeze(relatedChapters.slice(0, 5)),
    chapter,
    matches: Object.freeze([...entry.matches]),
    components: Object.freeze({ ...entry.components }),
    source: doc.source,
    sourceType: doc.type,
    document: doc,
    // Future vector search preparation
    embeddingStatus: doc.embeddingStatus || "pending",
    vectorReady: Boolean(doc.vectorReady),
    chunkId: doc.chunkId ?? null,
  });
}

function explainWhy(entry, analysis, topics) {
  const bits = [...entry.reasonBits];
  if (analysis.situations[0]?.reason) return analysis.situations[0].reason;
  if (bits.length) {
    const cleaned = bits.map((b) => String(b).replace(/^topik:/, "topik ")).slice(0, 2).join("; ");
    return `Ditampilkan karena ${cleaned}${topics[0] ? ` (terkait ${topics[0]})` : ""}.`;
  }
  if (topics.length) return `Karena hasil ini berhubungan dengan topik ${topics.join(", ")}.`;
  return "Karena makna dan kata kunci query cocok dengan konten Knowledge Base.";
}

function snippetOf(doc) {
  const text = String(doc.summary || doc.content || "").replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function emptyRelated() {
  return {
    topics: [],
    verses: [],
    characters: [],
    prayers: [],
    challenges: [],
    similar: [],
    references: [],
  };
}

function pushRelated(buckets, hit) {
  const lite = {
    id: hit.node.id,
    type: hit.node.type,
    label: hit.node.label,
    ref: hit.node.ref,
    relationship: hit.relationship,
    reason: hit.reason || "",
    confidence: hit.confidence,
  };
  if (hit.node.type === "topic") buckets.topics.push(lite);
  else if (hit.node.type === "verse") buckets.verses.push(lite);
  else if (hit.node.type === "reference" || hit.node.type === "chapter") buckets.references.push(lite);
  else if (hit.node.type === "dictionary" && /people|orang/i.test(String(hit.node.meta?.category || ""))) buckets.characters.push(lite);
  else buckets.similar.push(lite);
}

function toLite(doc) {
  return {
    id: doc.id,
    type: doc.type,
    label: doc.title,
    ref: (doc.references && doc.references[0]) || doc.title,
    snippet: snippetOf(doc),
    topics: doc.topics || [],
  };
}

function docToRelation(doc) {
  return {
    source: doc.meta?.source,
    target: doc.meta?.target,
    relationshipType: doc.meta?.relationshipType,
    reason: doc.summary || doc.content,
    confidence: doc.meta?.confidence,
    topics: doc.topics || [],
  };
}

function emptyResponse(analysis, started) {
  return Object.freeze({
    query: analysis.raw,
    analysis,
    results: Object.freeze([]),
    related: Object.freeze(emptyRelated()),
    tookMs: Math.round((nowMs() - started) * 100) / 100,
    engine: "semantic-lexical-graph",
    vectorReady: false,
  });
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

export const semanticSearchEngine = new SemanticSearchEngine();
