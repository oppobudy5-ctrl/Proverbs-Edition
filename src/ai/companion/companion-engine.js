import { canonicalContextGateway, initCIL } from "../cil/index.js";
import { AIError, AI_ERROR_CODES } from "../ai-utils.js";
import { CONTENT } from "../../../data/content.js";
import { runBiblicalReasoning } from "../reasoning/reasoning-engine.js";

let chapterOverlaysPromise = null;

/**
 * Multi-book Bible Companion orchestrator.
 * Routes enrichment through the Biblical Reasoning Engine so Companion never
 * calls the LLM provider path directly.
 */
export async function runBibleCompanion(input = {}) {
  const bookInput = String(input.book || "").trim();
  if (!bookInput) {
    throw new AIError(AI_ERROR_CODES.INVALID_REQUEST, "book is required", {
      userMessage: "Pilih kitab terlebih dahulu.",
      retryable: false,
    });
  }

  const services = await initCIL(input.init || {});
  const book = services.canon.getBook(bookInput);
  if (!book) {
    throw new AIError(AI_ERROR_CODES.INVALID_REQUEST, "unknown canonical book", {
      userMessage: "Kitab tidak terdaftar dalam kanon.",
      retryable: false,
    });
  }

  const chapter = normalizeChapter(input.chapter, book.chapterCount);
  const context = await canonicalContextGateway.buildCanonicalContext({
    ...input,
    book: book.slug,
    chapter,
    intent: "summary",
  });
  const available = context.metadata?.availability === "available";
  const editorial = book.slug === "proverbs" ? CONTENT[chapter] || null : null;
  const overlay = editorial
    ? await resolveChapterOverlay(chapter, input.chapterOverlays)
    : null;

  let prose = "";
  let provider = "local";
  let reasoningMeta = null;
  if (available) {
    try {
      const question = chapter
        ? `Ringkas ${book.names?.id || book.slug} ${chapter} berdasarkan konteks kanonik yang tersedia.`
        : `Ringkas tujuan dan tema utama kitab ${book.names?.id || book.slug} berdasarkan konteks kanonik yang tersedia.`;
      const reasoned = await runBiblicalReasoning(question, {
        book: book.slug,
        chapter,
        canonical: context,
        cache: input.cache,
        persist: input.persist,
        llmEnabled: input.llmEnabled,
        _executeFn: input._executeFn,
        metadata: { serviceMethod: "companion" },
      });
      prose = typeof reasoned?.answer === "string"
        ? reasoned.answer.trim()
        : (typeof reasoned?.summary === "string" ? reasoned.summary.trim() : "");
      provider = reasoned?.provider || provider;
      reasoningMeta = reasoned?.reasoning_metadata || null;
    } catch {
      // Canonical-only Companion remains the expected offline behaviour.
    }
  }

  return formatCompanion({
    book,
    chapter,
    context,
    prose,
    provider,
    available,
    editorial,
    overlay,
    reasoningMeta,
  });
}

export async function listCanonicalBooks(options = {}) {
  const services = await initCIL(options.init || {});
  return Object.freeze(
    services.canon
      .listBooks()
      .sort((a, b) => a.canonicalOrder - b.canonicalOrder)
      .map((book) => Object.freeze({ ...book, available: book.status === "production" })),
  );
}

export async function getCanonicalBook(bookInput, options = {}) {
  const services = await initCIL(options.init || {});
  const book = services.canon.getBook(bookInput);
  return book ? Object.freeze({ ...book, available: book.status === "production" }) : null;
}

