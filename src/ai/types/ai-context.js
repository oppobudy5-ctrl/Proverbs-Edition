export function createAIContext(value = {}) {
  return Object.freeze({
    day: numberOrNull(value.day),
    book: stringOrEmpty(value.book),
    chapter: numberOrNull(value.chapter),
    title: stringOrEmpty(value.title),
    theme: stringOrEmpty(value.theme),
    summary: stringOrEmpty(value.summary),
    goldenVerse: value.goldenVerse ? Object.freeze({ ...value.goldenVerse }) : null,
    keywords: Object.freeze(Array.isArray(value.keywords) ? [...value.keywords] : []),
    reflection: Object.freeze(Array.isArray(value.reflection) ? [...value.reflection] : []),
    challenge: stringOrEmpty(value.challenge),
    question: stringOrEmpty(value.question),
    journalExcerpt: stringOrEmpty(value.journalExcerpt),
    retrieved: Object.freeze(Array.isArray(value.retrieved) ? [...value.retrieved] : []),
    metadata: Object.freeze({ ...(value.metadata || {}) }),
  });
}

function stringOrEmpty(value) { return typeof value === "string" ? value : ""; }
function numberOrNull(value) {
  if (value == null || value === "") return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
