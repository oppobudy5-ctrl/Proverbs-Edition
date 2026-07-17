import { createAIContext } from "../types/ai-context.js";

/**
 * Map CanonicalContext → legacy AIContext shape for prompts/providers during migration.
 */
export function toLegacyAIContext(canonical = {}, extras = {}) {
  const bookName = canonical.book?.bookName || canonical.book?.names?.id || canonical.book?.slug || "";
  const chapterNum = canonical.chapter?.chapter ?? canonical.chapter?.number ?? null;
  return createAIContext({
    day: canonical.day,
    book: bookName,
    chapter: chapterNum,
    title: canonical.title || canonical.chapter?.title || "",
    theme: canonical.theme || (canonical.themes || [])[0] || "",
    summary: canonical.summary || "",
    goldenVerse: canonical.goldenVerse,
    keywords: canonical.keywords || [],
    reflection: canonical.reflection || [],
    challenge: canonical.challenge || canonical.application?.invitation || "",
    question: canonical.question || extras.question || "",
    journalExcerpt: canonical.privacy?.journalIncluded ? canonical.journalExcerpt || "" : "",
    retrieved: (canonical.retrieved || []).map((item) => ({
      day: item.day,
      book: item.book || bookName,
      chapter: item.chapter,
      title: item.title,
      theme: item.theme,
      summary: item.summary,
      goldenVerse: item.goldenVerse,
      keywords: item.keywords,
    })),
    metadata: {
      ...(canonical.metadata || {}),
      cil: true,
      degraded: Boolean(canonical.degraded),
      confidence: canonical.confidence,
      citations: canonical.citations,
      allowedCitations: canonical.allowedCitations,
      interpretiveNotes: canonical.interpretiveNotes,
      doctrines: canonical.doctrines,
      characters: canonical.characters,
      symbols: canonical.symbols,
      historical: canonical.historical,
      wisdomPatterns: canonical.wisdomPatterns,
      application: canonical.application,
      crossrefs: canonical.crossrefs,
      coverage: canonical.coverage,
      tokenEstimate: canonical.tokenEstimate,
      privacy: canonical.privacy,
      ...(extras.metadata || {}),
    },
  });
}
