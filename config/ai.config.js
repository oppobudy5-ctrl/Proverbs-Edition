// Central, immutable defaults for the provider-agnostic AI layer.
export const AI_CONFIG = Object.freeze({
  defaultProvider: "mock",
  defaultTemperature: 0.35,
  defaultMaxTokens: 900,
  defaultResponseLength: "medium",
  defaultLanguage: "id",
  streaming: true,
  retry: Object.freeze({ attempts: 2, baseDelayMs: 500, maxDelayMs: 4000 }),
  timeoutMs: 30000,
  maxContextCharacters: 12000,
  retrievalLimit: 4,
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  logLevel: "auto",
  endpoints: Object.freeze({
    openai: "/api/ai/openai",
    gemini: "/api/ai/gemini",
    claude: "/api/ai/claude",
    ollama: "http://localhost:11434/api/chat",
  }),
  models: Object.freeze({
    openai: "default",
    gemini: "default",
    claude: "default",
    ollama: "llama3.2",
    mock: "bible-time-mock-v1",
  }),
});

export const AI_PROVIDER_IDS = Object.freeze(["mock", "openai", "gemini", "claude", "ollama"]);
export const AI_RESPONSE_LENGTHS = Object.freeze(["short", "medium", "long"]);
export const AI_LANGUAGES = Object.freeze(["id", "en"]);
