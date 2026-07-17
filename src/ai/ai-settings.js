import { AI_CONFIG, AI_LANGUAGES, AI_PROVIDER_IDS, AI_RESPONSE_LENGTHS } from "../../config/ai.config.js";

const KEY = "bibleTime.ai.settings.v1";
const DEFAULTS = Object.freeze({
  provider: AI_CONFIG.defaultProvider,
  temperature: AI_CONFIG.defaultTemperature,
  maxTokens: AI_CONFIG.defaultMaxTokens,
  streaming: AI_CONFIG.streaming,
  responseLength: AI_CONFIG.defaultResponseLength,
  language: AI_CONFIG.defaultLanguage,
});

export const AISettings = {
  get() {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { stored = {}; }
    return sanitize({ ...DEFAULTS, ...stored });
  },
  update(patch = {}) {
    const next = sanitize({ ...this.get(), ...patch });
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
    globalThis.dispatchEvent?.(new CustomEvent("bible-time:ai-settings", { detail: next }));
    return next;
  },
  reset() {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
    return this.get();
  },
};

function sanitize(value) {
  return Object.freeze({
    provider: AI_PROVIDER_IDS.includes(value.provider) ? value.provider : DEFAULTS.provider,
    temperature: clamp(Number(value.temperature), 0, 2, DEFAULTS.temperature),
    maxTokens: Math.round(clamp(Number(value.maxTokens), 64, 8192, DEFAULTS.maxTokens)),
    streaming: Boolean(value.streaming),
    responseLength: AI_RESPONSE_LENGTHS.includes(value.responseLength) ? value.responseLength : DEFAULTS.responseLength,
    language: AI_LANGUAGES.includes(value.language) ? value.language : DEFAULTS.language,
  });
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
