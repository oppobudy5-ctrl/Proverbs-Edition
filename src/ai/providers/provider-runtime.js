import { AI_CONFIG, AI_FAILOVER_ORDER, resolveProviderId } from "../../../config/ai.config.js";
import { AISettings } from "../ai-settings.js";
import { AIDebug, AILogger } from "../ai-utils.js";
import { ModelRegistry } from "./model-registry.js";

const INITIAL = Object.freeze({
  provider: null,
  configuredProvider: AI_CONFIG.defaultProvider,
  model: null,
  mode: "initializing",
  healthy: false,
  reason: "Provider activation has not run.",
  latency: null,
  streaming: AI_CONFIG.streaming,
  offline: false,
  timestamp: null,
  lastCheck: null,
  retryCount: 0,
  fallbackCount: 0,
  fallback: false,
  tokens: null,
  environmentLoaded: false,
  apiStatus: "unknown",
  health: Object.freeze({}),
});

let status = INITIAL;
let activationPromise = null;

export async function activateRuntimeProvider(controller, options = {}) {
  if (activationPromise && !options.force) return activationPromise;
  activationPromise = performActivation(controller, options);
  try {
    return await activationPromise;
  } finally {
    activationPromise = null;
  }
}

export function getRuntimeProviderStatus() {
  return Object.freeze({
    ...status,
    health: Object.freeze({ ...(status.health || {}) }),
  });
}

export function recordProviderExecution(result = {}) {
  const metadata = result.metadata || {};
  const usage = result.usage || null;
  status = freezeStatus({
    ...status,
    provider: result.provider || status.provider,
    model: result.model || status.model,
    healthy: true,
    reason: metadata.failover?.length
      ? metadata.failover.map((item) => `${item.provider}: ${item.reason || item.code}`).join("; ")
      : status.reason,
    latency: metadata.durationMs ?? status.latency,
    streaming: Boolean(metadata.streamed ?? status.streaming),
    offline: Boolean(metadata.offlineMode || result.provider === "local"),
    retryCount: Number(metadata.retries || 0),
    fallbackCount: Number(status.fallbackCount || 0) + (metadata.failover?.length ? 1 : 0),
    fallback: Boolean(metadata.failover?.length),
    tokens: usage,
    timestamp: new Date().toISOString(),
  });
}

export function recordOfflineCanonical(reason, detail = {}) {
  status = freezeStatus({
    ...status,
    provider: "local",
    model: null,
    mode: "offline-canonical",
    healthy: true,
    reason: reason || "All production providers unavailable.",
    latency: detail.latency ?? status.latency,
    streaming: false,
    offline: true,
    fallback: true,
    fallbackCount: Number(status.fallbackCount || 0) + 1,
    tokens: null,
    timestamp: new Date().toISOString(),
  });
}

export function isDevelopmentRuntime(runtimeConfig = null) {
  const explicit = String(
    runtimeConfig?.runtimeMode
      || globalThis.process?.env?.AI_RUNTIME_MODE
      || globalThis.process?.env?.NODE_ENV
      || "",
  ).toLowerCase();
  if (explicit === "development" || explicit === "test") return true;
  if (explicit === "production") return false;
  const hostname = globalThis.location?.hostname || "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";
}

