import { canonicalContextGateway, initCIL } from "../cil/index.js";

/**
 * Build one canonical context and project only evidence needed by reasoning.
 */
export async function buildReasoningContext(input = {}) {
  await initCIL(input.init || {});
  const canonical = input.canonical || await canonicalContextGateway.buildCanonicalContext({
    book: input.book || "proverbs",
    chapter: input.chapter,
    verse: input.verse,
    day: input.day,
    intent: "qa",
    query: input.question,
    question: input.question,
    tokenBudget: input.tokenBudget,
    limit: input.retrievalLimit,
    metadata: { reasoning: true, ...(input.metadata || {}) },
  });

  const themes = unique([
    ...(canonical.themes || []),
    canonical.theme,
    ...(canonical.topics || []).map((topic) => topic.name),
  ]).slice(0, 8);

  const historical = [
    canonical.book?.authors?.length
      ? `Penulis: ${canonical.book.authors.join(", ")}`
      : "",
    canonical.book?.period ? `Periode: ${canonical.book.period}` : "",
    canonical.book?.audience ? `Pembaca: ${canonical.book.audience}` : "",
    ...(canonical.historical || []).map((item) => item.summary || item.name),
  ].filter(Boolean);

  const memoryVerse = canonical.goldenVerse
    ? Object.freeze({ ...canonical.goldenVerse })
    : null;
  const purpose = canonical.chapter?.purpose
    || canonical.book?.purpose
    || "";

  const evidence = Object.freeze({
    reference: canonical.verse?.display
      || canonical.chapter?.display
      || (canonical.chapter
        ? `${canonical.chapter.bookName || canonical.book?.names?.id || ""} ${canonical.chapter.chapter}`
        : canonical.book?.names?.id || ""),
    summary: canonical.summary || "",
    purpose,
    themes: Object.freeze(themes),
    historical_context: historical.join(" · "),
    people: Object.freeze((canonical.characters || []).map((item) => item.name).filter(Boolean)),
    places: Object.freeze(
      (canonical.retrieved || [])
        .flatMap((item) => item.places || [])
        .filter(Boolean),
    ),
    keywords: Object.freeze([...(canonical.keywords || [])]),
    memory_verse: memoryVerse,
    cross_references: Object.freeze(
      (canonical.crossrefs || []).slice(0, 8).map((item) => Object.freeze({
        source: item.source || "",
        target: item.target || "",
        relationship: item.relationshipType || "",
        reason: item.reason || item.why || "",
        confidence: item.confidence ?? null,
      })),
    ),
    citations: Object.freeze((canonical.citations || []).map((item) => Object.freeze({ ...item }))),
    application: canonical.application
      ? Object.freeze({
          invitation: canonical.application.invitation || "",
          practices: Object.freeze([...(canonical.application.practices || [])]),
          cautions: Object.freeze([...(canonical.application.cautions || [])]),
        })
      : null,
    challenge: canonical.challenge || "",
    prayer: canonical.prayer || "",
    doctrines: Object.freeze((canonical.doctrines || []).map((item) => item.name).filter(Boolean)),
    metadata: Object.freeze({
      source: canonical.metadata?.source || "cil",
      availability: canonical.metadata?.availability || "unknown",
      book_status: canonical.metadata?.bookStatus || canonical.book?.status || "unknown",
      canonical_id: canonical.chapter?.canonicalId || canonical.book?.bookId || null,
    }),
    context_used: Object.freeze([
      canonical.book ? "book" : null,
      canonical.chapter ? "chapter" : null,
      canonical.verse ? "verse" : null,
      canonical.topics?.length ? "themes" : null,
      canonical.keywords?.length ? "keywords" : null,
      canonical.historical?.length || canonical.book?.period ? "historical" : null,
      canonical.crossrefs?.length ? "cross_references" : null,
      canonical.retrieved?.length ? "semantic_retrieval" : null,
      canonical.goldenVerse ? "memory_verse" : null,
      canonical.application ? "application" : null,
      purpose ? "purpose" : null,
    ].filter(Boolean)),
    degraded: Boolean(canonical.degraded),
    availability: canonical.metadata?.availability || "unknown",
  });

  return Object.freeze({ canonical, evidence });
}

function unique(items) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}
