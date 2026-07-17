import { AI_CONFIG } from "../../../config/ai.config.js";
import { ProxyProviderBase } from "./provider-base.js";

export class OpenAIProvider extends ProxyProviderBase {
  constructor(options = {}) {
    super({
      id: "openai",
      model: options.model || AI_CONFIG.models.openai,
      endpoint: options.endpoint || AI_CONFIG.endpoints.openai,
    });
  }
}
