/**
 * Canonical confidence score (0–100) with deterministic component weights.
 *
 * Knowledge coverage 25%
 * Cross-reference strength 20%
 * Commentary support 10%
 * Historical support 10%
 * Semantic confidence 20%
 * Canonical consistency 15%
 */
export function scoreCanonicalConfidence(input = {}) {
  const coverage = clamp01(input.coverageScore ?? deriveCoverage(input));
  const crossref = clamp01(input.crossrefScore ?? deriveCrossref(input));
  const commentary = clamp01(input.commentaryScore ?? (input.commentaryCount > 0 ? 0.8 : 0.2));
  const historical = clamp01(input.historicalScore ?? (input.historicalCount > 0 ? 0.85 : 0.25));
  const semantic = clamp01(input.semanticScore ?? 0.6);
  const consistency = clamp01(input.consistencyScore ?? (input.degraded ? 0.35 : 0.9));

  let score =
    coverage * 25 +
    crossref * 20 +
    commentary * 10 +
    historical * 10 +
    semantic * 20 +
    consistency * 15;

  const penalties = [];
  if (input.degraded) {
    score -= 20;
    penalties.push({ code: "degraded", amount: 20 });
  }
  if (input.inventedRefs > 0) {
    const amount = Math.min(30, input.inventedRefs * 10);
    score -= amount;
    penalties.push({ code: "invented-refs", amount });
  }
  if (input.missingScripture && input.requiresScripture) {
    score -= 15;
    penalties.push({ code: "missing-scripture", amount: 15 });
  }
  if (input.absoluteLanguage) {
    score -= 8;
    penalties.push({ code: "absolute-language", amount: 8 });
  }

  const total = Math.max(0, Math.min(100, Math.round(score)));
  return Object.freeze({
    score: total,
    components: Object.freeze({
      knowledgeCoverage: Math.round(coverage * 100),
      crossReferenceStrength: Math.round(crossref * 100),
      commentarySupport: Math.round(commentary * 100),
      historicalSupport: Math.round(historical * 100),
      semanticConfidence: Math.round(semantic * 100),
      canonicalConsistency: Math.round(consistency * 100),
    }),
    penalties: Object.freeze(penalties.slice()),
  });
}

function deriveCoverage(input) {
  const flags = [
    input.hasBook,
    input.hasChapter,
    input.hasTopics,
    input.hasDoctrines,
    input.hasApplication,
    input.hasGoldenVerse,
  ];
  const hit = flags.filter(Boolean).length;
  return hit / flags.length;
}

function deriveCrossref(input) {
  const n = Number(input.crossrefCount) || 0;
  if (n >= 3) return 1;
  if (n === 2) return 0.8;
  if (n === 1) return 0.55;
  return 0.15;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
