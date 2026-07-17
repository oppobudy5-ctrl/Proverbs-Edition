import { aiController } from "./ai-controller.js";
import { AIEvents, AI_EVENTS, AIError, AI_ERROR_CODES } from "./ai-utils.js";
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

// Public entry point for every future AI-facing UI.
// UI code must not import providers, prompt templates, retrieval, or stores.
export const AIService = Object.freeze({
  ask(question, options = {}) {
    requireText(question, "question");
    return execute("qa", { ...options, question });
  },

  summarize(target = {}, options = {}) {
    const payload = normalizeTarget(target, options);
    return execute("summary", payload);
  },

  search(query, options = {}) {
    requireText(query, "query");
    return execute("search", { ...options, question: query, query });
  },

  /**
   * Semantic Search lokal (offline-first) — routed through CIL gateway.
   */
  async semanticSearch(query, options = {}) {
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
  },

  async suggestSearch(query, options = {}) {
    await initCIL(options.init || {});
    return canonicalContextGateway.suggestSearch(query, options);
  },

  async relatedSearch(target = {}, options = {}) {
    await initCIL(options.init || {});
    return canonicalContextGateway.relatedSearch(target, options);
  },

  /** Build immutable CanonicalContext for the given target. */
  async buildCanonicalContext(input = {}) {
    await initCIL(input.init || {});
    return canonicalContextGateway.buildCanonicalContext(input);
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

  reflect(target = {}, options = {}) {
    const payload = normalizeTarget(target, options);
    return execute("reflection", {
      ...payload,
      question: payload.question || "Bantu saya merenungkan bacaan ini.",
    });
  },

  /**
   * Refleksi berbasis jurnal pengguna. Wajib consent eksplisit.
   * Tidak pernah mengirim isi jurnal tanpa izin tersimpan.
   */
  reflectJournal(target = {}, options = {}) {
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
  },

  explain(question, options = {}) {
    requireText(question, "question");
    return execute("explain", { ...options, question });
  },

  /**
   * Wisdom Coach — memakai intent/prompt wisdom yang sudah ada.
   * Facade tipis untuk UI; tidak mengubah engine/prompt.
   */
  wisdom(target = {}, options = {}) {
    const payload = normalizeTarget(target, options);
    return execute("wisdom", {
      ...payload,
      question: payload.question || "Bantu saya menerapkan hikmat pasal ini dengan hati-hati dalam keputusan nyata.",
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
