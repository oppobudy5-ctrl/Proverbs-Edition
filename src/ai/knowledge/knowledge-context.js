// =============================================================================
// knowledge-context.js — Context Builder BKB.
//
// Menggabungkan beberapa domain (chapter, verse, topic, reflection, prayer,
// FAQ, cross-reference) menjadi satu konteks ringkas + daftar sitiran, siap
// dipakai Prompt Builder. Target eksekusi < 20 ms.
// =============================================================================

import { knowledgeBase } from "./knowledge-base.js";
import { searchEngine } from "./search-engine.js";
import { DOCUMENT_TYPES, estimateTokens } from "./schema.js";

const DEFAULT_TOKEN_BUDGET = 900;

export class KnowledgeContextBuilder {
  #kb;
  #search;

  constructor(kb = knowledgeBase, search = searchEngine) {
    this.#kb = kb;
    this.#search = search;
  }

  getChapterContext(chapter, options = {}) {
    const bundle = this.#kb.getChapter(chapter);
    if (!bundle) return null;
    const sections = [];
    const citations = new Set();
    const topics = new Set();

    if (bundle.chapterDoc) {
      sections.push(section("Ringkasan Pasal", bundle.chapterDoc.summary || bundle.chapterDoc.content, bundle.chapterDoc));
      collect(bundle.chapterDoc, citations, topics);
    }
    if (bundle.goldenVerse) {
      sections.push(section("Ayat Emas", `${firstRef(bundle.goldenVerse)} — ${bundle.goldenVerse.content}`, bundle.goldenVerse));
      collect(bundle.goldenVerse, citations, topics);
    }
    if (options.includeReflection !== false && bundle.reflection) {
      sections.push(section("Refleksi", bundle.reflection.content, bundle.reflection));
    }
    if (options.includeCrossRefs !== false) {
      for (const xref of this.getCrossReferenceContext(chapter).items.slice(0, 3)) {
        citations.add(xref.reference);
      }
    }
    return finalize({
      type: "chapter-context",
      title: bundle.chapterDoc?.title || `Amsal ${chapter}`,
      sections,
      citations,
      topics,
      tokenBudget: options.tokenBudget,
    });
  }

  getVerseContext(reference, options = {}) {
    const ref = String(reference || "").trim();
    const doc = this.#kb
      .allDocuments()
      .find(
        (d) =>
          (d.type === DOCUMENT_TYPES.VERSE || d.type === DOCUMENT_TYPES.GOLDEN_VERSE) &&
          (d.references || []).some((r) => r === ref),
      );
    if (!doc) return null;
    const citations = new Set();
    const topics = new Set();
    collect(doc, citations, topics);
    const sections = [section(`Ayat ${ref}`, doc.content, doc)];
    if (doc.meta?.languageNotes) sections.push(section("Catatan Bahasa", doc.meta.languageNotes, doc));
    return finalize({ type: "verse-context", title: ref, sections, citations, topics, tokenBudget: options.tokenBudget });
  }

  getTopicContext(topicId, options = {}) {
    const topic = this.#kb.getTopic(topicId);
    if (!topic) return null;
    const citations = new Set(topic.relatedVerses || []);
    const topics = new Set([topicId]);
    const sections = [section(`Topik: ${topic.name}`, topic.description, { source: "Topic Ontology", references: topic.relatedVerses })];
    const docs = this.#search.byTopic(topicId, { limit: options.limit || 4 });
    for (const result of docs) {
      sections.push(section(result.document.title, result.document.summary || result.document.content, result.document));
      collect(result.document, citations, topics);
    }
    return finalize({ type: "topic-context", title: topic.name, sections, citations, topics, tokenBudget: options.tokenBudget });
  }

  getReflectionContext(chapter, options = {}) {
    const bundle = this.#kb.getChapter(chapter);
    if (!bundle?.reflection) return null;
    const citations = new Set();
    const topics = new Set();
    collect(bundle.reflection, citations, topics);
    return finalize({
      type: "reflection-context",
      title: `Refleksi Amsal ${chapter}`,
      sections: [section("Pertanyaan Refleksi", bundle.reflection.content, bundle.reflection)],
      citations,
      topics,
      tokenBudget: options.tokenBudget,
    });
  }