function formatCompanion({
  book,
  chapter,
  context,
  prose,
  provider,
  available,
  editorial,
  overlay,
  reasoningMeta,
}) {
  const seenReferences = new Set();
  const crossBookReferences = (context.crossrefs || []).filter((ref) => {
    const target = String(ref.target || "");
    const key = `${ref.source || ""}|${target}`;
    if (!target || seenReferences.has(key)) return false;
    seenReferences.add(key);
    return !target.toLowerCase().includes(String(book.names?.id || book.slug).toLowerCase());
  });
  const chapterHistorical = [
    overlay?.historicalContext || "",
    ...(context.historical || []).map((item) => item.summary || item.name || "").filter(Boolean),
  ].filter(Boolean);
  const bookHistorical = [
    book.authors?.length ? `Penulis: ${book.authors.join(", ")}` : "",
    book.period ? `Periode: ${book.period}` : "",
    book.audience ? `Pembaca: ${book.audience}` : "",
  ].filter(Boolean);
  const summary = editorial?.summary || context.summary || "";
  const mainTheme = editorial?.theme || context.theme || "";
  const memoryVerse = editorial?.goldenVerse || context.goldenVerse || null;
  const keywords = editorial?.keywords?.length ? editorial.keywords : context.keywords || [];
  const application = editorial?.challenge
    || context.challenge
    || context.application?.invitation
    || "";
  const prayer = editorial?.prayer || context.prayer || "";
  const purpose = context.chapter?.purpose || context.book?.purpose || book.purpose || "";
  const bookOverview = Object.freeze({
    name: book.names?.id || book.slug,
    english_name: book.names?.en || "",
    testament: book.testament || "",
    category: book.category || book.genre || "",
    chapter_count: book.chapterCount || 0,
    authors: Object.freeze([...(book.authors || [])]),
    period: book.period || "",
    language: book.language || "",
    purpose,
  });

  return Object.freeze({
    book: Object.freeze({ ...book }),
    chapter,
    available,
    availability: available ? "available" : "metadata-only",
    status_message: available
      ? ""
      : "Metadata kitab tersedia, tetapi konten pasal belum tersedia offline.",
    book_overview: bookOverview,
    chapter_title: editorial?.title || context.title || context.chapter?.title || "",
    chapter_overview: editorial?.lead || summary,
    overview: purpose,
    summary,
    ai_summary: prose,
    purpose,
    main_theme: mainTheme,
    themes: Object.freeze(
      [...new Set([
        mainTheme,
        ...(context.themes || []),
        ...(context.topics || []).map((t) => t.name),
      ].filter(Boolean))],
    ),
    keywords: Object.freeze([...keywords]),
    historical_context: (chapterHistorical.length ? chapterHistorical : bookHistorical).join(" · "),
    historical_source: chapterHistorical.length ? "chapter" : "book",
    literary_context: overlay?.literaryContext || "",
    structure: Object.freeze([...(overlay?.structure || [])]),
    difficulty: overlay?.difficulty || "",
    cross_book_references: Object.freeze(crossBookReferences.map((ref) => Object.freeze({ ...ref }))),
    related_verses: Object.freeze((context.crossrefs || []).map((ref) => ref.target).filter(Boolean)),
    application,
    prayer,
    memory_verse: memoryVerse ? Object.freeze({ ...memoryVerse }) : null,
    citations: Object.freeze((context.citations || []).map((item) => Object.freeze({ ...item }))),
    confidence: context.confidence || 0,
    provider,
    canonical_only: !prose || provider === "local",
    reasoning_metadata: reasoningMeta ? Object.freeze({ ...reasoningMeta }) : null,
    metadata: Object.freeze({
      canonical_id: context.chapter?.canonicalId || null,
      source: context.metadata?.source || "cil",
      availability: context.metadata?.availability || (available ? "available" : "metadata-only"),
      book_status: context.metadata?.bookStatus || book.status || "unknown",
      token_estimate: context.tokenEstimate || 0,
      reasoning_engine: Boolean(reasoningMeta),
    }),
    timestamp: new Date().toISOString(),
  });
}

async function resolveChapterOverlay(chapter, injected) {
  const source = injected || await loadChapterOverlays();
  if (!source) return null;
  return Object.freeze({
    ...(source.defaults || {}),
    ...(source.chapters?.[String(chapter)] || {}),
  });
}

async function loadChapterOverlays() {
  if (chapterOverlaysPromise) return chapterOverlaysPromise;
  chapterOverlaysPromise = (async () => {
    try {
      if (typeof globalThis.fetch !== "function") return null;
      const response = await globalThis.fetch("knowledge/metadata/chapter-overlays.json", {
        cache: "force-cache",
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  })();
  return chapterOverlaysPromise;
}

function normalizeChapter(value, max) {
  if (value == null || value === "") return null;
  const chapter = Number(value);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > Number(max || 0)) {
    throw new AIError(AI_ERROR_CODES.INVALID_REQUEST, "invalid chapter", {
      userMessage: `Pasal harus antara 1 dan ${max}.`,
      retryable: false,
    });
  }
  return chapter;
}
