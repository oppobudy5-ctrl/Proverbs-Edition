import { AI_CONFIG } from "../../../config/ai.config.js";
import { ProxyProviderBase } from "./provider-base.js";

/** Optional Azure OpenAI adapter — same proxy interface as OpenAI. */
export class AzureOpenAIProvider extends ProxyProviderBase {
  constructor(options = {}) {
    super({
      id: "azure",
      model: options.model || AI_CONFIG.models.azure,
      endpoint: options.endpoint || AI_CONFIG.endpoints.azure,
    });
  }
}
