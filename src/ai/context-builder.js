import { canonicalContextGateway, initCIL } from "./cil/index.js";
import { toLegacyAIContext } from "./cil/compatibility-adapter.js";
import { isJournalAiConsentGranted } from "../../js/journal/consent.js";

/**
 * Compatibility adapter — does not independently read BKB or CONTENT for normal AI requests.
 * Prefer async buildAsync(); sync build() maps canonical context or request fields.
 * Journal excerpt still requires stored consent.
 */
export class ContextBuilder {
  constructor({ gateway = canonicalContextGateway } = {}) {
    this.gateway = gateway;
  }

  /**
   * Preferred path: build CanonicalContext via gateway, then adapt to legacy AIContext.
   */
  async buildAsync(input = {}) {
    await initCIL(input.init || {});
    const canonical = input.canonical || await this.gateway.buildCanonicalContext({
      book: input.book || "proverbs",
      chapter: input.chapter,
      verse: input.verse,
      day: input.day,
      intent: input.metadata?.intent || input.intent,
      topic: input.topic,
      query: input.query || input.question,
      question: input.question,
      tokenBudget: input.tokenBudget,
      journalConsent: input.journalConsent,
      journal: input.journalExcerpt ? { excerpt: input.journalExcerpt } : null,
      metadata: input.metadata,
      limit: input.limit,
    });
    return this.gateway.toLegacyContext(canonical, {
      question: input.question,
      metadata: input.metadata,
    });
  }

  /**
   * Sync adapter for callers that already have canonical context (or legacy fields).
   */
  build(input = {}) {
    const storedConsent = isJournalAiConsentGranted();
    const allowJournal = !!(input.journalConsent && storedConsent && input.journalExcerpt);
    const journalExcerpt = allowJournal ? String(input.journalExcerpt).slice(0, 4000) : "";

    if (input.canonical) {
      const adapted = toLegacyAIContext(
        {
          ...input.canonical,
          journalExcerpt,
          privacy: {
            ...(input.canonical.privacy || {}),
            journalIncluded: allowJournal,
          },
        },
        {
          question: input.question,
          metadata: { ...(input.metadata || {}), journalConsent: allowJournal },
        },
      );
      return adapted;
    }

    return toLegacyAIContext({
      day: input.day,
      book: typeof input.book === "string" ? { bookName: input.book, names: { id: input.book } } : input.book,
      chapter: typeof input.chapter === "number" || input.chapter == null
        ? { chapter: input.chapter, bookName: (typeof input.book === "string" ? input.book : input.book?.bookName) || "Amsal" }
        : input.chapter,
      title: input.title,
      theme: input.theme,
      summary: input.summary,
      goldenVerse: input.goldenVerse,
      keywords: input.keywords,
      reflection: input.reflection,
      challenge: input.challenge,
      question: input.question,
      journalExcerpt,
      retrieved: input.retrieved,
      privacy: { journalIncluded: allowJournal },
      metadata: {
        source: "compatibility-adapter",
        journalConsent: allowJournal,
        ...(input.metadata || {}),
      },
    }, { question: input.question, metadata: input.metadata });
  }

  compact(source = {}) {
    return Object.freeze({
      day: source.day ?? null,
      book: source.book || "",
      chapter: source.chapter ?? null,
      title: source.title || "",
      theme: source.theme || "",
      summary: String(source.summary || "").slice(0, 1000),
      goldenVerse: source.goldenVerse ? { ...source.goldenVerse } : null,
      keywords: Array.isArray(source.keywords) ? source.keywords.slice() : [],
      challenge: source.challenge || "",
    });
  }
}

export const contextBuilder = new ContextBuilder();
