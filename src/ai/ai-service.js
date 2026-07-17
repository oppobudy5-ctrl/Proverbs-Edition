import { aiController } from "./ai-controller.js";
import { runReview } from "./review/review-engine.js";
import {
  getCanonicalBook,
  listCanonicalBooks,
  runBibleCompanion,
} from "./companion/companion-engine.js";
import { runBiblicalReasoning } from "./reasoning/reasoning-engine.js";
import { buildDiscipleshipPlan } from "./planning/planning-engine.js";
import {
  AIEvents,
  AI_EVENTS,
  AIError,
  AI_ERROR_CODES,
  AILogger,
  toAIError,
} from "./ai-utils.js";
import { SearchAnalytics } from "./search-analytics.js";
import {
  getRecentSearches,
  pushRecentSearch,
  getFavoriteSearches,
  toggleFavoriteSearch,
  isFavoriteSearch,
} from "./search-prefs.js";
import { isJournalAiConsentGranted } from "../../js/journal/consent.js";
import { initCIL, canonicalContextGateway, getCILServices } from "./cil/index.js";
import {
  getRuntimeProviderStatus,
  recordOfflineCanonical,
} from "./providers/provider-runtime.js";

export const AI_SERVICE_STATUS = Object.freeze({
  SUCCESS: "success",
  ERROR: "error",
  NOT_IMPLEMENTED: "not_implemented",
});

