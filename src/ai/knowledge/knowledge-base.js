// =============================================================================
// knowledge-base.js — Loader Single Source of Truth (read-only) untuk BKB.
//
// - Offline-friendly: memuat satu artefak `knowledge.min.json` (di-cache SW).
// - Read-only: dokumen dibekukan (Object.freeze); tidak ada mutasi dari UI.
// - Membangun indeks runtime (keyword, topic, verse, chapter, people, dll.)
//   saat load bila artefak belum menyertakannya, sehingga selalu siap dipakai.
// =============================================================================

import { normalizeText } from "../ai-utils.js";
import { DOCUMENT_TYPES } from "./schema.js";

export class KnowledgeBase {
  #data = null;
  #byId = new Map();
  #byType = new Map();
  #chapters = new Map();
  #topics = new Map();
  #indexes = null;
  #ready = false;

  get ready() {
    return this.#ready;
  }

  get meta() {
    return this.#data?.meta ? { ...this.#data.meta } : { version: "0.0.0", counts: {} };
  }

  get book() {
    return this.#data?.book ? structuredCopy(this.#data.book) : null;
  }

  /** Muat dari objek data yang sudah ada (dipakai build/validator/test Node). */
  loadFromObject(data) {
    if (!data || !Array.isArray(data.documents)) {
      throw new Error("KnowledgeBase: data tidak valid (documents hilang).");
    }
    this.#reset();
    this.#data = data;
    for (const raw of data.documents) {
      const doc = Object.freeze({ ...raw });
      this.#byId.set(doc.id, doc);
      pushMap(this.#byType, doc.type, doc);
    }
    for (const topic of data.topics || []) {
      this.#topics.set(topic.id, Object.freeze({ ...topic }));
    }
    this.#buildChapters();
    this.#indexes = data.indexes && isRichIndex(data.indexes) ? reviveIndexes(data.indexes) : this.#buildIndexes();
    this.#ready = true;
    return this;
  }

  /**
   * Muat dari artefak dist. Di browser memakai fetch; di Node caller sebaiknya
   * memakai loadFromObject. Bisa menerima fetchImpl kustom.
   */
  async load(options = {}) {
    if (this.#ready && !options.force) return this;
    const baseUrl = options.baseUrl ?? "";
    const url = options.url ?? `${baseUrl}knowledge/dist/knowledge.min.json`;
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("KnowledgeBase.load: fetch tidak tersedia; pakai loadFromObject di Node.");
    }
    const response = await fetchImpl(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`KnowledgeBase.load: gagal memuat (${response.status}).`);
    const data = await response.json();
    return this.loadFromObject(data);
  }

  getDocument(id) {
    return this.#byId.get(id) || null;
  }

  getByType(type) {
    return [...(this.#byType.get(type) || [])];
  }

  allDocuments() {
    return [...this.#byId.values()];
  }

  getTopic(id) {
    return this.#topics.get(id) || null;
  }

  allTopics() {
    return [...this.#topics.values()];
  }

  getChapter(chapter) {
    const bundle = this.#chapters.get(Number(chapter));
    return bundle ? { ...bundle } : null;
  }

  getIndex(name) {
    return this.#indexes?.[name] || null;
  }

  get indexes() {
    return this.#indexes;
  }

  #reset() {
    this.#byId = new Map();
    this.#byType = new Map();
    this.#chapters = new Map();
    this.#topics = new Map();
    this.#indexes = null;
    this.#ready = false;
  }

  #buildChapters() {
    for (const doc of this.#byType.get(DOCUMENT_TYPES.CHAPTER) || []) {
      const chapter = Number(doc.meta?.chapter);
      if (!Number.isFinite(chapter)) continue;
      this.#chapters.set(chapter, {
        chapter,
        book: doc.meta?.book || null,
        chapterDoc: doc,
        goldenVerse: null,
        verses: [],
        reflection: null,
        prayer: null,
        challenge: null,
        devotional: null,
      });
    }
    const attach = (type, key) => {
      for (const doc of this.#byType.get(type) || []) {
        const chapter = Number(doc.meta?.chapter);
        const bundle = this.#chapters.get(chapter);
        if (!bundle) continue;
        if (Array.isArray(bundle[key])) bundle[key].push(doc);
        else bundle[key] = doc;
      }
    };
    attach(DOCUMENT_TYPES.GOLDEN_VERSE, "goldenVerse");
    attach(DOCUMENT_TYPES.VERSE, "verses");
    attach(DOCUMENT_TYPES.REFLECTION, "reflection");
    attach(DOCUMENT_TYPES.PRAYER, "prayer");
    attach(DOCUMENT_TYPES.CHALLENGE, "challenge");
    attach(DOCUMENT_TYPES.DEVOTIONAL, "devotional");
  }

  #buildIndexes() {
    const keyword = new Map();
    const topic = new Map();
    const verse = new Map();
    const chapter = new Map();
    const book = new Map();
    const people = new Map();
    const places = new Map();
    const quote = new Map();
    const dictionary = new Map();
    const commentary = new Map();
    const faq = new Map();

    for (const doc of this.#byId.values()) {
      for (const kw of doc.keywords || []) addTo(keyword, normalizeText(kw), doc.id);
      for (const t of doc.topics || []) addTo(topic, t, doc.id);
      for (const ref of doc.references || []) addTo(verse, ref, doc.id);
      const ch = doc.meta?.chapter;
      if (Number.isFinite(ch)) addTo(chapter, String(ch), doc.id);
      if (doc.meta?.book) addTo(book, normalizeText(doc.meta.book), doc.id);
      for (const p of doc.meta?.people || []) addTo(people, normalizeText(p), doc.id);
      for (const p of doc.meta?.places || []) addTo(places, normalizeText(p), doc.id);
      if (doc.type === DOCUMENT_TYPES.QUOTE) addTo(quote, doc.id, doc.id);
      if (doc.type === DOCUMENT_TYPES.DICTIONARY) addTo(dictionary, doc.id, doc.id);
      if (doc.type === DOCUMENT_TYPES.COMMENTARY) addTo(commentary, doc.id, doc.id);
      if (doc.type === DOCUMENT_TYPES.FAQ || doc.type === DOCUMENT_TYPES.APOLOGETICS) addTo(faq, doc.id, doc.id);
    }
    return { keyword, topic, verse, chapter, book, people, places, quote, dictionary, commentary, faq };
  }
}

function pushMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function addTo(map, key, id) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(id);
}

function isRichIndex(indexes) {
  return indexes && typeof indexes === "object" && indexes.keyword;
}

function reviveIndexes(indexes) {
  const out = {};
  for (const [name, entries] of Object.entries(indexes)) {
    const map = new Map();
    for (const [key, ids] of Object.entries(entries)) {
      map.set(key, new Set(ids));
    }
    out[name] = map;
  }
  return out;
}

function structuredCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

export const knowledgeBase = new KnowledgeBase();
