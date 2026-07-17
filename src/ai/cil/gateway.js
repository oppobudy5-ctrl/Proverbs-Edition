import { estimateTokens } from "../knowledge/schema.js";
import { normalizeText } from "../ai-utils.js";
import { createCanonicalContext } from "./canonical-context.js";
import { toLegacyAIContext } from "./compatibility-adapter.js";
import { canonicalEngine } from "./engines/canonical-engine.js";
import { topicEngine } from "./engines/topic-engine.js";
import { relationshipEngine } from "./engines/relationship-engine.js";
import { knowledgeGraphEngine } from "./engines/knowledge-graph-engine.js";
import { doctrineEngine } from "./engines/doctrine-engine.js";
import { characterEngine } from "./engines/character-engine.js";
import { timelineEngine } from "./engines/timeline-engine.js";
import { symbolEngine } from "./engines/symbol-engine.js";
import { wisdomEngine } from "./engines/wisdom-engine.js";
import { applicationEngine } from "./engines/application-engine.js";
import { citationEngine } from "./citation-engine.js";
import { scoreCanonicalConfidence } from "./confidence.js";
import { theologicalGuardrails } from "./theological-guardrails.js";

let journalConsentFn = null;
async function resolveJournalConsent() {
  if (journalConsentFn) return journalConsentFn();
  try {
    const mod = await import("../../../js/journal/consent.js");
    journalConsentFn = mod.isJournalAiConsentGranted;
    return journalConsentFn();
  } catch {
    return false;
  }
}

/**
 * Canonical Context Gateway — sole runtime path from AI intents to BKB/CIL data.
 */
export class CanonicalContextGateway {
  #ready = false;
  #coreLoaded = false;
  #domainsLoaded = new Set();
  #kb = null;
  #documents = [];
  #searchEngine = null;
  #baseUrl = "";
  #fetchImpl = null;
  #degraded = false;

  get ready() {
    return this.#ready;
  }

  get degraded() {
    return this.#degraded;
  }

