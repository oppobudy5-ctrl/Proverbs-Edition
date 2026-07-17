/**
 * Immutable CanonicalContext DTO used by every AI intent.
 */
export function createCanonicalContext(value = {}) {
  const ctx = {
    book: freezeObj(value.book),
    chapter: freezeObj(value.chapter),
    verse: freezeObj(value.verse),
    day: numberOrNull(value.day),
    intent: stringOrEmpty(value.intent),
    themes: freezeArr(value.themes),
    keywords: freezeArr(value.keywords),
    goldenVerse: freezeObj(value.goldenVerse),
    crossrefs: freezeArr(value.crossrefs),
    topics: freezeArr(value.topics),
    characters: freezeArr(value.characters),
    doctrines: freezeArr(value.doctrines),
    historical: freezeArr(value.historical),
    symbols: freezeArr(value.symbols),
    wisdomPatterns: freezeArr(value.wisdomPatterns),
    application: freezeObj(value.application),
    reflection: freezeArr(value.reflection),
    prayer: stringOrEmpty(value.prayer),
    challenge: stringOrEmpty(value.challenge),
    faq: freezeArr(value.faq),
    commentary: freezeArr(value.commentary),
    graphLinks: freezeArr(value.graphLinks),
    citations: freezeArr(value.citations),
    allowedCitations: freezeArr(value.allowedCitations),
    interpretiveNotes: freezeArr(value.interpretiveNotes),
    coverage: freezeObj(value.coverage || {}),
    confidence: Number.isFinite(value.confidence) ? value.confidence : 0,
    confidenceComponents: freezeObj(value.confidenceComponents || {}),
    tokenEstimate: Number(value.tokenEstimate) || 0,
    degraded: Boolean(value.degraded),
    privacy: freezeObj(value.privacy || { journalIncluded: false }),
    journalExcerpt: stringOrEmpty(value.journalExcerpt),
    retrieved: freezeArr(value.retrieved),
    summary: stringOrEmpty(value.summary),
    title: stringOrEmpty(value.title),
    theme: stringOrEmpty(value.theme),
    question: stringOrEmpty(value.question),
    metadata: freezeObj(value.metadata || {}),
  };
  return Object.freeze(ctx);
}

function freezeObj(value) {
  if (value == null) return null;
  if (typeof value !== "object") return value;
  return Object.freeze({ ...value });
}

function freezeArr(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.map((item) => (item && typeof item === "object" ? Object.freeze({ ...item }) : item)));
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
