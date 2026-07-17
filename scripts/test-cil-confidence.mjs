import assert from "node:assert/strict";
import { scoreCanonicalConfidence } from "../src/ai/cil/confidence.js";

const base = scoreCanonicalConfidence({
  coverageScore: 1,
  crossrefCount: 3,
  commentaryCount: 1,
  historicalCount: 1,
  semanticScore: 0.9,
  degraded: false,
  hasBook: true,
  hasChapter: true,
  hasTopics: true,
  hasDoctrines: true,
  hasApplication: true,
  hasGoldenVerse: true,
});
assert.ok(base.score >= 90 && base.score <= 100);
assert.equal(base.components.knowledgeCoverage, 100);
assert.equal(base.components.crossReferenceStrength, 100);

const degraded = scoreCanonicalConfidence({
  coverageScore: 0.35,
  crossrefCount: 0,
  degraded: true,
  hasChapter: true,
  hasBook: true,
});
assert.ok(degraded.score < base.score);
assert.ok(degraded.penalties.some((p) => p.code === "degraded"));

const invented = scoreCanonicalConfidence({
  coverageScore: 0.8,
  crossrefCount: 2,
  inventedRefs: 2,
  hasBook: true,
  hasChapter: true,
});
assert.ok(invented.penalties.some((p) => p.code === "invented-refs"));
assert.ok(invented.score < 80);

const same = scoreCanonicalConfidence({
  coverageScore: 0.5,
  crossrefCount: 1,
  commentaryCount: 0,
  historicalCount: 0,
  semanticScore: 0.6,
});
const same2 = scoreCanonicalConfidence({
  coverageScore: 0.5,
  crossrefCount: 1,
  commentaryCount: 0,
  historicalCount: 0,
  semanticScore: 0.6,
});
assert.deepEqual(same, same2);

console.log("PASS test-cil-confidence", { base: base.score, degraded: degraded.score, invented: invented.score });