// Public entry point for every future AI-facing UI.
// UI code must not import providers, prompt templates, retrieval, or stores.
export const AIService = Object.freeze({
  /**
   * Runtime provider diagnostics. Refresh performs registry → health →
   * activation; the default call is a side-effect-free status read.
   */
  async getProviderStatus(options = {}) {
    if (options.refresh) return aiController.activate({ ...options, force: true });
    return getRuntimeProviderStatus();
  },

  async ask(question, options = {}) {
    return runCapability("ask", "biblical-reasoning-engine", async () => {
      requireText(question, "question");
      return wrapReasoningOutput(await runBiblicalReasoning(question, options));
    });
  },

  /** Explicit Phase 006 entry point; `ask()` uses the same pipeline. */
  async reason(question, options = {}) {
    return runCapability("reason", "biblical-reasoning-engine", async () => {
      requireText(question, "question");
      return wrapReasoningOutput(await runBiblicalReasoning(question, options));
    });
  },

  async summary(target = {}, options = {}) {
    return runCapability("summary", "ai-controller", () => {
      const payload = normalizeTarget(target, options);
      return execute("summary", payload);
    });
  },

  // Backward-compatible alias used by Phase 001 UI.
  async summarize(target = {}, options = {}) {
    return AIService.summary(target, options);
  },

  async search(query, options = {}) {
    return runCapability("search", "ai-controller", async () => {
      requireText(query, "query");
      return execute("search", { ...options, question: query, query });
    });
  },

  /**
   * Semantic Search lokal (offline-first) — routed through CIL gateway.
   */
  async semanticSearch(query, options = {}) {
    return runCapability("semanticSearch", "semantic-search", async () => {
      requireText(query, "query");
      await initCIL(options.init || {});
      const result = await canonicalContextGateway.semanticSearch(query, options);
      SearchAnalytics.recordSearch({
        intent: result.analysis?.intent || null,
        topic: result.analysis?.topicIds?.[0] || null,
        queryLength: String(query).trim().length,
        tookMs: result.tookMs,
        resultCount: result.results?.length || 0,
      });
      if (options.remember !== false) pushRecentSearch(query);
      return result;
    });
  },

  async suggestSearch(query, options = {}) {
    try {
      await initCIL(options.init || {});
      return await canonicalContextGateway.suggestSearch(query, options);
    } catch (error) {
      logFailure("suggestSearch", error);
      return [];
    }
  },

  async relatedSearch(target = {}, options = {}) {
    return runCapability("relatedSearch", "semantic-search", async () => {
      await initCIL(options.init || {});
      return canonicalContextGateway.relatedSearch(target, options);
    });
  },

  /** Build immutable CanonicalContext for the given target. */
  async buildCanonicalContext(input = {}) {
    return runCapability("buildCanonicalContext", "canonical-intelligence-layer", async () => {
      await initCIL(input.init || {});
      return canonicalContextGateway.buildCanonicalContext(input);
    });
  },

  async crossReference(target = {}, options = {}) {
    return runCapability("crossReference", "canonical-intelligence-layer", async () => {
      const input = normalizeTarget(target, options);
      await initCIL(input.init || {});
      const context = await canonicalContextGateway.buildCanonicalContext(input);
      const crossrefs = Array.isArray(context?.crossrefs) ? context.crossrefs : [];
      return {
        crossrefs,
        content: crossrefs.length
          ? `${crossrefs.length} referensi silang ditemukan.`
          : "Belum ada referensi silang untuk konteks ini.",
        citations: context?.citations || [],
        metadata: {
          chapter: context?.chapter || input.chapter || null,
          crossrefCount: crossrefs.length,
          confidence: context?.confidence ?? null,
        },
      };
    });
  },

  /** Canonical 66-book registry, ordered from Genesis to Revelation. */
  async books(options = {}) {
    return runCapability("books", "canonical-intelligence-layer", async () => ({
      books: await listCanonicalBooks(options),
      content: "Daftar kitab kanonik.",
    }));
  },

  async book(book, options = {}) {
    return runCapability("book", "canonical-intelligence-layer", async () => {
      requireText(book, "book");
      const result = await getCanonicalBook(book, options);
      if (!result) {
        throw new AIError(AI_ERROR_CODES.INVALID_REQUEST, "unknown canonical book", {
          userMessage: "Kitab tidak ditemukan.",
          retryable: false,
        });
      }
      return { book: result, content: result.names?.id || result.slug };
    });
  },

  /** Structured multi-book Bible Companion response. */
  async companion(target = {}, options = {}) {
    return runCapability("companion", "bible-companion", async () => {
      const payload = normalizeTarget(target, options);
      const companion = await runBibleCompanion(payload);
      return {
        companion,
        content: companion.summary || companion.overview || companion.status_message,
        citations: companion.citations,
        provider: companion.provider,
        confidence: companion.confidence,
        metadata: {
          book: companion.book.slug,
          chapter: companion.chapter,
          availability: companion.availability,
          canonical_only: companion.canonical_only,
        },
      };
    });
  },

  /** Offline-first personalized reading/study/discipleship plan. */
  async plan(target = {}, options = {}) {
    return runCapability("plan", "planning-discipleship-engine", async () => {
      const payload = normalizeTarget(target, options);
      const plan = await buildDiscipleshipPlan(payload);
      return {
        plan,
        content: plan.title,
        citations: plan.canonical_context?.citations || [],
        provider: "local",
        confidence: plan.canonical_context?.confidence || 0,
        metadata: {
          plan_id: plan.plan_id,
          goal: plan.goal,
          duration: plan.duration,
          offline_compatible: plan.offline_compatible,
        },
      };
    });
  },

  /** Recommendation projected from current local plan progress. */
  async recommend(target = {}, options = {}) {
    return runCapability("recommend", "planning-discipleship-engine", async () => {
      const payload = normalizeTarget(target, options);
      const plan = await buildDiscipleshipPlan(payload);
      return {
        recommendation: plan.recommendation,
        plan_id: plan.plan_id,
        content: plan.recommendation?.reason || "",
        citations: plan.canonical_context?.citations || [],
        provider: "local",
        confidence: plan.canonical_context?.confidence || 0,
        metadata: {
          goal: plan.goal,
          completion: plan.completion,
          offline_compatible: true,
        },
      };
    });
  },

  /** Read-only CIL service facades for future features. */
  cil() {
    return getCILServices();
  },

  async initCIL(options = {}) {
    return initCIL(options);
  },

  recordSearchClick(detail = {}) {
    return SearchAnalytics.recordClick(detail);
  },

  getSearchAnalytics() {
    return SearchAnalytics.get();
  },

  getRecentSearches,
  getFavoriteSearches,
  toggleFavoriteSearch,
  isFavoriteSearch,

  async reflect(target = {}, options = {}) {
    return runCapability("reflect", "ai-controller", () => {
      const payload = normalizeTarget(target, options);
      return execute("reflection", {
        ...payload,
        question: payload.question || "Bantu saya merenungkan bacaan ini.",
      });
    });
  },

  /**
   * AI Review Engine — structured biblical review of a user reflection.
   * Runs the full Phase 004 pipeline: CIL + optional LLM + formatter.
   * Returns standardised Phase 002 envelope with `review` field on success.
   */
  async review(target = {}, options = {}) {
    return runCapability("review", "review-engine", async () => {
      const payload = normalizeTarget(target, options);
      const reviewOutput = await runReview({
        ...payload,
        mode: "review",
        journalConsent: Boolean(payload.journalConsent),
      });
      return _wrapReviewOutput(reviewOutput);
    });
  },

  /**
   * Bible Mentor — mentor mode of the Review Engine.
   * Emphasises summary, encouragement, wisdom, prayer, next step, reflection question.
   */
  async mentor(target = {}, options = {}) {
    return runCapability("mentor", "review-engine", async () => {
      const payload = normalizeTarget(target, options);
      const reviewOutput = await runReview({
        ...payload,
        mode: "mentor",
        journalConsent: Boolean(payload.journalConsent),
      });
      return _wrapReviewOutput(reviewOutput);
    });
  },

  /**
   * Refleksi berbasis jurnal pengguna. Wajib consent eksplisit.
   * Tidak pernah mengirim isi jurnal tanpa izin tersimpan.
   */
  async reflectJournal(target = {}, options = {}) {
    return runCapability("reflectJournal", "ai-controller", async () => {
      if (!isJournalAiConsentGranted()) {
        throw new AIError(
          AI_ERROR_CODES.INVALID_REQUEST,
          "Journal AI consent is required",
          {
            userMessage: "Izinkan AI membaca jurnal terlebih dahulu sebelum meminta bantuan refleksi.",
            retryable: false,
          },
        );
      }
      const payload = normalizeTarget(target, options);
      const text = String(payload.text || payload.journalExcerpt || "").trim();
      if (!text) {
        throw new AIError(
          AI_ERROR_CODES.INVALID_REQUEST,
          "journal text is required",
          { userMessage: "Tulis jurnal dulu sebelum meminta bantuan AI.", retryable: false },
        );
      }
      return execute("journal-reflection", {
        ...payload,
        journalConsent: true,
        journalExcerpt: text,
        // Jangan cache/persist ringkasan yang diturunkan dari jurnal privat.
        cache: false,
        persist: false,
        question: payload.question || "Bantu merangkum jurnal ini dan usulkan pertanyaan refleksi lanjutan.",
        metadata: {
          ...(payload.metadata || {}),
          journalConsent: true,
          entryId: payload.entryId || null,
        },
      });
    });
  },

  async explain(question, options = {}) {
    return runCapability("explain", "ai-controller", async () => {
      requireText(question, "question");
      return execute("explain", { ...options, question });
    });
  },

  /**
   * Wisdom Coach — memakai intent/prompt wisdom yang sudah ada.
   * Facade tipis untuk UI; tidak mengubah engine/prompt.
   */
  async wisdom(target = {}, options = {}) {
    return runCapability("wisdom", "ai-controller", () => {
      const payload = normalizeTarget(target, options);
      return execute("wisdom", {
        ...payload,
        question: payload.question || "Bantu saya menerapkan hikmat pasal ini dengan hati-hati dalam keputusan nyata.",
      });
    });
  },

  async prayer() {
    return createServiceError({
      method: "prayer",
      source: "not-implemented",
      status: AI_SERVICE_STATUS.NOT_IMPLEMENTED,
      code: "NOT_IMPLEMENTED",
      message: "Prayer Engine belum tersedia.",
      retryable: false,
    });
  },

  // Read-only event facade for UI subscriptions.
  events: Object.freeze({
    names: AI_EVENTS,
    on: (eventName, handler) => AIEvents.on(eventName, handler),
    once: (eventName, handler) => AIEvents.once(eventName, handler),
  }),
});

