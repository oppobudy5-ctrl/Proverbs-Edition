/**
 * Extended AI response with CIL citations, confidence, and guardrails.
 * Preserves all legacy fields.
 */
export function createAIResponse(value = {}) {
  if (typeof value.content !== "string") throw new TypeError("AI response content must be a string");
  return Object.freeze({
    id: value.id || `air_${Date.now().toString(36)}`,
    content: value.content,
    provider: value.provider || "unknown",
    model: value.model || "unknown",
    cached: Boolean(value.cached),
    usage: value.usage ? Object.freeze({ ...value.usage }) : null,
    metadata: Object.freeze({ ...(value.metadata || {}) }),
    createdAt: value.createdAt || new Date().toISOString(),
    citations: Object.freeze(Array.isArray(value.citations) ? value.citations.map((c) => Object.freeze({ ...c })) : []),
    confidence: Number.isFinite(value.confidence) ? value.confidence : null,
    confidenceComponents: value.confidenceComponents
      ? Object.freeze({ ...value.confidenceComponents })
      : null,
    guardrails: value.guardrails
      ? Object.freeze({
          status: value.guardrails.status || "pass",
          checks: Object.freeze([...(value.guardrails.checks || [])]),
          warnings: Object.freeze([...(value.guardrails.warnings || [])]),
          inventedRefs: Object.freeze([...(value.guardrails.inventedRefs || [])]),
        })
      : null,
  });
}
