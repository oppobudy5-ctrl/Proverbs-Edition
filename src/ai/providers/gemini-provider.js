import { AI_CONFIG } from "../../../config/ai.config.js";
import { ProxyProviderBase } from "./provider-base.js";

export class GeminiProvider extends ProxyProviderBase {
  constructor(options = {}) {
    super({
      id: "gemini",
      model: options.model || AI_CONFIG.models.gemini,
      endpoint: options.endpoint || AI_CONFIG.endpoints.gemini,
    });
  }
}
