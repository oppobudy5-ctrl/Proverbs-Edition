import { AIError, AI_ERROR_CODES } from "../ai-utils.js";
import { theologicalGuardrails } from "../cil/theological-guardrails.js";
import { analyzeBiblicalIntent } from "./intent-analyzer.js";
import { buildReasoningContext } from "./reasoning-context.js";
import { buildThemePath } from "./theme-reasoner.js";
import { validateCanonicalAnswer } from "./canonical-validator.js";
import { formatReasoningOutput } from "./reasoning-formatter.js";

/**
 * Biblical Reasoning Engine.
 *
 * The `reasoning` output is an evidence summary (intent, context, themes,
 * references, validation), not hidden chain-of-thought or prompt content.
 */
export async function runBiblicalReasoning(question, options = {}) {
  const text = String(question || "").trim();
  if (!text) {
    throw new AIError(AI_ERROR_CODES.INVALID_REQUEST, "question is required", {
      userMessage: "Tulis pertanyaan Alkitab terlebih dahulu.",
      retryable: false,
    });
  }

  const intent = analyzeBiblicalIntent(text);
  const { canonical, evidence } = await buildReasoningContext({
    ...options,
    question: text,
  });

  if (!canonical.book) {
    throw new AIError(AI_ERROR_CODES.INVALID_REQUEST, "canonical book not found", {
      userMessage: "Konteks kitab tidak ditemukan dalam registry kanonik.",
      retryable: false,
    });
  }

  const themeReasoning = buildThemePath(evidence.themes);
  let response = null;

  if (options.llmEnabled !== false && evidence.availability !== "metadata-only") {
    try {
      const execute = options._executeFn || defaultExecute();
      response = await execute("qa", {
        ...options,
        question: text,
        book: canonical.book.slug,
        chapter: canonical.chapter?.chapter ?? options.chapter,
        verse: canonical.verse?.verse ?? options.verse,
        canonical,
        cache: options.cache,
        persist: options.persist,
        metadata: {
          ...(options.metadata || {}),
          serviceMethod: "reason",
          biblicalIntent: intent.intent,
          prebuiltCanonical: true,
        },
      });
    } catch {
      response = null;
    }
  }

  const validation = validateCanonicalAnswer(response || {}, canonical);
  const canonicalFallback = theologicalGuardrails.buildSafeFallback(canonical);

  const output = formatReasoningOutput({
    question: text,
    intent,
    evidence,
    themeReasoning,
    response,
    validation,
    canonicalFallback,
  });
  options.onToken?.(output.summary, output.summary);
  options.onFinish?.(output);
  return output;
}

function defaultExecute() {
  let controller = null;
  return async (intent, payload) => {
    if (!controller) {
      const mod = await import("../ai-controller.js");
      controller = mod.aiController;
    }
    return controller.execute(intent, payload, {});
  };
}
