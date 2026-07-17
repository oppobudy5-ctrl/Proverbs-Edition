/**
 * review-engine.js — Internal orchestrator for AI Review / Bible Mentor.
 *
 * UI-independent. Called only through AIService.review() and AIService.mentor().
 * Routes enrichment through the Biblical Reasoning Engine:
 * Reflection → Canonical Context → Reasoning → Review formatting.
 */

import { canonicalContextGateway, initCIL } from "../cil/index.js";
import { formatReview } from "./review-formatter.js";
import { AIError, AI_ERROR_CODES } from "../ai-utils.js";
import { runBiblicalReasoning } from "../reasoning/reasoning-engine.js";

/**
 * Run the review pipeline.
 *
 * @param {object} input
 * @param {string}  [input.text]          - User reflection / journal excerpt
 * @param {number}  [input.day]
 * @param {number}  [input.chapter]
 * @param {string}  [input.book]
 * @param {string}  [input.mode]          - "review" (default) | "mentor"
 * @param {boolean} [input.llmEnabled]   - Enable optional LLM enrichment (default true)
 * @param {object}  [input.init]          - CIL init options
 * @param {Function} [input._executeFn]   - Injected executor for testing
 * @returns {Promise<Readonly<object>>}
 */
export async function runReview(input = {}) {
  const mode = input.mode === "mentor" ? "mentor" : "review";
  const reflectionText = _extractText(input);
  const llmEnabled = input.llmEnabled !== false;

  if (!reflectionText && !input.chapter && !input.day) {
    throw new AIError(
      AI_ERROR_CODES.INVALID_REQUEST,
      "review requires reflection text or a chapter/day target",
      {
        userMessage: "Tulis renungan atau pilih pasal sebelum meminta review.",
        retryable: false,
      },
    );
  }

  await initCIL(input.init || {});
  let ctx;
  try {
    ctx = await canonicalContextGateway.buildCanonicalContext({
      chapter: input.chapter ?? null,
      day: input.day ?? null,
      book: input.book ?? null,
      intent: "reflection",
      journalExcerpt: reflectionText || undefined,
    });
  } catch {
    return _minimalFallback(reflectionText);
  }

  let reasoning = null;
  let llmResult = null;
  try {
    const question = _buildQuestion(reflectionText, mode);
    reasoning = await runBiblicalReasoning(question, {
      chapter: input.chapter ?? null,
      day: input.day ?? null,
      book: input.book ?? null,
      canonical: ctx,
      llmEnabled,
      cache: false,
      persist: false,
      journalConsent: Boolean(input.journalConsent),
      _executeFn: input._executeFn,
      metadata: { serviceMethod: mode },
    });
    if (!reasoning.explainability?.canonical_only && (reasoning.answer || reasoning.summary)) {
      llmResult = {
        content: reasoning.answer || reasoning.summary,
        provider: reasoning.provider,
        confidence: reasoning.confidence,
        citations: reasoning.citations,
        guardrails: reasoning.guardrails,
      };
    }
  } catch {
    reasoning = null;
    llmResult = null;
  }

  const review = formatReview(ctx, llmResult, { mode, reflectionText });
  return Object.freeze({
    ...review,
    reasoning_metadata: reasoning?.reasoning_metadata
      ? Object.freeze({ ...reasoning.reasoning_metadata })
      : null,
    validation: reasoning?.validation || null,
  });
}

function _extractText(input) {
  const raw = input.text || input.journalExcerpt || input.question || "";
  return String(raw).trim().slice(0, 3000);
}

function _buildQuestion(text, mode) {
  if (mode === "mentor") {
    return text
      ? `Berikan refleksi mentor alkitabiah untuk renungan berikut: ringkasan, dorongan pastoral, hikmat, doa, langkah berikutnya, dan pertanyaan refleksi lanjutan.\n\n${text}`
      : "Berikan refleksi mentor alkitabiah untuk pasal ini: ringkasan, dorongan, hikmat, doa, dan pertanyaan refleksi.";
  }
  return text
    ? `Tinjau refleksi renungan berikut secara alkitabiah. Identifikasi kekuatan, kekurangan, aplikasi praktis, dorongan pastoral, dan pertanyaan refleksi lanjutan.\n\n${text}`
    : "Tinjau renungan dari pasal ini dan berikan umpan balik alkitabiah singkat.";
}

function _minimalFallback(reflectionText) {
  return Object.freeze({
    summary: "Ringkasan tidak tersedia saat ini.",
    strengths: Object.freeze([]),
    missing_points: Object.freeze([]),
    application: "",
    memory_verse: null,
    cross_references: Object.freeze([]),
    historical_context: "",
    themes: Object.freeze([]),
    wisdom: "",
    encouragement: "Tetaplah merenungkan Firman dengan setia.",
    prayer: "",
    next_step: "",
    reflection_question: reflectionText
      ? "Apa yang paling berkesan dari renungan ini?"
      : "",
    confidence: 0,
    citations: Object.freeze([]),
    provider: "local",
    timestamp: new Date().toISOString(),
    canonical_only: true,
    reasoning_metadata: null,
    validation: null,
  });
}
