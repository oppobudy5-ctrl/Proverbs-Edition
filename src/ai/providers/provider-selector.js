import { AI_CONFIG, AI_FAILOVER_ORDER, resolveProviderId } from "../../../config/ai.config.js";
import { AI_ERROR_CODES, AILogger } from "../ai-utils.js";
import { ModelRegistry } from "./model-registry.js";
import { getRuntimeProviderStatus, isDevelopmentRuntime } from "./provider-runtime.js";

/**
 * Provider selection + failover (Phase 006B).
 *
 * Priority:
 *   1. Configured / requested provider
 *   2. Healthy providers in failover order
 *   3. Mock provider (always last resort)
 *
 * UI / Reasoning / Companion never pick a provider — only AIService → Gateway
 * → this selector → Provider Adapter.
 */
export function buildProviderChain(settings = {}, options = {}) {
  const offlineMode = Boolean(settings.offlineMode ?? AI_CONFIG.offlineMode);
  if (offlineMode) return Object.freeze([]);

  const preferred = resolveProviderId(settings.provider || AI_CONFIG.defaultProvider);
  const development = options.development ?? isDevelopmentRuntime(options.runtimeConfig);
  const order = Array.isArray(options.failoverOrder) && options.failoverOrder.length
    ? options.failoverOrder
    : AI_FAILOVER_ORDER;

  const chain = [];
  const push = (id) => {
    const resolved = resolveProviderId(id);
    if (!chain.includes(resolved)) chain.push(resolved);
  };

  push(preferred);
  for (const id of order) push(id);
  if (development) push("mock");

  return Object.freeze(chain.filter((id) => development || id !== "mock"));
}

export function isFailoverWorthy(error) {
  if (!error) return false;
  if (error.code === AI_ERROR_CODES.CANCELLED) return false;
  return [
    AI_ERROR_CODES.PROVIDER_OFFLINE,
    AI_ERROR_CODES.TIMEOUT,
    AI_ERROR_CODES.RATE_LIMIT,
    AI_ERROR_CODES.QUOTA_EXCEEDED,
    AI_ERROR_CODES.API_ERROR,
    AI_ERROR_CODES.UNKNOWN,
  ].includes(error.code);
}

/**
 * Resolve an ordered list of live provider instances from a controller registry.
 * Optionally probes health and skips known-unhealthy adapters (except mock).
 */
export async function selectProviders(controller, settings = {}, options = {}) {
  const runtime = options.runtimeStatus || getRuntimeProviderStatus();
  const development = options.development
    ?? (runtime.mode === "development-mock" || isDevelopmentRuntime(options.runtimeConfig));
  const activeProvider = runtime.provider && runtime.provider !== "local"
    ? runtime.provider
    : settings.provider;
  const chain = buildProviderChain(
    { ...settings, provider: activeProvider },
    { ...options, development },
  );
  const model = ModelRegistry.resolve(settings.provider || chain[0], settings.model);
  const selected = [];
  const healthCache = options.health || {};

  for (const id of chain) {
    let provider;
    try {
      provider = controller.getProvider(id);
    } catch {
      continue;
    }

    if (id !== "mock" && options.skipUnhealthy !== false) {
      const cached = healthCache[id];
      if (cached && cached.ok === false) {
        AILogger.debug("provider skipped (unhealthy)", { provider: id, reason: cached.reason || cached.status });
        continue;
      }
    }

    // Apply per-request model without mutating the shared instance.
    selected.push(Object.freeze({
      provider,
      id,
      model: id === resolveProviderId(settings.provider) ? model : ModelRegistry.defaultModel(id),
    }));
  }

  if (!selected.length && development && !settings.offlineMode) {
    selected.push({
      provider: controller.getProvider("mock"),
      id: "mock",
      model: ModelRegistry.defaultModel("mock"),
    });
  }

  AILogger.debug("provider chain", {
    preferred: settings.provider,
    offlineMode: Boolean(settings.offlineMode),
    runtimeMode: runtime.mode,
    chain: selected.map((item) => item.id),
  });

  return Object.freeze(selected);
}

export async function probeProviderHealth(controller, providerIds = AI_FAILOVER_ORDER) {
  const results = {};
  await Promise.all(providerIds.map(async (id) => {
    try {
      const provider = controller.getProvider(id);
      results[id] = await provider.healthCheck();
    } catch (error) {
      results[id] = {
        ok: false,
        provider: id,
        status: "error",
        reason: error?.message || "unknown",
        healthTimestamp: new Date().toISOString(),
      };
    }
  }));
  return Object.freeze(results);
}
