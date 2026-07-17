/**
 * review-engine.js — Internal orchestrator for Phase 004 AI Review Engine.
 *
 * UI-independent. Called only through AIService.review() and AIService.mentor().
 * Does NOT talk to the DOM, import UI modules, or create new prompts/models.
 *
 * Pipeline (per spec):
 *  1. Input validation
 *  2. One buildCanonicalContext call (covers crossrefs, historical, themes, etc.)
 *  3. Optional LLM enrichment via existing "reflection" intent
 *  4. Review formatting via review-formatter
 *  5. Canonical-only fallback if LLM fails
 */

import { canonicalContextGateway, initCIL } from "../cil/index.js";
import { formatReview } from "./review-formatter.js";
import { AIError, AI_ERROR_CODES } from "../ai-utils.js";

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
 * @param {Function} [input._executeFn]   - Injected executor for testing (replaces aiController.execute)
 * @returns {Promise<Readonly<import('./review-formatter.js').ReviewOutput>>}
 */
export async function runReview(input = {}) {
  const mode = input.mode === "mentor" ? "mentor" : "review";
  const reflectionText = _extractText(input);
  const llmEnabled = input.llmEnabled !== false; // enabled by default

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

  // ── Step 1-2: Single CIL query ─────────────────────────────────────────────
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
    // Degraded CIL — return a minimal safe output
    return _minimalFallback(reflectionText);
  }

  // ── Step 3: Optional LLM enrichment ────────────────────────────────────────
  let llmResult = null;
  if (llmEnabled) {
    try {
      const executeFn = input._executeFn || _defaultExecute();
      const question = _buildQuestion(reflectionText, mode);
      llmResult = await executeFn("reflection", {
        chapter: input.chapter ?? null,
        day: input.day ?? null,
        book: input.book ?? null,
        question,
        journalConsent: Boolean(input.journalConsent),
        journalExcerpt: reflectionText || undefined,
        cache: false,
        persist: false,
        metadata: { serviceMethod: mode },
      });
    } catch {
      // LLM failed — fall back to canonical-only (do not throw)
      llmResult = null;
    }
  }

  // ── Step 4-5: Format output ─────────────────────────────────────────────────
  return formatReview(ctx, llmResult, { mode, reflectionText });
}

// ── Private helpers ──────────────────────────────────────────────────────────

function _extractText(input) {
  const raw = input.text || input.journalExcerpt || input.question || "";
  return String(raw).trim().slice(0, 3000);
}

function _buildQuestion(text, mode) {
  if (mode === "mentor") {
    return text
      ? `Berperan sebagai Bible Mentor. Bacalah renungan berikut dan berikan bimbingan alkitabiah: ringkasan, dorongan pastoral, hikmat, doa, langkah berikutnya, dan pertanyaan refleksi lanjutan.\n\n${text}`
      : "Berperan sebagai Bible Mentor. Berikan ringkasan, dorongan, hikmat, doa, dan pertanyaan refleksi untuk pasal ini.";
  }
  return text
    ? `Tinjau renungan berikut secara alkitabiah. Identifikasi kekuatan, kekurangan, aplikasi praktis, dorongan pastoral, dan pertanyaan refleksi lanjutan.\n\n${text}`
    : "Tinjau renungan dari pasal ini dan berikan umpan balik alkitabiah singkat.";
}

/** Lazy-loaded executor to avoid circular imports. */
function _defaultExecute() {
  let controller = null;
  return async function execute(intent, payload) {
    if (!controller) {
      const mod = await import("../ai-controller.js");
      controller = mod.aiController;
    }
    return controller.execute(intent, payload, {});
  };
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
  });
}
