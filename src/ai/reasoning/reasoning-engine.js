import { AIError, AI_ERROR_CODES, AIDebug } from "../ai-utils.js";
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

  const startedAt = Date.now();
  const intent = analyzeBiblicalIntent(text);
  AIDebug.log("Intent Detected", intent.intent);

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

  const reference = evidence.reference
    || `${canonical.book.slug}${canonical.chapter?.chapter ? ` ${canonical.chapter.chapter}` : ""}`;
  AIDebug.log("Context Loaded", reference);
  AIDebug.log("Knowledge Bundle Loaded", evidence.availability);
  AIDebug.log("Cross References Loaded", evidence.cross_references.length);

  const themeReasoning = buildThemePath(evidence.themes);
  let response = null;
  let providerError = null;

  const providerEligible = options.llmEnabled !== false && evidence.availability !== "metadata-only";
  if (providerEligible) {
    AIDebug.log("Provider Called", "gateway → AI controller (intent: qa)");
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
      AIDebug.log("Provider Returned", response?.provider || "unknown");
    } catch (error) {
      providerError = error;
      response = null;
      AIDebug.log("Provider Failed", error?.code || error?.message || "unknown");
    }
  } else {
    AIDebug.log("Provider Skipped", evidence.availability === "metadata-only"
      ? "metadata-only context"
      : "llm disabled → offline canonical engine");
  }

  const validation = validateCanonicalAnswer(response || {}, canonical);
  AIDebug.log("Validation", validation.status);
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

  AIDebug.log("Reasoning Completed", output.reasoning_metadata?.canonical_only ? "offline canonical" : "provider-backed");
  AIDebug.trace({
    Intent: intent.intent,
    Context: reference,
    Reasoning: "Success",
    Gateway: providerEligible ? (providerError ? "Failed" : "Success") : "Skipped",
    Provider: output.provider,
    Latency: `${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
    Validation: validation.status,
    Rendering: "Ready",
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