async function performActivation(controller, options) {
  const settings = Object.freeze({ ...AISettings.get(), ...(options.settings || {}) });
  const runtimeConfig = options.runtimeConfig || await loadRuntimeConfig();
  const development = options.development ?? isDevelopmentRuntime(runtimeConfig);
  const configured = resolveConfiguredProvider(settings, runtimeConfig, development);
  const health = {};
  const reasons = [];
  const startedAt = Date.now();

  if (settings.offlineMode) {
    recordOfflineCanonical("Offline mode enabled in AI Settings.");
    status = freezeStatus({
      ...status,
      configuredProvider: configured,
      environmentLoaded: Boolean(runtimeConfig),
      apiStatus: runtimeConfig ? "loaded" : "unavailable",
      health,
    });
    logActivation();
    return getRuntimeProviderStatus();
  }

  const chain = activationChain(configured, runtimeConfig, development);
  for (const id of chain) {
    let result;
    try {
      result = await controller.healthCheck(id);
    } catch (error) {
      result = {
        ok: false,
        provider: id,
        status: "error",
        reason: error?.message || "Health check failed.",
        latencyMs: null,
        healthTimestamp: new Date().toISOString(),
      };
    }
    health[id] = Object.freeze({ ...result });
    if (result.ok && result.modelExists !== false) {
      status = freezeStatus({
        ...status,
        provider: id,
        configuredProvider: configured,
        model: result.model || ModelRegistry.defaultModel(id),
        mode: id === "mock" ? "development-mock" : "production",
        healthy: true,
        reason: reasons.length ? reasons.join("; ") : "Configured provider is healthy.",
        latency: result.latencyMs ?? Date.now() - startedAt,
        streaming: Boolean(settings.streaming && controller.getProvider(id).capabilities.streaming),
        offline: false,
        timestamp: new Date().toISOString(),
        lastCheck: result.healthTimestamp || new Date().toISOString(),
        fallback: id !== configured,
        fallbackCount: Number(status.fallbackCount || 0) + (id !== configured ? 1 : 0),
        environmentLoaded: Boolean(runtimeConfig),
        apiStatus: runtimeConfig ? "loaded" : "unavailable",
        health,
      });
      logActivation();
      return getRuntimeProviderStatus();
    }
    reasons.push(`${providerLabel(id)}: ${healthReason(result)}`);
  }

  status = freezeStatus({
    ...status,
    provider: "local",
    configuredProvider: configured,
    model: null,
    mode: "offline-canonical",
    healthy: true,
    reason: reasons.join("; ") || "No production provider is configured.",
    latency: Date.now() - startedAt,
    streaming: false,
    offline: true,
    timestamp: new Date().toISOString(),
    lastCheck: new Date().toISOString(),
    fallback: true,
    fallbackCount: Number(status.fallbackCount || 0) + 1,
    environmentLoaded: Boolean(runtimeConfig),
    apiStatus: runtimeConfig ? "loaded" : "unavailable",
    health,
  });
  logActivation();
  return getRuntimeProviderStatus();
}

async function loadRuntimeConfig() {
  if (typeof fetch !== "function" || !globalThis.location) return null;
  try {
    const response = await fetch(AI_CONFIG.endpoints.config, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function resolveConfiguredProvider(settings, runtimeConfig, development) {
  const selected = resolveProviderId(settings.provider);
  if (selected !== "mock") return selected;
  const serverDefault = resolveProviderId(runtimeConfig?.defaultProvider);
  if (serverDefault !== "mock") return serverDefault;
  const configuredProduction = Object.values(runtimeConfig?.providers || {})
    .find((item) => item?.id !== "mock" && item?.configured);
  if (configuredProduction?.id) return resolveProviderId(configuredProduction.id);
  return development ? "mock" : "mock";
}

function activationChain(configured, runtimeConfig, development) {
  const chain = [];
  const push = (id) => {
    const normalized = resolveProviderId(id);
    if (!chain.includes(normalized)) chain.push(normalized);
  };
  push(configured);
  for (const id of runtimeConfig?.failoverOrder || AI_FAILOVER_ORDER) {
    const info = runtimeConfig?.providers?.[id];
    if (info && info.configured === false && id !== "ollama") continue;
    push(id);
  }
  if (development) push("mock");
  return chain.filter((id) => development || id !== "mock");
}

function healthReason(result = {}) {
  if (result.authentication === "missing_key") return "API key missing";
  if (result.authentication === "failed") return "authentication failed";
  if (result.modelExists === false) return "model unavailable";
  if (result.reachable === false) return "not reachable";
  return result.reason || result.status || "unhealthy";
}

function providerLabel(id) {
  if (id === "openai") return "OpenAI";
  if (id === "gemini") return "Gemini";
  if (id === "ollama") return "Ollama";
  if (id === "claude") return "Anthropic";
  if (id === "azure") return "Azure OpenAI";
  if (id === "mock") return "Development Mock";
  return id;
}

function logActivation() {
  AILogger.info("provider activation", {
    configuredProvider: status.configuredProvider,
    provider: status.provider,
    model: status.model,
    mode: status.mode,
    healthy: status.healthy,
    latencyMs: status.latency,
    reason: status.reason,
  });
  AIDebug.trace({
    Provider: status.provider,
    Model: status.model,
    Mode: status.mode,
    Reasoning: "Ready",
    Gateway: status.healthy ? "Ready" : "Unavailable",
    Validation: "Ready",
    Renderer: "Ready",
    Latency: status.latency == null ? null : `${status.latency}ms`,
    Fallback: status.fallback,
    Reason: status.reason,
    Tokens: status.tokens ? JSON.stringify(status.tokens) : "n/a",
    Streaming: status.streaming,
  });
}

function freezeStatus(value) {
  return Object.freeze({
    ...value,
    health: Object.freeze({ ...(value.health || {}) }),
  });
}
