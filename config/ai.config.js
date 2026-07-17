// Central, immutable defaults for the provider-agnostic AI layer.
// Secrets never live here — only non-secret defaults and public endpoints.
// Runtime credentials are read from environment variables on the server proxy.

function env(name, fallback = "") {
  try {
    const value = globalThis.process?.env?.[name];
    return value == null || value === "" ? fallback : String(value);
  } catch {
    return fallback;
  }
}

function envBool(name, fallback = false) {
  const raw = env(name, "");
  if (!raw) return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}

function envNumber(name, fallback) {
  const raw = Number(env(name, ""));
  return Number.isFinite(raw) ? raw : fallback;
}

/** Public model catalog — IDs are configurable; never hardcode a single model. */
export const AI_MODEL_REGISTRY = Object.freeze({
  openai: Object.freeze([
    Object.freeze({ id: "gpt-4o", label: "GPT-4o" }),
    Object.freeze({ id: "gpt-4o-mini", label: "GPT-4o Mini" }),
    Object.freeze({ id: "gpt-5.5", label: "GPT-5.5" }),
    Object.freeze({ id: "gpt-5.5-mini", label: "GPT-5.5 Mini" }),
  ]),
  gemini: Object.freeze([
    Object.freeze({ id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" }),
    Object.freeze({ id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" }),
    Object.freeze({ id: "gemini-3.5-pro", label: "Gemini 3.5 Pro" }),
    Object.freeze({ id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" }),
  ]),
  claude: Object.freeze([
    Object.freeze({ id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" }),
    Object.freeze({ id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" }),
  ]),
  azure: Object.freeze([
    Object.freeze({ id: "gpt-4o", label: "Azure GPT-4o" }),
    Object.freeze({ id: "gpt-4o-mini", label: "Azure GPT-4o Mini" }),
  ]),
  ollama: Object.freeze([
    Object.freeze({ id: "llama3.2", label: "Llama 3.2" }),
    Object.freeze({ id: "llama3", label: "Llama 3" }),
    Object.freeze({ id: "mistral", label: "Mistral" }),
    Object.freeze({ id: "qwen", label: "Qwen" }),
  ]),
  mock: Object.freeze([
    Object.freeze({ id: "bible-time-mock-v1", label: "Offline Mock" }),
  ]),
});

export const AI_PROVIDER_IDS = Object.freeze([
  "mock",
  "openai",
  "gemini",
  "claude",
  "azure",
  "ollama",
]);

/** Anthropic is exposed to operators as an alias of the Claude adapter. */
export const AI_PROVIDER_ALIASES = Object.freeze({
  anthropic: "claude",
});

function normalizeProvider(value) {
  const raw = String(value || "mock").toLowerCase();
  const aliased = AI_PROVIDER_ALIASES[raw] || raw;
  return AI_PROVIDER_IDS.includes(aliased) ? aliased : "mock";
}

/** Prefer production providers first; mock is always the last resort. */
export const AI_FAILOVER_ORDER = Object.freeze(
  (env("AI_FAILOVER_ORDER", "openai,gemini,claude,azure,ollama,mock")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .map((id) => normalizeProvider(id))
    .filter((id, index, all) => AI_PROVIDER_IDS.includes(id) && all.indexOf(id) === index)),
);

export const AI_CONFIG = Object.freeze({
  defaultProvider: normalizeProvider(env("AI_PROVIDER", "mock")),
  defaultTemperature: envNumber("AI_TEMPERATURE", 0.35),
  defaultMaxTokens: envNumber("AI_MAX_TOKENS", 900),
  defaultResponseLength: env("AI_RESPONSE_LENGTH", "medium"),
  defaultLanguage: env("AI_LANGUAGE", "id"),
  streaming: envBool("AI_STREAMING", true),
  offlineMode: envBool("AI_OFFLINE_MODE", false),
  retry: Object.freeze({
    attempts: envNumber("AI_RETRY_ATTEMPTS", 2),
    baseDelayMs: envNumber("AI_RETRY_BASE_MS", 500),
    maxDelayMs: envNumber("AI_RETRY_MAX_MS", 4000),
  }),
  timeoutMs: envNumber("AI_TIMEOUT_MS", 30000),
  healthTimeoutMs: envNumber("AI_HEALTH_TIMEOUT_MS", 5000),
  maxContextCharacters: 12000,
  retrievalLimit: 4,
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  logLevel: env("AI_LOG_LEVEL", "auto"),
  failoverOrder: AI_FAILOVER_ORDER,
  endpoints: Object.freeze({
    openai: env("OPENAI_PROXY_URL", "/api/ai/openai"),
    gemini: env("GEMINI_PROXY_URL", "/api/ai/gemini"),
    claude: env("ANTHROPIC_PROXY_URL", "/api/ai/claude"),
    azure: env("AZURE_OPENAI_PROXY_URL", "/api/ai/azure"),
    ollama: env("OLLAMA_BASE_URL", "http://localhost:11434/api/chat"),
    config: "/api/ai/config",
    health: "/api/ai/health",
  }),
  models: Object.freeze({
    openai: env("OPENAI_MODEL", "gpt-4o-mini"),
    gemini: env("GEMINI_MODEL", "gemini-2.0-flash"),
    claude: env("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
    azure: env("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini"),
    ollama: env("OLLAMA_MODEL", "llama3.2"),
    mock: "bible-time-mock-v1",
  }),
});

export const AI_RESPONSE_LENGTHS = Object.freeze(["short", "medium", "long"]);
export const AI_LANGUAGES = Object.freeze(["id", "en"]);

export function resolveProviderId(value) {
  return normalizeProvider(value);
}

export function listModelsFor(providerId) {
  const id = resolveProviderId(providerId);
  return AI_MODEL_REGISTRY[id] || AI_MODEL_REGISTRY.mock;
}

export function defaultModelFor(providerId) {
  const id = resolveProviderId(providerId);
  return AI_CONFIG.models[id] || AI_CONFIG.models.mock;
}
