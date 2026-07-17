import {
  AI_CONFIG,
  AI_LANGUAGES,
  AI_PROVIDER_IDS,
  AI_RESPONSE_LENGTHS,
  defaultModelFor,
  resolveProviderId,
} from "../../config/ai.config.js";
import { ModelRegistry } from "./providers/model-registry.js";

const KEY = "bibleTime.ai.settings.v1";
const DEFAULTS = Object.freeze({
  provider: AI_CONFIG.defaultProvider,
  model: defaultModelFor(AI_CONFIG.defaultProvider),
  temperature: AI_CONFIG.defaultTemperature,
  maxTokens: AI_CONFIG.defaultMaxTokens,
  streaming: AI_CONFIG.streaming,
  responseLength: AI_CONFIG.defaultResponseLength,
  language: AI_CONFIG.defaultLanguage,
  offlineMode: AI_CONFIG.offlineMode,
  debugMode: false,
});

export const AISettings = {
  get() {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { stored = {}; }
    return sanitize({ ...DEFAULTS, ...stored });
  },
  update(patch = {}) {
    const current = this.get();
    const providerChanged = patch.provider && resolveProviderId(patch.provider) !== current.provider;
    const normalizedPatch = providerChanged && !patch.model
      ? { ...patch, model: defaultModelFor(patch.provider) }
      : patch;
    const next = sanitize({ ...current, ...normalizedPatch });
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
    applyDebugMode(next.debugMode);
    globalThis.dispatchEvent?.(new CustomEvent("bible-time:ai-settings", { detail: next }));
    return next;
  },
  reset() {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
    applyDebugMode(false);
    return this.get();
  },
  /** Snapshot suitable for Settings UI / observability (no secrets). */
  snapshot() {
    const current = this.get();
    return Object.freeze({
      currentProvider: current.provider,
      currentModel: current.model,
      streaming: current.streaming,
      temperature: current.temperature,
      maxTokens: current.maxTokens,
      offlineMode: current.offlineMode,
      debugMode: current.debugMode,
      language: current.language,
      responseLength: current.responseLength,
      availableProviders: [...AI_PROVIDER_IDS],
      availableModels: ModelRegistry.forProvider(current.provider),
    });
  },
};

function sanitize(value) {
  const provider = resolveProviderId(value.provider);
  const model = ModelRegistry.resolve(provider, value.model);
  return Object.freeze({
    provider,
    model,
    temperature: clamp(Number(value.temperature), 0, 2, DEFAULTS.temperature),
    maxTokens: Math.round(clamp(Number(value.maxTokens), 64, 8192, DEFAULTS.maxTokens)),
    streaming: Boolean(value.streaming),
    responseLength: AI_RESPONSE_LENGTHS.includes(value.responseLength) ? value.responseLength : DEFAULTS.responseLength,
    language: AI_LANGUAGES.includes(value.language) ? value.language : DEFAULTS.language,
    offlineMode: Boolean(value.offlineMode),
    debugMode: Boolean(value.debugMode),
  });
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function applyDebugMode(enabled) {
  try {
    globalThis.__AI_DEBUG__ = Boolean(enabled);
    if (typeof localStorage !== "undefined") {
      if (enabled) localStorage.setItem("ai_debug", "true");
      else localStorage.removeItem("ai_debug");
    }
  } catch {
    /* ignore storage / SSR */
  }
}