  /**
   * Progressive init: core canon/topic/reference/graph first; domains on demand.
   */
  async init(options = {}) {
    if (this.#ready && !options.force) return this;
    this.#baseUrl = options.baseUrl || "";
    this.#fetchImpl = options.fetchImpl || globalThis.fetch;
    this.#degraded = false;

    if (options.bundle) {
      this.#loadFromBundle(options.bundle, options);
      this.#ready = true;
      this.#coreLoaded = true;
      return this;
    }

    try {
      const knowledge = await this.#fetchJson("knowledge/dist/knowledge.min.json");
      const [canonIndex, referenceIndex, graphNodes, graphEdges] = await Promise.all([
        this.#fetchJson("knowledge/dist/canon-index.json").catch(() => null),
        this.#fetchJson("knowledge/dist/reference-index.json").catch(() => null),
        this.#fetchJson("knowledge/dist/graph-nodes.json").catch(() => null),
        this.#fetchJson("knowledge/dist/graph-edges.json").catch(() => null),
      ]);
      this.#loadFromBundle(knowledge, {
        canonIndex: canonIndex || buildCanonFromBundle(knowledge),
        referenceIndex,
        graph: {
          nodes: graphNodes?.nodes || [],
          edges: graphEdges?.edges || [],
        },
        ...options,
      });
      this.#ready = true;
      this.#coreLoaded = true;
    } catch (error) {
      this.#degraded = true;
      this.#ready = true;
      this.#coreLoaded = false;
      // Still attempt a minimal canon load so citation verification does not crash.
      try {
        const knowledge = await this.#fetchJson("knowledge/dist/knowledge.min.json");
        canonicalEngine.load(buildCanonFromBundle(knowledge));
        citationEngine.canon = canonicalEngine;
        this.#kb = knowledge;
        this.#documents = knowledge.documents || [];
      } catch {
        canonicalEngine.load({
          byId: {
            "book:proverbs": {
              bookId: "book:proverbs",
              slug: "proverbs",
              names: { id: "Amsal", en: "Proverbs" },
              chapterCount: 31,
              status: "production",
              osis: "Prov",
            },
          },
          bySlug: { proverbs: "book:proverbs", amsal: "book:proverbs" },
          byOsis: { Prov: "book:proverbs" },
          aliases: { amsal: "book:proverbs", ams: "book:proverbs", prov: "book:proverbs", proverbs: "book:proverbs", pr: "book:proverbs" },
        });
        citationEngine.canon = canonicalEngine;
      }
      if (options.allowDegraded === false) throw error;
    }
    return this;
  }

  async ensureDomain(name) {
    if (this.#domainsLoaded.has(name) || this.#degraded) return;
    // Domains already embedded in knowledge.min.json when loaded via bundle.
    if (this.#kb?.domains?.[domainKey(name)]) {
      this.#loadDomain(name, this.#kb.domains[domainKey(name)]);
      return;
    }
    try {
      const data = await this.#fetchJson(`knowledge/dist/${name}-index.json`);
      const entries = Object.values(data.byId || {});
      this.#loadDomain(name, entries);
    } catch {
      // Keep going; domain simply empty.
      this.#domainsLoaded.add(name);
    }
  }

  async buildCanonicalContext(input = {}) {
    const started = now();
    if (!this.#ready) await this.init(input.init || {});

    if (this.#degraded || !this.#coreLoaded) {
      return this.#buildDegradedContext(input, started);
    }

    await Promise.all([
      this.ensureDomain("doctrine"),
      this.ensureDomain("character"),
      this.ensureDomain("timeline"),
      this.ensureDomain("symbol"),
      this.ensureDomain("wisdom"),
      this.ensureDomain("application"),
    ]);

    const bookSlug = input.book || "proverbs";
    const chapterNum = Number(input.chapter) || null;
    const day = Number(input.day) || null;
    const chapterDoc = this.#findChapterDoc(chapterNum, day);
    const bookMeta = canonicalEngine.getBook(bookSlug) || canonicalEngine.getBook("proverbs");
    const chapterMeta = chapterNum
      ? {
          ...canonicalEngine.getChapterMeta(bookSlug, chapterNum),
          title: chapterDoc?.title || input.title || "",
          summary: chapterDoc?.summary || chapterDoc?.content || input.summary || "",
        }
      : null;

    const golden = this.#findGoldenVerse(chapterNum);
    const topics = topicEngine.forChapter(chapterNum, 8);
    const crossrefs = this.#crossrefsForChapter(chapterNum);
    const doctrines = doctrineEngine.forChapter(chapterNum, 5);
    const characters = characterEngine.forChapter(chapterNum, 5);
    const historical = timelineEngine.forChapter(chapterNum, 4);
    const symbols = symbolEngine.forChapter(chapterNum, 6);
    const wisdomPatterns = wisdomEngine.forChapter(chapterNum, 4);
    const application = applicationEngine.forChapter(chapterNum);
    const reflectionDoc = this.#findTyped(chapterNum, "reflection");
    const prayerDoc = this.#findTyped(chapterNum, "prayer");
    const challengeDoc = this.#findTyped(chapterNum, "challenge");
    const faq = this.#matchFaq(input.query || input.question || input.topic, 3);
    const commentary = this.#documents.filter((d) => d.type === "commentary").slice(0, 2);

    const chapterId = chapterMeta?.canonicalId;
    const graphLinks = chapterId
      ? knowledgeGraphEngine.neighbors(chapterId, { limit: 12 }).map((n) => ({
          id: n.otherId,
          type: n.node?.type,
          label: n.node?.label,
          relation: n.edge?.relation,
          why: n.edge?.why || "",
        }))
      : [];

    const interpretiveNotes = [
      ...doctrines.flatMap((d) => d.interpretiveNotes || []),
      ...wisdomPatterns.map((p) => p.discernmentNote).filter(Boolean),
    ].slice(0, 5);

    const citations = [];
    if (chapterMeta) {
      citations.push({
        display: `${chapterMeta.bookName} ${chapterMeta.chapter}`,
        canonicalId: chapterMeta.canonicalId,
        verified: true,
      });
    }
    if (golden?.references?.[0]) {
      const parsed = citationEngine.verify(golden.references[0]);
      if (parsed.ok) citations.push(parsed);
      else citations.push({ display: golden.references[0], verified: true, canonicalId: null });
    }
    for (const xr of crossrefs.slice(0, 4)) {
      const v = citationEngine.verify(xr.target);
      if (v.ok) citations.push(v);
    }

    const storedConsent = await resolveJournalConsent();
    const allowJournal = !!(input.journalConsent && storedConsent && input.journal?.excerpt);
    const journalExcerpt = allowJournal ? String(input.journal.excerpt).slice(0, 4000) : "";

    const retrieved = await this.retrieve(input.query || input.question || "", {
      chapter: chapterNum,
      day,
      limit: input.limit || 5,
    });

    const coverage = {
      score: [
        !!bookMeta,
        !!chapterMeta,
        topics.length > 0,
        crossrefs.length > 0,
        doctrines.length > 0,
        !!application,
        !!golden,
      ].filter(Boolean).length / 7,
      chapters: chapterMeta ? 1 : 0,
      topics: topics.length,
      crossrefs: crossrefs.length,
      doctrines: doctrines.length,
      domains: [doctrines, characters, historical, symbols, wisdomPatterns].filter((a) => a.length).length,
    };

    const confidence = scoreCanonicalConfidence({
      coverageScore: coverage.score,
      crossrefCount: crossrefs.length,
      commentaryCount: commentary.length,
      historicalCount: historical.length,
      semanticScore: retrieved[0]?.score ? Math.min(1, retrieved[0].score / 100) : 0.55,
      degraded: false,
      hasBook: !!bookMeta,
      hasChapter: !!chapterMeta,
      hasTopics: topics.length > 0,
      hasDoctrines: doctrines.length > 0,
      hasApplication: !!application,
      hasGoldenVerse: !!golden,
    });

    const summary = chapterDoc?.summary || chapterDoc?.content || input.summary || "";
    const tokenBudget = Number(input.tokenBudget) || 1800;
    const context = createCanonicalContext({
      book: bookMeta,
      chapter: chapterMeta,
      verse: input.verse ? canonicalEngine.parseReference(`${bookMeta?.names?.id || "Amsal"} ${chapterNum}:${input.verse}`) : null,
      day: day || chapterDoc?.meta?.day || null,
      intent: input.intent || "",
      themes: [chapterDoc?.meta?.theme, input.theme].filter(Boolean),
      keywords: chapterDoc?.keywords || [],
      goldenVerse: golden
        ? { ref: golden.references?.[0] || "", text: golden.content || golden.summary || "", translation: golden.meta?.translation || "" }
        : null,
      crossrefs,
      topics: topics.map((t) => ({ id: t.id, name: t.name, description: t.description })),
      characters: characters.map(compactDomain),
      doctrines: doctrines.map(compactDomain),
      historical: historical.map(compactDomain),
      symbols: symbols.map(compactDomain),
      wisdomPatterns: wisdomPatterns.map(compactDomain),
      application: application
        ? {
            id: application.id,
            invitation: application.invitation,
            practices: application.practices,
            cautions: application.cautions,
            domains: application.domains,
          }
        : null,
      reflection: splitLines(reflectionDoc?.content),
      prayer: prayerDoc?.content || "",
      challenge: challengeDoc?.content || application?.invitation || "",
      faq: faq.map((f) => ({ id: f.id, question: f.title, answer: f.summary || f.content })),
      commentary: commentary.map((c) => ({ id: c.id, title: c.title, summary: c.summary })),
      graphLinks,
      citations,
      allowedCitations: citations,
      interpretiveNotes,
      coverage,
      confidence: confidence.score,
      confidenceComponents: confidence.components,
      tokenEstimate: 0,
      degraded: false,
      privacy: { journalIncluded: allowJournal, indexed: false, cached: false, persisted: false },
      journalExcerpt,
      retrieved,
      summary,
      title: chapterDoc?.title || input.title || "",
      theme: chapterDoc?.meta?.theme || input.theme || "",
      question: input.question || input.query || "",
      metadata: {
        source: "cil",
        tookMs: Math.round(now() - started),
        tokenBudget,
        generatedAt: new Date().toISOString(),
        ...(input.metadata || {}),
      },
    });

    const serialized = JSON.stringify({
      title: context.title,
      theme: context.theme,
      summary: context.summary,
      goldenVerse: context.goldenVerse,
      topics: context.topics,
      doctrines: context.doctrines,
      crossrefs: context.crossrefs,
      application: context.application,
      citations: context.citations,
      interpretiveNotes: context.interpretiveNotes,
    });
    const tokenEstimate = estimateTokens(serialized);
    return createCanonicalContext({
      ...context,
      tokenEstimate,
      metadata: { ...context.metadata, tokenEstimate },
    });
  }

  async retrieve(query, options = {}) {
    if (!this.#ready) await this.init(options.init || {});
    if (this.#degraded) return [];
    const limit = Math.max(1, options.limit || 5);
    const chapter = Number(options.chapter);
    const day = Number(options.day);
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    const ranked = this.#documents
      .filter((d) => ["chapter", "golden-verse", "reflection", "faq", "doctrine", "application"].includes(d.type))
      .map((doc) => {
        let score = 0;
        const hay = normalizeText(`${doc.title} ${doc.summary} ${doc.content} ${(doc.keywords || []).join(" ")}`);
        for (const term of terms) if (hay.includes(term)) score += 10;
        if (Number.isFinite(chapter) && doc.meta?.chapter === chapter) score += 100;
        if (Number.isFinite(day) && doc.meta?.day === day) score += 40;
        return {
          id: doc.id,
          type: doc.type,
          title: doc.title,
          summary: doc.summary,
          chapter: doc.meta?.chapter ?? null,
          day: doc.meta?.day ?? null,
          book: "Amsal",
          theme: doc.meta?.theme || "",
          keywords: doc.keywords || [],
          goldenVerse: doc.type === "golden-verse" ? { ref: doc.references?.[0], text: doc.content } : null,
          score,
          reasons: score > 0 ? ["cil-match"] : [],
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return ranked;
  }

  async semanticSearch(query, options = {}) {
    if (!this.#searchEngine) {
      const { initSemanticSearch, semanticSearchEngine } = await import("../knowledge/index.js");
      await initSemanticSearch({ ...(options.init || {}), data: this.#kb || options.data });
      this.#searchEngine = semanticSearchEngine;
    }
    return this.#searchEngine.search(query, options);
  }

  async suggestSearch(query, options = {}) {
    if (!this.#searchEngine) await this.semanticSearch(query || "hikmat", { ...options, limit: 1 });
    return this.#searchEngine.suggest(query, options);
  }

  async relatedSearch(target = {}, options = {}) {
    if (!this.#searchEngine) await this.semanticSearch("hikmat", { ...options, limit: 1 });
    return this.#searchEngine.relatedSearch(target, options);
  }

  validateResponse(content, context, options = {}) {
    return theologicalGuardrails.validate(content, context, options);
  }

  toLegacyContext(canonical, extras = {}) {
    return toLegacyAIContext(canonical, extras);
  }

  #loadFromBundle(knowledge, options = {}) {
    this.#kb = knowledge;
    this.#documents = knowledge.documents || [];
    const canonIndex = options.canonIndex || buildCanonFromBundle(knowledge);
    canonicalEngine.load(canonIndex);
    topicEngine.load(knowledge.topics || []);
    const graph = options.graph || { nodes: [], edges: [] };
    if (!graph.nodes.length && knowledge.documents) {
      // Minimal graph from relationships index if dedicated artifacts missing.
    }
    knowledgeGraphEngine.load(graph);
    relationshipEngine.load(graph.edges || []);
    citationEngine.canon = canonicalEngine;

    const domains = knowledge.domains || {};
    if (domains.doctrines) this.#loadDomain("doctrine", domains.doctrines);
    if (domains.characters) this.#loadDomain("character", domains.characters);
    if (domains.timeline) this.#loadDomain("timeline", domains.timeline);
    if (domains.symbols) this.#loadDomain("symbol", domains.symbols);
    if (domains.wisdom) this.#loadDomain("wisdom", domains.wisdom);
    if (domains.applications) this.#loadDomain("application", domains.applications);
  }

  #loadDomain(name, entries) {
    const list = Array.isArray(entries) ? entries : Object.values(entries || {});
    switch (name) {
      case "doctrine":
        doctrineEngine.load(list);
        break;
      case "character":
        characterEngine.load(list);
        break;
      case "timeline":
        timelineEngine.load(list);
        break;
      case "symbol":
        symbolEngine.load(list);
        break;
      case "wisdom":
        wisdomEngine.load(list);
        break;
      case "application":
        applicationEngine.load(list);
        break;
      default:
        break;
    }
    this.#domainsLoaded.add(name);
  }

  #findChapterDoc(chapter, day) {
    if (Number.isFinite(day)) {
      const byDay = this.#documents.find((d) => d.type === "chapter" && d.meta?.day === day);
      if (byDay) return byDay;
    }
    if (Number.isFinite(chapter)) {
      return this.#documents.find((d) => d.type === "chapter" && d.meta?.chapter === chapter) || null;
    }
    return null;
  }

  #findGoldenVerse(chapter) {
    if (!Number.isFinite(chapter)) return null;
    return this.#documents.find((d) => d.type === "golden-verse" && d.meta?.chapter === chapter) || null;
  }

  #findTyped(chapter, type) {
    if (!Number.isFinite(chapter)) return null;
    return this.#documents.find((d) => d.type === type && d.meta?.chapter === chapter) || null;
  }

  #crossrefsForChapter(chapter) {
    if (!Number.isFinite(chapter)) return [];
    return this.#documents
      .filter((d) => d.type === "crossref" && Number(String(d.meta?.source || "").match(/Amsal\s+(\d+)/i)?.[1]) === chapter)
      .map((d) => ({
        id: d.id,
        source: d.meta.source,
        target: d.meta.target,
        relationshipType: d.meta.relationshipType,
        reason: d.content || d.summary,
        confidence: d.meta.confidence,
        why: d.content || d.summary,
      }));
  }

  #matchFaq(query, limit = 3) {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return this.#documents
      .filter((d) => d.type === "faq" || d.type === "apologetics")
      .map((d) => {
        const hay = normalizeText(`${d.title} ${d.content}`);
        const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        return { d, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.d);
  }

  async #buildDegradedContext(input, started) {
    // Legacy CONTENT adapter — explicit degraded fallback only.
    let source = null;
    try {
      const { CONTENT } = await import("../../../data/content.js");
      source =
        (input.day && CONTENT[input.day]) ||
        Object.values(CONTENT).find((d) => d.chapter === Number(input.chapter)) ||
        null;
    } catch {
      source = null;
    }
    const confidence = scoreCanonicalConfidence({
      degraded: true,
      coverageScore: source ? 0.35 : 0.05,
      crossrefCount: 0,
      hasChapter: !!source,
      hasBook: true,
    });
    const book = { bookId: "book:proverbs", slug: "proverbs", bookName: "Amsal", names: { id: "Amsal" }, status: "production" };
    const chapter = source
      ? { canonicalId: `chapter:proverbs.${String(source.chapter).padStart(2, "0")}`, chapter: source.chapter, bookName: "Amsal", title: source.title }
      : null;
    return createCanonicalContext({
      book,
      chapter,
      day: source?.day ?? input.day ?? null,
      intent: input.intent || "",
      themes: source?.theme ? [source.theme] : [],
      keywords: source?.keywords || [],
      goldenVerse: source?.goldenVerse || null,
      summary: source?.summary || "",
      title: source?.title || "",
      theme: source?.theme || "",
      reflection: source?.reflection || [],
      challenge: source?.challenge || "",
      question: input.question || "",
      citations: source
        ? [{ display: `Amsal ${source.chapter}`, canonicalId: chapter.canonicalId, verified: true }]
        : [],
      allowedCitations: source
        ? [{ display: `Amsal ${source.chapter}`, canonicalId: chapter.canonicalId, verified: true }]
        : [],
      confidence: confidence.score,
      confidenceComponents: confidence.components,
      coverage: { score: confidence.components.knowledgeCoverage / 100, degraded: true },
      degraded: true,
      privacy: { journalIncluded: false },
      metadata: {
        source: source ? "content-degraded" : "no-context",
        tookMs: Math.round(now() - started),
        generatedAt: new Date().toISOString(),
      },
    });
  }

  async #fetchJson(relative) {
    // Prefer filesystem in Node tests / offline tooling when no explicit base URL.
    const canUseFs = !this.#baseUrl && typeof process !== "undefined" && process.versions?.node;
    if (canUseFs || typeof this.#fetchImpl !== "function") {
      const { readFile } = await import("node:fs/promises");
      const { fileURLToPath } = await import("node:url");
      const path = await import("node:path");
      const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
      const raw = await readFile(path.join(root, relative), "utf8");
      return JSON.parse(raw);
    }
    const res = await this.#fetchImpl(`${this.#baseUrl}${relative}`, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Failed to load ${relative}`);
    return res.json();
  }
}

function buildCanonFromBundle(knowledge) {
  const books = knowledge.canon?.books || [];
  const aliases = knowledge.canon?.aliases || {};
  return {
    byId: Object.fromEntries(books.map((b) => [b.bookId, b])),
    byOsis: Object.fromEntries(books.map((b) => [b.osis, b.bookId])),
    bySlug: Object.fromEntries(books.map((b) => [b.slug, b.bookId])),
    aliases,
    productionBookIds: books.filter((b) => b.status === "production").map((b) => b.bookId),
    seedBookIds: books.filter((b) => b.status === "seed").map((b) => b.bookId),
  };
}

function domainKey(name) {
  const map = {
    doctrine: "doctrines",
    character: "characters",
    timeline: "timeline",
    symbol: "symbols",
    wisdom: "wisdom",
    application: "applications",
  };
  return map[name] || name;
}

function compactDomain(entry) {
  return {
    id: entry.id,
    name: entry.name,
    summary: entry.summary || entry.invitation || (entry.lessons || [])[0] || "",
    confidence: entry.confidence,
  };
}

function splitLines(text) {
  return String(text || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function now() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

export const canonicalContextGateway = new CanonicalContextGateway();

export async function initCIL(options = {}) {
  await canonicalContextGateway.init(options);
  return getCILServices();
}

export function getCILServices() {
  return Object.freeze({
    gateway: canonicalContextGateway,
    canon: canonicalEngine,
    topic: topicEngine,
    relationship: relationshipEngine,
    graph: knowledgeGraphEngine,
    doctrine: doctrineEngine,
    character: characterEngine,
    timeline: timelineEngine,
    symbol: symbolEngine,
    wisdom: wisdomEngine,
    application: applicationEngine,
    citations: citationEngine,
    guardrails: theologicalGuardrails,
  });
}
