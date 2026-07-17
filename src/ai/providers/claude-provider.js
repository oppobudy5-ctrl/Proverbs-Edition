import { AI_CONFIG } from "../../../config/ai.config.js";
import { ProxyProviderBase } from "./provider-base.js";

export class ClaudeProvider extends ProxyProviderBase {
  constructor(options = {}) {
    super({
      id: "claude",
      model: options.model || AI_CONFIG.models.claude,
      endpoint: options.endpoint || AI_CONFIG.endpoints.claude,
    });
  }
}