  getPrayerContext(chapter, options = {}) {
    const bundle = this.#kb.getChapter(chapter);
    if (!bundle?.prayer) return null;
    return finalize({
      type: "prayer-context",
      title: `Doa Amsal ${chapter}`,
      sections: [section("Doa", bundle.prayer.content, bundle.prayer)],
      citations: new Set(bundle.prayer.references || []),
      topics: new Set(bundle.prayer.topics || []),
      tokenBudget: options.tokenBudget,
    });
  }

  getFAQContext(query, options = {}) {
    const results = this.#search.search(query, { type: [DOCUMENT_TYPES.FAQ, DOCUMENT_TYPES.APOLOGETICS], limit: options.limit || 3 });
    if (!results.length) return null;
    const citations = new Set();
    const topics = new Set();
    const sections = results.map((result) => {
      collect(result.document, citations, topics);
      return section(result.document.title, result.document.summary || result.document.content, result.document);
    });
    return finalize({ type: "faq-context", title: "FAQ", sections, citations, topics, tokenBudget: options.tokenBudget });
  }

  getCrossReferenceContext(chapter) {
    const label = `Amsal ${chapter}`;
    const chapterRe = new RegExp(`^Amsal\\s+${chapter}(?:\\D|$)`, "i");
    const items = this.#kb
      .getByType(DOCUMENT_TYPES.CROSSREF)
      .filter((doc) => chapterRe.test(String(doc.meta?.source || "")))
      .map((doc) => ({
        reference: doc.meta?.target,
        relationshipType: doc.meta?.relationshipType,
        reason: doc.summary || doc.content,
        confidence: doc.meta?.confidence ?? null,
        source: doc.meta?.source,
      }))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    return { type: "crossref-context", title: `Rujukan Silang ${label}`, items };
  }

  /** Gabungkan beberapa konteks menjadi satu, hormati anggaran token. */
  combine(parts, options = {}) {
    const budget = options.tokenBudget || DEFAULT_TOKEN_BUDGET;
    const valid = parts.filter(Boolean);
    const sections = [];
    const citations = new Set();
    const topics = new Set();
    let tokens = 0;
    for (const part of valid) {
      for (const ref of part.citations || []) citations.add(ref);
      for (const t of part.topics || []) topics.add(t);
      for (const sec of part.sections || []) {
        const secTokens = estimateTokens(sec.text);
        if (tokens + secTokens > budget && sections.length) continue;
        sections.push(sec);
        tokens += secTokens;
      }
    }
    return finalize({
      type: "combined-context",
      title: options.title || "Konteks Alkitab",
      sections,
      citations,
      topics,
      tokenBudget: budget,
    });
  }
}

function section(label, text, doc) {
  return {
    label,
    text: String(text || "").trim(),
    source: doc?.source || doc?.meta?.source || "BKB",
    references: doc?.references || [],
  };
}

function firstRef(doc) {
  return (doc.references && doc.references[0]) || doc.title || "";
}

function collect(doc, citations, topics) {
  for (const ref of doc.references || []) citations.add(ref);
  for (const t of doc.topics || []) topics.add(t);
}

function finalize({ type, title, sections, citations, topics, tokenBudget }) {
  const budget = tokenBudget || DEFAULT_TOKEN_BUDGET;
  const kept = [];
  let tokens = 0;
  for (const sec of sections) {
    if (!sec.text) continue;
    const secTokens = estimateTokens(sec.text);
    if (tokens + secTokens > budget && kept.length) break;
    kept.push(sec);
    tokens += secTokens;
  }
  const text = kept.map((sec) => `## ${sec.label}\n${sec.text}`).join("\n\n");
  return {
    type,
    title,
    sections: kept,
    citations: [...citations].filter(Boolean),
    topics: [...topics].filter(Boolean),
    estimatedTokens: tokens,
    text,
  };
}

export const knowledgeContextBuilder = new KnowledgeContextBuilder();