function execute(intent, payload) {
  const callbacks = {
    onToken: payload.onToken,
    onFinish: payload.onFinish,
    onError: payload.onError,
  };
  const cleanPayload = { ...payload };
  delete cleanPayload.onToken;
  delete cleanPayload.onFinish;
  delete cleanPayload.onError;
  return aiController.execute(intent, cleanPayload, callbacks);
}

async function runCapability(method, source, operation) {
  const startedAt = Date.now();
  AILogger.debug("service request", { method, source });
  try {
    const result = await operation();
    const response = createServiceSuccess({ method, source, result, startedAt });
    AILogger.debug("service success", {
      method,
      source,
      durationMs: response.metadata.durationMs,
    });
    return response;
  } catch (error) {
    logFailure(method, error);
    return createServiceErrorFromException({ method, source, error, startedAt });
  }
}

function createServiceSuccess({ method, source, result, startedAt }) {
  const raw = result && typeof result === "object" ? result : {};
  const citations = Object.freeze(
    Array.isArray(raw.citations)
      ? raw.citations.map((item) => Object.freeze({ ...item }))
      : [],
  );
  const metadata = Object.freeze({
    ...(raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}),
    method,
    durationMs: Math.max(0, Date.now() - startedAt),
  });
  return Object.freeze({
    ...raw,
    success: true,
    status: AI_SERVICE_STATUS.SUCCESS,
    provider: raw.provider || (source === "ai-controller" ? "unknown" : "local"),
    source,
    citation: citations[0] || null,
    citations,
    content: typeof raw.content === "string" ? raw.content : "",
    metadata,
    error: null,
    timestamp: raw.createdAt || new Date().toISOString(),
  });
}

