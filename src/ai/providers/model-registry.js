import {
  AI_MODEL_REGISTRY,
  AI_PROVIDER_IDS,
  defaultModelFor,
  listModelsFor,
  resolveProviderId,
} from "../../../config/ai.config.js";

/**
 * Read-only model registry for interchangeable providers.
 * UI / settings pick a model id; providers never hardcode a single model.
 */
export const ModelRegistry = Object.freeze({
  providers: AI_PROVIDER_IDS,
  all() {
    return AI_MODEL_REGISTRY;
  },
  forProvider(providerId) {
    return listModelsFor(providerId);
  },
  defaultModel(providerId) {
    return defaultModelFor(providerId);
  },
  has(providerId, modelId) {
    const models = listModelsFor(providerId);
    return models.some((model) => model.id === modelId);
  },
  resolve(providerId, preferredModel) {
    const id = resolveProviderId(providerId);
    const preferred = String(preferredModel || "").trim();
    if (preferred && this.has(id, preferred)) return preferred;
    if (preferred) return preferred; // allow deployment-specific model ids
    return defaultModelFor(id);
  },
});

export default ModelRegistry;
