/**
 * Validate a provider response against the already-built canonical context.
 * This complements (and records) the existing theological guardrails without
 * exposing prompts or hidden model reasoning.
 */
export function validateCanonicalAnswer(response = {}, canonical = {}) {
  const citations = response.citations?.length
    ? response.citations
    : canonical.citations || [];
  const guardrails = response.guardrails || {};
  const inventedRefs = guardrails.inventedRefs || [];
  const requestedChapterPresent = !canonical.chapter || Boolean(canonical.chapter?.chapter);
  const responseChapter = response.metadata?.chapter;
  const responseBook = response.metadata?.book;
  const canonicalBook = canonical.book?.slug;

  const checks = Object.freeze([
    Object.freeze({
      id: "canonical-context",
      pass: Boolean(canonical.book) && requestedChapterPresent,
      detail: canonical.book ? "book-resolved" : "book-missing",
    }),
    Object.freeze({
      id: "scripture-citations",
      pass: citations.length > 0,
      detail: `${citations.length} citation(s)`,
    }),
    Object.freeze({
      id: "no-invented-references",
      pass: inventedRefs.length === 0,
      detail: inventedRefs.length ? inventedRefs.join(", ") : "ok",
    }),
    Object.freeze({
      id: "theological-guardrails",
      pass: !["refuse"].includes(guardrails.status),
      detail: guardrails.status || "not-applicable",
    }),
    Object.freeze({
      id: "context-boundary",
      pass: citations.every((item) => item.inAllowedContext !== false),
      detail: "allowed-citations-only",
    }),
    Object.freeze({
      id: "metadata-consistency",
      pass: (
        (responseChapter == null || Number(responseChapter) === Number(canonical.chapter?.chapter))
        && (responseBook == null || String(responseBook) === String(canonicalBook))
      ),
      detail: `${canonicalBook || "unknown"}:${canonical.chapter?.chapter || "all"}`,
    }),
  ]);

  const failed = checks.filter((check) => !check.pass);
  let status = "pass";
  if (!canonical.book || !requestedChapterPresent) status = "invalid_context";
  else if (inventedRefs.length || guardrails.status === "refuse") status = "blocked";
  else if (
    !citations.length
    || canonical.degraded
    || canonical.metadata?.availability === "metadata-only"
  ) status = "insufficient_context";
  else if (!String(response.content || "").trim()) status = "fallback";
  else if (failed.length) status = "warn";
  else if (guardrails.status === "fallback") status = "fallback";

  return Object.freeze({
    valid: !["invalid_context", "blocked"].includes(status),
    status,
    checks,
    warnings: Object.freeze([...(guardrails.warnings || [])]),
    citations: Object.freeze(citations.map((item) => Object.freeze({ ...item }))),
  });
}