function createServiceErrorFromException({ method, source, error, startedAt }) {
  const aiError = toAIError(error);
  return createServiceError({
    method,
    source,
    code: mapServiceErrorCode(aiError),
    message: aiError.userMessage || "Layanan AI tidak tersedia.",
    retryable: Boolean(aiError.retryable),
    providerStatus: aiError.status,
    details: safeErrorDetails(aiError),
    durationMs: Math.max(0, Date.now() - startedAt),
  });
}

function createServiceError({
  method,
  source,
  status = AI_SERVICE_STATUS.ERROR,
  code,
  message,
  retryable = false,
  providerStatus = null,
  details = null,
  durationMs = 0,
}) {
  const error = Object.freeze({
    code: code || "AI_UNAVAILABLE",
    message: message || "Layanan AI tidak tersedia.",
    retryable: Boolean(retryable),
    status: providerStatus,
    details,
  });
  return Object.freeze({
    success: false,
    status,
    provider: null,
    source,
    citation: null,
    citations: Object.freeze([]),
    // Content tetap berisi pesan aman agar UI lama menampilkan error jelas.
    content: error.message,
    metadata: Object.freeze({ method, durationMs }),
    error,
    timestamp: new Date().toISOString(),
  });
}

function mapServiceErrorCode(error) {
  if (error?.code === AI_ERROR_CODES.INVALID_REQUEST) return "INVALID_REQUEST";
  if (error?.code === AI_ERROR_CODES.TIMEOUT) return "PROVIDER_TIMEOUT";
  if (error?.code === AI_ERROR_CODES.PROVIDER_OFFLINE) return "AI_UNAVAILABLE";
  if (error?.code === AI_ERROR_CODES.CANCELLED) return "CANCELLED";
  if (error?.code === AI_ERROR_CODES.RATE_LIMIT) return "RATE_LIMIT";
  if (error?.code === AI_ERROR_CODES.QUOTA_EXCEEDED) return "QUOTA_EXCEEDED";
  if (/knowledge|context|canonical/i.test(error?.message || "")) return "KNOWLEDGE_UNAVAILABLE";
  return "AI_UNAVAILABLE";
}

function safeErrorDetails(error) {
  if (AILogger.mode !== "development") return null;
  return error?.details && typeof error.details === "object"
    ? Object.freeze({ ...error.details })
    : null;
}

function logFailure(method, error) {
  const aiError = toAIError(error);
  AILogger.warn("service failure", {
    method,
    code: mapServiceErrorCode(aiError),
    retryable: Boolean(aiError.retryable),
  });
}

/**
 * Wrap a ReviewOutput into a structure that createServiceSuccess can spread cleanly.
 * The full ReviewOutput is available as `.review` for structured UI rendering.
 */
function _wrapReviewOutput(reviewOutput) {
  return {
    review: reviewOutput,
    content: reviewOutput.summary || "",
    citations: reviewOutput.citations || [],
    provider: reviewOutput.provider || "local",
    confidence: reviewOutput.confidence,
    metadata: {
      canonical_only: reviewOutput.canonical_only,
      themes: reviewOutput.themes,
      confidence: reviewOutput.confidence,
    },
  };
}

function wrapReasoningOutput(output) {
  if (output.provider === "local" || output.reasoning_metadata?.canonical_only) {
    recordOfflineCanonical(
      output.validation?.status === "fallback"
        ? "Production provider unavailable; canonical offline answer used."
        : "Canonical offline answer used.",
    );
  }
  return {
    ...output,
    content: output.summary || "",
    citations: output.citations || [],
    provider: output.provider || "local",
    confidence: output.confidence,
    metadata: {
      intent: output.explainability?.intent || "general",
      reasoning_path: output.explainability?.reasoning_path || [],
      context_used: output.explainability?.context_used || [],
      references_used: output.explainability?.references_used || [],
      canonical_only: Boolean(output.explainability?.canonical_only),
      validation_status: output.validation?.status || "unknown",
    },
  };
}

function normalizeTarget(target, options) {
  if (typeof target === "number") return { ...options, chapter: target };
  if (typeof target === "string") return { ...options, question: target };
  if (target && typeof target === "object") return { ...options, ...target };
  return { ...options };
}

function requireText(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AIError(AI_ERROR_CODES.INVALID_REQUEST, `${name} must be a non-empty string`, { retryable: false });
  }
}

export default AIService;
