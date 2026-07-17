import { canonicalContextGateway, initCIL } from "../cil/index.js";
import { AIError, AI_ERROR_CODES } from "../ai-utils.js";

/**
 * Multi-book Bible Companion orchestrator.
 * Reuses CIL and the existing summary intent; it does not define a new prompt
 * or provider path.
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

  let prose = "";
  let provider = "local";
  if (available && input.llmEnabled !== false) {
    try {
      const execute = input._executeFn || defaultExecute();
      const result = await execute("summary", {
        book: book.slug,
        chapter,
        question: chapter
          ? `Ringkas ${book.names?.id || book.slug} ${chapter} berdasarkan konteks kanonik yang tersedia.`
          : `Ringkas tujuan dan tema utama kitab ${book.names?.id || book.slug} berdasarkan konteks kanonik yang tersedia.`,
        cache: input.cache,
        persist: input.persist,
        metadata: { serviceMethod: "companion" },
      });
      prose = typeof result?.content === "string" ? result.content.trim() : "";
      provider = result?.provider || provider;
    } catch {
      // Canonical-only fallback is the expected offline behaviour.
    }
  }

  return formatCompanion({ book, chapter, context, prose, provider, available });
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

function formatCompanion({ book, chapter, context, prose, provider, available }) {
  const seenReferences = new Set();
  const crossBookReferences = (context.crossrefs || []).filter((ref) => {
    const target = String(ref.target || "");
    const key = `${ref.source || ""}|${target}`;
    if (!target || seenReferences.has(key)) return false;
    seenReferences.add(key);
    return !target.toLowerCase().includes(String(book.names?.id || book.slug).toLowerCase());
  });
  const historicalParts = [
    book.authors?.length ? `Penulis: ${book.authors.join(", ")}` : "",
    book.period ? `Periode: ${book.period}` : "",
    book.audience ? `Pembaca: ${book.audience}` : "",
  ].filter(Boolean);

  return Object.freeze({
    book: Object.freeze({ ...book }),
    chapter,
    available,
    availability: available ? "available" : "metadata-only",
    status_message: available
      ? ""
      : "Metadata kitab tersedia, tetapi konten pasal belum tersedia offline.",
    overview: context.summary || book.purpose || "",
    summary: prose || context.summary || "",
    purpose: book.purpose || "",
    themes: Object.freeze(
      [...new Set([...(context.themes || []), ...(context.topics || []).map((t) => t.name)].filter(Boolean))],
    ),
    historical_context: historicalParts.join(" · "),
    cross_book_references: Object.freeze(crossBookReferences.map((ref) => Object.freeze({ ...ref }))),
    related_verses: Object.freeze((context.crossrefs || []).map((ref) => ref.target).filter(Boolean)),
    application: context.application?.invitation || context.challenge || "",
    prayer: context.prayer || "",
    citations: Object.freeze((context.citations || []).map((item) => Object.freeze({ ...item }))),
    confidence: context.confidence || 0,
    provider,
    canonical_only: !prose,
    timestamp: new Date().toISOString(),
  });
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

function defaultExecute() {
  let controller = null;
  return async (intent, payload) => {
    if (!controller) {
      const mod = await import("../ai-controller.js");
      controller = mod.aiController;
    }
    return controller.execute(intent, payload, {});
  };
}
