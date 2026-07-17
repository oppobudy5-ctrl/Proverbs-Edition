// =============================================================================
// build-knowledge.mjs — Generator Bible Knowledge Base (BKB).
//
// Sumber kebenaran:
//  - data/content.js + data/schedule.js  → domain devosional per pasal
//  - knowledge/**/*.json (kurasi)         → domain lintas (topik, kamus, dll.)
//
// Output:
//  - knowledge/books/proverbs/chapter-01..31.json (bundel per pasal)
//  - knowledge/indexes/*.json
//  - knowledge/dist/knowledge.min.json + index & chunk exports + manifest.json
// =============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  createDocument,
  validateDocument,
  estimateTokens,
  DOCUMENT_TYPES,
  canonicalBookId,
  canonicalChapterId,
  canonicalRefId,
} from "../src/ai/knowledge/schema.js";
import { chunkText } from "../src/ai/knowledge/chunker.js";
import { normalizeText } from "../src/ai/ai-utils.js";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KDIR = path.join(ROOT, "knowledge");
const VERSION = "1.0.0";
const TODAY = new Date().toISOString().slice(0, 10);

async function loadJson(relative) {
  return JSON.parse(await readFile(path.join(KDIR, relative), "utf8"));
}

async function main() {
  const { CONTENT } = await import("../data/content.js");
  const { READING_PLAN } = await import("../data/schedule.js");
  const scheduleByChapter = new Map(READING_PLAN.map((item) => [item.chapter, item]));

  const book = await loadJson("metadata/book-proverbs.json");
  const overlays = await loadJson("metadata/chapter-overlays.json");
  const topicsFile = await loadJson("topics/topics.json");
  const dictionary = await loadJson("dictionary/dictionary.json");
  const crossrefs = await loadJson("crossrefs/crossrefs.json");
  const commentaries = await loadJson("commentaries/commentaries.json");
  const faq = await loadJson("faq/faq.json");
  const apologetics = await loadJson("faq/apologetics.json");
  const booksRegistry = await loadJson("canon/books-registry.json");
  const referenceAliases = await loadJson("canon/reference-aliases.json");
  const doctrines = await loadJson("doctrine/doctrines.json");
  const characters = await loadJson("characters/characters.json");
  const timeline = await loadJson("timeline/events.json");
  const symbols = await loadJson("symbols/symbols.json");
  const wisdom = await loadJson("wisdom/patterns.json");
  const applications = await loadJson("application/applications.json");

  const documents = [];
  const chunks = [];
  const days = Object.values(CONTENT).sort((a, b) => a.chapter - b.chapter);

  // --- Topic ontology: siapkan struktur & wadah relasi terhitung ---------------
  const topics = topicsFile.topics.map((t) => ({
    ...t,
    relatedChapters: [],
    relatedVerses: [...new Set(t.relatedVerses || [])],
  }));
  const topicByAlias = buildAliasLookup(topics);

  // --- People index dari kamus (referensi "Amsal N") --------------------------
  const peopleByChapter = new Map();
  for (const entry of dictionary.entries.filter((e) => e.category === "People")) {
    for (const ref of entry.references || []) {
      const ch = parseChapter(ref);
      if (ch) pushMap(peopleByChapter, ch, entry.term);
    }
  }

  // --- DOMAIN 01: Book ---------------------------------------------------------
  documents.push(
    createDocument({
      id: "book-proverbs",
      type: DOCUMENT_TYPES.BOOK,
      title: `${book.bookName} (${book.englishName})`,
      content: `${book.purpose}\n\n${book.historicalSetting}`,
      summary: book.purpose,
      keywords: book.keywords,
      topics: [],
      tags: book.themes,
      references: ["Amsal 1:1"],
      source: book.source,
      license: book.license,
      language: book.language,
      version: VERSION,
      updatedAt: TODAY,
      meta: { book: book.bookName, outline: book.outline, author: book.authorTraditional, genre: book.genre, testament: book.testament },
    }),
  );

  // --- DOMAIN 02/03/04/10/11/12/15: per pasal ---------------------------------
  const chapterBundles = new Map();
  for (const day of days) {
    const chapter = day.chapter;
    const plan = scheduleByChapter.get(chapter) || {};
    const overlay = { ...overlays.defaults, ...(overlays.chapters?.[String(chapter)] || {}) };
    const chapterTopics = matchTopics(day, plan, topicByAlias);
    const people = [...new Set(peopleByChapter.get(chapter) || [])];
    const goldenRef = day.goldenVerse?.ref;
    const xrefTargets = crossrefs.relations
      .filter((r) => parseChapter(r.source) === chapter)
      .map((r) => r.target);

    // Catat relasi topik→pasal & topik→ayat.
    for (const topicId of chapterTopics) {
      const topic = topics.find((t) => t.id === topicId);
      if (topic && !topic.relatedChapters.includes(chapter)) topic.relatedChapters.push(chapter);
      if (topic && goldenRef && !topic.relatedVerses.includes(goldenRef)) topic.relatedVerses.push(goldenRef);
    }

    const readingTime = Math.max(2, Math.round((countWords(day.summary) + countWords(day.renungan)) / 200));

    const chapterDoc = createDocument({
      id: `proverbs-chapter-${pad(chapter)}`,
      type: DOCUMENT_TYPES.CHAPTER,
      title: day.title,
      content: day.summary,
      summary: day.summary,
      keywords: day.keywords,
      topics: chapterTopics,
      tags: [plan.theme, overlay.difficulty].filter(Boolean),
      references: [`Amsal ${chapter}`, goldenRef].filter(Boolean),
      source: "Bible Time — konten devosional Amsal (editorial).",
      license: "editorial-cc-by-nc",
      updatedAt: TODAY,
      meta: {
        book: day.book,
        chapter,
        day: day.day,
        mainIdea: day.theme,
        structure: overlay.structure,
        historicalContext: overlay.historicalContext,
        literaryContext: overlay.literaryContext,
        application: day.challenge,
        estimatedReadingTime: readingTime,
        difficulty: overlay.difficulty,
        people,
        exegesis: day.exegesis,
      },
    });

    const goldenDoc = createDocument({
      id: `proverbs-golden-${pad(chapter)}`,
      type: DOCUMENT_TYPES.GOLDEN_VERSE,
      title: goldenRef || `Amsal ${chapter}`,
      content: day.goldenVerse?.text || "",
      summary: `Ayat emas Amsal ${chapter}: ${day.theme}`,
      keywords: day.keywords,
      topics: chapterTopics,
      references: [goldenRef].filter(Boolean),
      source: "Bible Time — ayat emas (Alkitab Terjemahan Baru).",
      updatedAt: TODAY,
      meta: { book: day.book, chapter, reason: day.lead, theme: plan.theme, application: day.challenge, relatedTopics: chapterTopics },
    });

    const verseDoc = createDocument({
      id: `proverbs-verse-${pad(chapter)}`,
      type: DOCUMENT_TYPES.VERSE,
      title: goldenRef || `Amsal ${chapter}`,
      content: day.goldenVerse?.text || "",
      summary: `Metadata ayat ${goldenRef}`,
      keywords: day.keywords,
      topics: chapterTopics,
      references: [goldenRef, ...xrefTargets].filter(Boolean),
      source: "Bible Time — metadata ayat (editorial).",
      updatedAt: TODAY,
      meta: {
        book: day.book,
        chapter,
        reference: goldenRef,
        people,
        places: [],
        events: [],
        crossReferences: xrefTargets,
        importanceScore: 0.9,
        languageNotes: extractLanguageNote(day.exegesis),
      },
    });

    const reflectionDoc = createDocument({
      id: `proverbs-reflection-${pad(chapter)}`,
      type: DOCUMENT_TYPES.REFLECTION,
      title: `Refleksi Amsal ${chapter}`,
      content: (day.reflection || []).map((q, i) => `${i + 1}. ${q}`).join("\n"),
      summary: `Pertanyaan refleksi untuk Amsal ${chapter}.`,
      keywords: day.keywords,
      topics: chapterTopics,
      references: [`Amsal ${chapter}`, goldenRef].filter(Boolean),
      source: "Bible Time — pertanyaan refleksi (editorial).",
      updatedAt: TODAY,
      meta: {
        book: day.book,
        chapter,
        reflectionQuestions: day.reflection || [],
        discussionQuestions: buildDiscussion(day),
        application: day.challenge,
        smallGroupQuestions: buildSmallGroup(day),
        difficulty: overlay.difficulty,
      },
    });

    const prayerDoc = createDocument({
      id: `proverbs-prayer-${pad(chapter)}`,
      type: DOCUMENT_TYPES.PRAYER,
      title: `Doa Amsal ${chapter}`,
      content: day.prayer || "",
      summary: `Doa penutup untuk Amsal ${chapter}.`,
      keywords: day.keywords,
      topics: chapterTopics,
      references: [`Amsal ${chapter}`].filter(Boolean),
      source: "Bible Time — doa (editorial).",
      updatedAt: TODAY,
      meta: { book: day.book, chapter, prayerTheme: plan.theme, prayerType: "penutup renungan", length: "sedang", audience: "pribadi" },
    });

    const challengeDoc = createDocument({
      id: `proverbs-challenge-${pad(chapter)}`,
      type: DOCUMENT_TYPES.CHALLENGE,
      title: `Tantangan Amsal ${chapter}`,
      content: day.challenge || "",
      summary: `Tantangan penerapan untuk Amsal ${chapter}.`,
      keywords: day.keywords,
      topics: chapterTopics,
      references: [`Amsal ${chapter}`].filter(Boolean),
      source: "Bible Time — tantangan penerapan (editorial).",
      updatedAt: TODAY,
      meta: { book: day.book, chapter, action: day.challenge, category: plan.theme, difficulty: overlay.difficulty, estimatedTime: "5-20 menit" },
    });

    const devotionalDoc = createDocument({
      id: `proverbs-devotional-${pad(chapter)}`,
      type: DOCUMENT_TYPES.DEVOTIONAL,
      title: day.title,
      content: day.renungan,
      summary: day.summary,
      keywords: day.keywords,
      topics: chapterTopics,
      references: [`Amsal ${chapter}`, goldenRef].filter(Boolean),
      source: "Bible Time — renungan (editorial).",
      updatedAt: TODAY,
      meta: {
        book: day.book,
        chapter,
        lead: day.lead,
        reflection: day.reflection || [],
        prayer: day.prayer,
        challenge: day.challenge,
      },
    });

    const perChapter = [chapterDoc, goldenDoc, verseDoc, reflectionDoc, prayerDoc, challengeDoc, devotionalDoc];
    documents.push(...perChapter);
    chapterBundles.set(chapter, perChapter);

    // Chunking untuk dokumen berteks panjang.
    for (const doc of [chapterDoc, devotionalDoc]) {
      const parts = chunkText(doc.content, { prefix: doc.title });
      doc.estimatedTokens = estimateTokens(doc.content);
      doc.meta.chunkCount = parts.length;
      parts.forEach((part) => {
        chunks.push({
          id: `${doc.id}#chunk-${part.order}`,
          parentId: doc.id,
          type: doc.type,
          chapter,
          chunkOrder: part.order,
          estimatedTokens: part.estimatedTokens,
          text: part.text,
          embeddingStatus: "pending",
          vectorReady: false,
        });
      });
    }
  }

  // --- DOMAIN 05: Topics -------------------------------------------------------
  for (const topic of topics) {
    topic.relatedChapters.sort((a, b) => a - b);
    documents.push(
      createDocument({
        id: `topic-${topic.id}`,
        type: DOCUMENT_TYPES.TOPIC,
        title: topic.name,
        content: topic.description,
        summary: topic.description,
        keywords: topic.keywords,
        topics: [topic.id],
        references: topic.relatedVerses,
        source: topicsFile.source,
        license: topicsFile.license,
        updatedAt: TODAY,
        meta: {
          topicId: topic.id,
          parentTopic: topic.parentTopic,
          childTopics: topic.childTopics,
          aliases: topic.aliases,
          relatedBooks: topic.relatedBooks,
          relatedChapters: topic.relatedChapters,
          relatedVerses: topic.relatedVerses,
        },
      }),
    );
  }

  // --- DOMAIN 06: Dictionary ---------------------------------------------------
  for (const entry of dictionary.entries) {
    documents.push(
      createDocument({
        id: entry.id,
        type: DOCUMENT_TYPES.DICTIONARY,
        title: `${entry.term} (${entry.transliteration})`,
        content: entry.definition,
        summary: `${entry.transliteration} — ${entry.meaning}`,
        keywords: [entry.term, entry.transliteration, entry.meaning].filter(Boolean),
        topics: entry.topics || [],
        references: entry.references || [],
        source: dictionary.source,
        license: dictionary.license,
        updatedAt: TODAY,
        meta: {
          category: entry.category,
          term: entry.term,
          transliteration: entry.transliteration,
          meaning: entry.meaning,
          relatedTerms: entry.relatedTerms || [],
          people: entry.category === "People" ? [entry.term] : [],
          places: entry.category === "Places" ? [entry.term] : [],
        },
      }),
    );
  }

  // --- DOMAIN 07: Cross References --------------------------------------------
  for (const relation of crossrefs.relations) {
    documents.push(
      createDocument({
        id: relation.id,
        type: DOCUMENT_TYPES.CROSSREF,
        title: `${relation.source} → ${relation.target}`,
        content: relation.reason,
        summary: relation.reason,
        keywords: [relation.relationshipType],
        topics: relation.topics || [],
        references: [relation.source, relation.target],
        source: crossrefs.source,
        license: crossrefs.license,
        updatedAt: TODAY,
        meta: {
          source: relation.source,
          target: relation.target,
          relationshipType: relation.relationshipType,
          confidence: relation.confidence,
        },
      }),
    );
  }

  // --- DOMAIN 08: Commentaries -------------------------------------------------
  for (const entry of commentaries.entries) {
    documents.push(
      createDocument({
        id: entry.id,
        type: DOCUMENT_TYPES.COMMENTARY,
        title: `${entry.work} — ${entry.author}`,
        content: entry.summary,
        summary: entry.summary,
        keywords: [entry.author, entry.work],
        topics: entry.topic || [],
        references: entry.relatedVerses || [],
        source: `${entry.author}, ${entry.work} (${entry.publication}).`,
        license: entry.license,
        updatedAt: TODAY,
        meta: { author: entry.author, work: entry.work, publication: entry.publication, link: entry.link },
      }),
    );
  }

  // --- DOMAIN 09: Quotes (dari pullQuote konten) ------------------------------
  for (const day of days) {
    if (!day.pullQuote?.text) continue;
    const chapterTopics = matchTopics(day, scheduleByChapter.get(day.chapter) || {}, topicByAlias);
    documents.push(
      createDocument({
        id: `quote-proverbs-${pad(day.chapter)}`,
        type: DOCUMENT_TYPES.QUOTE,
        title: `Kutipan — ${day.pullQuote.author}`,
        content: day.pullQuote.text,
        summary: `"${day.pullQuote.text}" — ${day.pullQuote.author}`,
        keywords: day.keywords,
        topics: chapterTopics,
        references: [day.goldenVerse?.ref, `Amsal ${day.chapter}`].filter(Boolean),
        source: `Kutipan yang dipakai dalam renungan Amsal ${day.chapter}.`,
        license: "quoted-in-app",
        updatedAt: TODAY,
        meta: { author: day.pullQuote.author, verse: day.goldenVerse?.ref, chapter: day.chapter, language: "id" },
      }),
    );
  }

  // --- DOMAIN 13/14: FAQ & Apologetics ----------------------------------------
  for (const entry of faq.entries) {
    documents.push(faqDocument(entry, DOCUMENT_TYPES.FAQ, faq.source, faq.license));
  }
  for (const entry of apologetics.entries) {
    documents.push(faqDocument(entry, DOCUMENT_TYPES.APOLOGETICS, apologetics.source, apologetics.license));
  }

  // --- CIL DOMAIN: Canon registry books --------------------------------------
  for (const entry of booksRegistry.books || []) {
    documents.push(
      createDocument({
        id: entry.bookId,
        type: DOCUMENT_TYPES.CANON_BOOK,
        title: entry.names?.id || entry.slug,
        content: `${entry.names?.en || ""} — ${entry.genre || ""} (${entry.status})`,
        summary: entry.purpose || entry.names?.en || entry.slug,
        keywords: [...(entry.aliases || []), entry.osis, entry.slug].filter(Boolean),
        topics: [],
        references: [],
        source: "Bible Time Canon Registry",
        license: "editorial-cc-by-nc",
        updatedAt: TODAY,
        meta: {
          ...entry,
          canonicalId: entry.bookId,
          legacyId: entry.slug,
        },
      }),
    );
  }

  // --- CIL DOMAIN: Doctrine / Character / Timeline / Symbol / Wisdom / App ---
  for (const entry of doctrines.doctrines || []) {
    documents.push(
      createDocument({
        id: entry.id,
        type: DOCUMENT_TYPES.DOCTRINE,
        title: entry.name,
        content: [entry.summary, ...(entry.boundaries || []), ...(entry.interpretiveNotes || [])].join("\n"),
        summary: entry.summary,
        keywords: [entry.name, ...(entry.relatedTopics || [])],
        topics: entry.relatedTopics || [],
        references: [...(entry.supportingRefs || []), ...(entry.contrastingRefs || [])],
        source: doctrines.source,
        updatedAt: TODAY,
        meta: { ...entry, canonicalId: entry.id },
      }),
    );
  }
  for (const entry of characters.characters || []) {
    documents.push(
      createDocument({
        id: entry.id,
        type: DOCUMENT_TYPES.CHARACTER,
        title: entry.name,
        content: [...(entry.lessons || []), ...(entry.boundaries || [])].join("\n"),
        summary: (entry.lessons || [])[0] || entry.name,
        keywords: [entry.name, ...(entry.roles || [])],
        topics: [],
        references: entry.references || [],
        source: characters.source,
        updatedAt: TODAY,
        meta: { ...entry, canonicalId: entry.id },
      }),
    );
  }
  for (const entry of timeline.events || []) {
    documents.push(
      createDocument({
        id: entry.id,
        type: DOCUMENT_TYPES.TIMELINE,
        title: entry.name,
        content: entry.summary,
        summary: entry.summary,
        keywords: [entry.epoch, entry.name].filter(Boolean),
        topics: [],
        references: entry.references || [],
        source: timeline.source,
        updatedAt: TODAY,
        meta: { ...entry, canonicalId: entry.id },
      }),
    );
  }
  for (const entry of symbols.symbols || []) {
    documents.push(
      createDocument({
        id: entry.id,
        type: DOCUMENT_TYPES.SYMBOL,
        title: entry.name,
        content: (entry.meanings || []).join("; "),
        summary: (entry.meanings || [])[0] || entry.name,
        keywords: [entry.name, ...(entry.meanings || [])],
        topics: entry.topics || [],
        references: entry.references || [],
        source: symbols.source,
        updatedAt: TODAY,
        meta: { ...entry, canonicalId: entry.id },
      }),
    );
  }
  for (const entry of wisdom.patterns || []) {
    documents.push(
      createDocument({
        id: entry.id,
        type: DOCUMENT_TYPES.WISDOM_PATTERN,
        title: entry.name,
        content: `${entry.summary}\n${entry.discernmentNote || ""}`,
        summary: entry.summary,
        keywords: [entry.name, ...(entry.topics || [])],
        topics: entry.topics || [],
        references: [...(entry.proverbsAnchors || []), ...(entry.crossCanon || [])],
        source: wisdom.source,
        updatedAt: TODAY,
        meta: { ...entry, canonicalId: entry.id },
      }),
    );
  }
  for (const entry of applications.applications || []) {
    documents.push(
      createDocument({
        id: entry.id,
        type: DOCUMENT_TYPES.APPLICATION,
        title: entry.title,
        content: [entry.invitation, ...(entry.practices || []), ...(entry.cautions || [])].join("\n"),
        summary: entry.invitation,
        keywords: [entry.theme, ...(entry.domains || [])],
        topics: entry.relatedTopics || [],
        references: entry.references || [],
        source: applications.source,
        updatedAt: TODAY,
        meta: { ...entry, canonicalId: entry.id, legacyId: `proverbs-challenge-${pad(entry.chapter)}` },
      }),
    );
  }

  // Enrich chapter docs with canonical IDs in meta
  for (const doc of documents) {
    if (doc.type === DOCUMENT_TYPES.CHAPTER && doc.meta?.chapter) {
      doc.meta.canonicalId = canonicalChapterId("proverbs", doc.meta.chapter);
      doc.meta.bookId = canonicalBookId("proverbs");
      doc.meta.legacyId = doc.id;
    }
    if (doc.type === DOCUMENT_TYPES.GOLDEN_VERSE && doc.meta?.chapter) {
      const verse = Number(String(doc.meta.verse || doc.references?.[0] || "").match(/:(\d+)/)?.[1]);
      doc.meta.canonicalId = Number.isFinite(verse)
        ? canonicalRefId("proverbs", doc.meta.chapter, verse)
        : canonicalRefId("proverbs", doc.meta.chapter);
      doc.meta.legacyId = doc.id;
    }
  }

  // --- Validasi bentuk dokumen -------------------------------------------------
  const errors = [];
  const seen = new Set();
  for (const doc of documents) {
    const docErrors = validateDocument(doc);
    if (docErrors.length) errors.push(`${doc.id}: ${docErrors.join("; ")}`);
    if (seen.has(doc.id)) errors.push(`ID duplikat: ${doc.id}`);
    seen.add(doc.id);
  }
  if (errors.length) {
    console.error("Build gagal — dokumen tidak valid:\n" + errors.join("\n"));
    process.exit(1);
  }

  // --- Indexes -----------------------------------------------------------------
  const indexes = buildIndexes(documents);

  // --- Tulis bundel per pasal --------------------------------------------------
  await mkdir(path.join(KDIR, "books", "proverbs"), { recursive: true });
  for (const [chapter, docs] of chapterBundles) {
    await writeJson(path.join(KDIR, "books", "proverbs", `chapter-${pad(chapter)}.json`), {
      book: "proverbs",
      chapter,
      version: VERSION,
      updatedAt: TODAY,
      documents: docs,
    });
  }

  // --- Tulis indexes -----------------------------------------------------------
  await mkdir(path.join(KDIR, "indexes"), { recursive: true });
  const indexFiles = {
    "keyword-index.json": indexes.keyword,
    "topic-index.json": indexes.topic,
    "verse-index.json": indexes.verse,
    "chapter-index.json": indexes.chapter,
    "book-index.json": indexes.book,
    "people-index.json": indexes.people,
    "places-index.json": indexes.places,
    "quote-index.json": indexes.quote,
    "dictionary-index.json": indexes.dictionary,
    "commentary-index.json": indexes.commentary,
    "faq-index.json": indexes.faq,
  };
  for (const [name, data] of Object.entries(indexFiles)) {
    await writeJson(path.join(KDIR, "indexes", name), data);
  }

  // --- Tulis dist exports ------------------------------------------------------
  await mkdir(path.join(KDIR, "dist"), { recursive: true });
  const cilArtifacts = buildCilArtifacts({
    booksRegistry,
    referenceAliases,
    topics,
    documents,
    doctrines,
    characters,
    timeline,
    symbols,
    wisdom,
    applications,
    crossrefs,
  });

  const knowledge = {
    meta: {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      book: "proverbs",
      counts: countByType(documents),
      totalDocuments: documents.length,
      totalChunks: chunks.length,
      cil: {
        graphNodes: cilArtifacts.graph.nodes.length,
        graphEdges: cilArtifacts.graph.edges.length,
        canonBooks: (booksRegistry.books || []).length,
        doctrines: (doctrines.doctrines || []).length,
        characters: (characters.characters || []).length,
        timeline: (timeline.events || []).length,
        symbols: (symbols.symbols || []).length,
        wisdomPatterns: (wisdom.patterns || []).length,
        applications: (applications.applications || []).length,
      },
    },
    book,
    topics,
    documents,
    indexes,
    canon: {
      books: booksRegistry.books,
      aliases: referenceAliases.aliases,
    },
    domains: {
      doctrines: doctrines.doctrines,
      characters: characters.characters,
      timeline: timeline.events,
      symbols: symbols.symbols,
      wisdom: wisdom.patterns,
      applications: applications.applications,
    },
  };
  await writeJson(path.join(KDIR, "dist", "knowledge.min.json"), knowledge, false);
  await writeJson(path.join(KDIR, "dist", "topic-index.json"), indexes.topic);
  await writeJson(path.join(KDIR, "dist", "crossref-index.json"), buildCrossrefIndex(crossrefs));
  await writeJson(path.join(KDIR, "dist", "dictionary-index.json"), indexes.dictionary);
  await writeJson(path.join(KDIR, "dist", "faq-index.json"), indexes.faq);
  await writeJson(path.join(KDIR, "dist", "search-index.json"), buildSearchIndex(documents), false);
  await writeJson(path.join(KDIR, "dist", "knowledge.chunks.json"), { version: VERSION, generatedAt: TODAY, chunks }, false);

  await writeJson(path.join(KDIR, "dist", "canon-index.json"), cilArtifacts.canonIndex);
  await writeJson(path.join(KDIR, "dist", "reference-index.json"), cilArtifacts.referenceIndex);
  await writeJson(path.join(KDIR, "dist", "doctrine-index.json"), cilArtifacts.domainIndexes.doctrine);
  await writeJson(path.join(KDIR, "dist", "character-index.json"), cilArtifacts.domainIndexes.character);
  await writeJson(path.join(KDIR, "dist", "timeline-index.json"), cilArtifacts.domainIndexes.timeline);
  await writeJson(path.join(KDIR, "dist", "symbol-index.json"), cilArtifacts.domainIndexes.symbol);
  await writeJson(path.join(KDIR, "dist", "wisdom-index.json"), cilArtifacts.domainIndexes.wisdom);
  await writeJson(path.join(KDIR, "dist", "application-index.json"), cilArtifacts.domainIndexes.application);
  await writeJson(path.join(KDIR, "dist", "graph-nodes.json"), { version: VERSION, nodes: cilArtifacts.graph.nodes }, false);
  await writeJson(path.join(KDIR, "dist", "graph-edges.json"), { version: VERSION, edges: cilArtifacts.graph.edges }, false);

  const artifactList = [
    "knowledge.min.json",
    "search-index.json",
    "topic-index.json",
    "crossref-index.json",
    "dictionary-index.json",
    "faq-index.json",
    "knowledge.chunks.json",
    "canon-index.json",
    "reference-index.json",
    "doctrine-index.json",
    "character-index.json",
    "timeline-index.json",
    "symbol-index.json",
    "wisdom-index.json",
    "application-index.json",
    "graph-nodes.json",
    "graph-edges.json",
  ];
  const checksums = {};
  for (const name of artifactList) {
    const raw = await readFile(path.join(KDIR, "dist", name));
    checksums[name] = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  }
  await writeJson(path.join(KDIR, "dist", "manifest.json"), {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    artifacts: artifactList,
    counts: knowledge.meta.counts,
    cil: knowledge.meta.cil,
    checksums,
  });

  console.log(
    `BUILD OK — ${documents.length} dokumen, ${chunks.length} chunk, ${topics.length} topik, ${chapterBundles.size} pasal, graph ${cilArtifacts.graph.nodes.length}n/${cilArtifacts.graph.edges.length}e.`,
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function buildCilArtifacts({
  booksRegistry,
  referenceAliases,
  topics,
  documents,
  doctrines,
  characters,
  timeline,
  symbols,
  wisdom,
  applications,
  crossrefs,
}) {
  const books = booksRegistry.books || [];
  const canonIndex = {
    version: VERSION,
    byId: Object.fromEntries(books.map((b) => [b.bookId, b])),
    byOsis: Object.fromEntries(books.map((b) => [b.osis, b.bookId])),
    bySlug: Object.fromEntries(books.map((b) => [b.slug, b.bookId])),
    aliases: referenceAliases.aliases || {},
    productionBookIds: books.filter((b) => b.status === "production").map((b) => b.bookId),
    seedBookIds: books.filter((b) => b.status === "seed").map((b) => b.bookId),
  };

  const referenceIndex = { version: VERSION, byCanonicalId: {}, byDisplay: {}, resolvable: [] };
  const addRef = (canonicalId, display, meta = {}) => {
    if (!canonicalId) return;
    referenceIndex.byCanonicalId[canonicalId] = { id: canonicalId, display, ...meta };
    if (display) referenceIndex.byDisplay[normalizeText(display)] = canonicalId;
    referenceIndex.resolvable.push(canonicalId);
  };

  for (const book of books) {
    addRef(book.bookId, book.names?.id || book.slug, { type: "book", status: book.status });
    if (book.status === "production") {
      for (let ch = 1; ch <= book.chapterCount; ch += 1) {
        const chapterId = canonicalChapterId(book.slug, ch);
        addRef(chapterId, `${book.names?.id || book.slug} ${ch}`, {
          type: "chapter",
          bookId: book.bookId,
          chapter: ch,
          status: book.status,
        });
      }
    }
  }

  for (const doc of documents) {
    if (doc.meta?.canonicalId) {
      addRef(doc.meta.canonicalId, doc.references?.[0] || doc.title, {
        type: doc.type,
        legacyId: doc.meta.legacyId || doc.id,
      });
    }
    for (const ref of doc.references || []) {
      const parsed = parseLooseRef(ref, canonIndex);
      if (parsed?.canonicalId) addRef(parsed.canonicalId, ref, { type: "reference" });
    }
  }

  const domainIndexes = {
    doctrine: indexById(doctrines.doctrines || [], "relatedTopics", "supportingRefs"),
    character: indexById(characters.characters || [], null, "references"),
    timeline: indexById(timeline.events || [], null, "references"),
    symbol: indexById(symbols.symbols || [], "topics", "references"),
    wisdom: indexById(wisdom.patterns || [], "topics", "proverbsAnchors"),
    application: indexById(applications.applications || [], "domains", "references"),
  };

  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const addNode = (id, type, label, meta = {}) => {
    if (!id || nodeIds.has(id)) return;
    nodeIds.add(id);
    nodes.push({ id, type, label, meta });
  };
  const addEdge = (from, to, relation, weight = 1, why = "") => {
    if (!from || !to) return;
    edges.push({ id: `e:${from}->${to}:${relation}`, from, to, relation, weight, why });
  };

  for (const book of books) addNode(book.bookId, "book", book.names?.id || book.slug, { status: book.status });
  for (const topic of topics) {
    const id = topic.id.startsWith("topic:") ? topic.id : `topic:${topic.id}`;
    addNode(id, "topic", topic.name || topic.id, { legacyId: topic.id });
    if (topic.parentTopic) {
      const parent = topic.parentTopic.startsWith("topic:") ? topic.parentTopic : `topic:${topic.parentTopic}`;
      addEdge(id, parent, "child-of", 1, "ontology parent");
    }
    for (const related of topic.relatedTopics || topic.opposites || []) {
      const other = String(related).startsWith("topic:") ? related : `topic:${related}`;
      addEdge(id, other, "related", 0.7, "topic relation");
    }
    for (const ch of topic.relatedChapters || []) {
      addEdge(id, canonicalChapterId("proverbs", ch), "about-chapter", 0.8, "topic-chapter");
    }
  }
  for (const doc of documents.filter((d) => d.type === DOCUMENT_TYPES.CHAPTER)) {
    const bookSlug = doc.meta?.bookSlug || resolveBookSlug(doc.meta?.book, canonIndex) || "proverbs";
    const id = doc.meta?.canonicalId || canonicalChapterId(bookSlug, doc.meta?.chapter);
    addNode(id, "chapter", doc.title, { chapter: doc.meta?.chapter, legacyId: doc.id });
    addEdge(canonicalBookId(bookSlug), id, "contains", 1, "book hierarchy");
    for (const t of doc.topics || []) addEdge(id, t.startsWith("topic:") ? t : `topic:${t}`, "has-topic", 0.8);
  }
  for (const rel of crossrefs.relations || []) {
    const src = parseLooseRef(rel.source, canonIndex);
    const tgt = parseLooseRef(rel.target, canonIndex);
    if (src?.canonicalId && tgt?.canonicalId) {
      addNode(src.canonicalId, "reference", rel.source);
      addNode(tgt.canonicalId, "reference", rel.target);
      addEdge(src.canonicalId, tgt.canonicalId, rel.relationshipType || "related", rel.confidence || 0.7, rel.reason || "");
    }
  }
  for (const entry of doctrines.doctrines || []) {
    addNode(entry.id, "doctrine", entry.name);
    for (const ref of entry.supportingRefs || []) addEdge(entry.id, ref, "supports", entry.confidence || 0.8);
    for (const ref of entry.contrastingRefs || []) addEdge(entry.id, ref, "contrasts", 0.7);
    for (const t of entry.relatedTopics || []) addEdge(entry.id, `topic:${t}`, "about-topic", 0.8);
  }
  for (const entry of characters.characters || []) {
    addNode(entry.id, "character", entry.name);
    for (const ref of entry.references || []) addEdge(entry.id, ref, "appears-in", entry.confidence || 0.8);
    for (const ev of entry.events || []) addEdge(entry.id, ev, "in-event", 0.8);
  }
  for (const entry of timeline.events || []) {
    addNode(entry.id, "timeline", entry.name);
    for (const ref of entry.references || []) addEdge(entry.id, ref, "anchors", entry.confidence || 0.8);
  }
  for (const entry of symbols.symbols || []) {
    addNode(entry.id, "symbol", entry.name);
    for (const ref of entry.references || []) addEdge(entry.id, ref, "symbolizes-in", entry.confidence || 0.8);
    for (const c of entry.contrasts || []) addEdge(entry.id, c, "contrasts", 0.7);
  }
  for (const entry of wisdom.patterns || []) {
    addNode(entry.id, "wisdom-pattern", entry.name);
    for (const ref of [...(entry.proverbsAnchors || []), ...(entry.crossCanon || [])]) {
      addEdge(entry.id, ref, "pattern-link", entry.confidence || 0.8);
    }
  }
  for (const entry of applications.applications || []) {
    addNode(entry.id, "application", entry.title);
    addEdge(entry.id, entry.chapterId || canonicalChapterId("proverbs", entry.chapter), "applies-to", entry.confidence || 0.8);
  }

  return {
    canonIndex,
    referenceIndex: {
      ...referenceIndex,
      resolvable: [...new Set(referenceIndex.resolvable)],
    },
    domainIndexes,
    graph: { nodes, edges },
  };
}

function indexById(entries, topicField, refField) {
  const byId = {};
  const byTopic = {};
  const byRef = {};
  for (const entry of entries) {
    byId[entry.id] = entry;
    for (const t of (topicField && entry[topicField]) || []) {
      (byTopic[t] ||= []).push(entry.id);
    }
    for (const r of (refField && entry[refField]) || []) {
      (byRef[r] ||= []).push(entry.id);
    }
    if (entry.chapter != null) (byTopic[`chapter:${entry.chapter}`] ||= []).push(entry.id);
  }
  return { byId, byTopic, byRef, ids: entries.map((e) => e.id) };
}

function parseLooseRef(text, canonIndex) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  if (raw.startsWith("ref:") || raw.startsWith("chapter:") || raw.startsWith("book:")) {
    return { canonicalId: raw, display: raw };
  }
  const match = raw.match(/^([1-3]?\s*[A-Za-z\u00C0-\u024F]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/u);
  if (!match) return null;
  const bookKey = normalizeText(match[1]).replace(/\s+/g, "");
  const bookId = canonIndex.aliases[bookKey] || canonIndex.bySlug[bookKey];
  if (!bookId) return null;
  const book = canonIndex.byId[bookId];
  const chapter = Number(match[2]);
  const verse = match[3] ? Number(match[3]) : null;
  if (book?.status === "production" && (chapter < 1 || chapter > book.chapterCount)) return null;
  const canonicalId = verse
    ? canonicalRefId(book.slug, chapter, verse)
    : canonicalChapterId(book.slug, chapter);
  return { canonicalId, display: raw, bookId, chapter, verse };
}

function resolveBookSlug(input, canonIndex) {
  const key = normalizeText(input).replace(/\s+/g, "");
  const bookId = canonIndex.aliases?.[key] || canonIndex.bySlug?.[key];
  return bookId ? canonIndex.byId?.[bookId]?.slug || null : null;
}

function faqDocument(entry, type, source, license) {
  return createDocument({
    id: entry.id,
    type,
    title: entry.question,
    content: entry.answer,
    summary: entry.answer,
    keywords: (entry.relatedTopics || []).slice(),
    topics: entry.relatedTopics || [],
    references: entry.references || [],
    source,
    license,
    updatedAt: TODAY,
    meta: { question: entry.question },
  });
}

function buildAliasLookup(topics) {
  const lookup = [];
  for (const topic of topics) {
    const aliases = new Set([topic.name, ...(topic.aliases || []), ...(topic.keywords || [])]);
    for (const alias of aliases) {
      const norm = normalizeText(alias);
      if (norm) lookup.push({ topicId: topic.id, alias: norm });
    }
  }
  return lookup;
}

function matchTopics(day, plan, aliasLookup) {
  const haystack = normalizeText(
    [day.title, day.theme, plan.theme, (day.keywords || []).join(" ")].filter(Boolean).join(" "),
  );
  const matched = new Set();
  for (const { topicId, alias } of aliasLookup) {
    if (haystack.includes(alias)) matched.add(topicId);
  }
  return [...matched];
}

function buildDiscussion(day) {
  return [
    `Apa gagasan utama dari ${day.title}?`,
    `Bagaimana tema "${day.theme}" terlihat dalam kehidupan sehari-hari?`,
  ];
}

function buildSmallGroup(day) {
  return [
    `Bagikan satu pengalaman yang berkaitan dengan Amsal ${day.chapter}.`,
    `Langkah konkret apa yang dapat kelompok ambil minggu ini berdasarkan pasal ini?`,
  ];
}

function extractLanguageNote(exegesis) {
  const match = String(exegesis || "").match(/[^.]*\b(Ibrani|Yunani|chokmah|musar|lev|daat|binah|mezimmah)\b[^.]*\./i);
  return match ? match[0].trim() : "";
}

function buildIndexes(documents) {
  const index = {
    keyword: {},
    topic: {},
    verse: {},
    chapter: {},
    book: {},
    people: {},
    places: {},
    quote: {},
    dictionary: {},
    commentary: {},
    faq: {},
  };
  const add = (bucket, key, id) => {
    const norm = String(key || "").trim();
    if (!norm) return;
    (bucket[norm] ||= []).push(id);
  };
  for (const doc of documents) {
    for (const kw of doc.keywords || []) add(index.keyword, normalizeText(kw), doc.id);
    for (const t of doc.topics || []) add(index.topic, t, doc.id);
    for (const ref of doc.references || []) add(index.verse, ref, doc.id);
    if (Number.isFinite(doc.meta?.chapter)) add(index.chapter, String(doc.meta.chapter), doc.id);
    if (doc.meta?.book) add(index.book, normalizeText(doc.meta.book), doc.id);
    for (const p of doc.meta?.people || []) add(index.people, normalizeText(p), doc.id);
    for (const p of doc.meta?.places || []) add(index.places, normalizeText(p), doc.id);
    if (doc.type === DOCUMENT_TYPES.QUOTE) add(index.quote, doc.id, doc.id);
    if (doc.type === DOCUMENT_TYPES.DICTIONARY) add(index.dictionary, doc.id, doc.id);
    if (doc.type === DOCUMENT_TYPES.COMMENTARY) add(index.commentary, doc.id, doc.id);
    if (doc.type === DOCUMENT_TYPES.FAQ || doc.type === DOCUMENT_TYPES.APOLOGETICS) add(index.faq, doc.id, doc.id);
  }
  return index;
}

function buildCrossrefIndex(crossrefs) {
  const bySource = {};
  for (const relation of crossrefs.relations) {
    (bySource[relation.source] ||= []).push({
      target: relation.target,
      relationshipType: relation.relationshipType,
      confidence: relation.confidence,
    });
  }
  return bySource;
}

function buildSearchIndex(documents) {
  return documents.map((doc) => ({
    id: doc.id,
    type: doc.type,
    title: doc.title,
    keywords: doc.keywords,
    topics: doc.topics,
    references: doc.references,
    chapter: doc.meta?.chapter ?? null,
    importance: doc.meta?.importanceScore ?? null,
  }));
}

function countByType(documents) {
  const counts = {};
  for (const doc of documents) counts[doc.type] = (counts[doc.type] || 0) + 1;
  return counts;
}

async function writeJson(filePath, data, pretty = true) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, pretty ? 2 : 0) + "\n", "utf8");
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function parseChapter(reference) {
  const match = String(reference || "").match(/Amsal\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function pushMap(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
