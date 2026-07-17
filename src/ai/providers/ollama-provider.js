import { AI_CONFIG } from "../../../config/ai.config.js";
import { ProviderBase } from "./provider-base.js";
import { AIError, AI_ERROR_CODES, toAIError, withRetry, withTimeout } from "../ai-utils.js";

// Local-only adapter. No API key is accepted or persisted.
export class OllamaProvider extends ProviderBase {
  constructor(options = {}) {
    super({
      id: "ollama",
      model: options.model || AI_CONFIG.models.ollama,
      endpoint: options.endpoint || AI_CONFIG.endpoints.ollama,
    });
  }

  async sendPrompt(request, options = {}) {
    return withRetry(
      () => withTimeout(
        async (signal) => {
          let response;
          try {
            response = await fetch(this.endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal,
              body: JSON.stringify({
                model: options.model || this.model,
                messages: request.messages,
                stream: false,
                options: {
                  temperature: options.temperature,
                  num_predict: options.maxTokens,
                },
              }),
            });
          } catch (error) {
            throw toAIError(error);
          }
          if (!response.ok) throw toAIError(Object.assign(new Error(`Ollama HTTP ${response.status}`), { status: response.status }), response);
          const data = await response.json();
          const content = data.message?.content ?? data.response;
          if (typeof content !== "string") {
            throw new AIError(AI_ERROR_CODES.API_ERROR, "Invalid Ollama response", { retryable: false });
          }
          return {
            content,
            model: data.model || options.model || this.model,
            usage: {
              promptTokens: data.prompt_eval_count || null,
              completionTokens: data.eval_count || null,
            },
            metadata: { local: true },
          };
        },
        options.timeoutMs || AI_CONFIG.timeoutMs,
        options.signal,
      ),
      { signal: options.signal, retry: options.retry },
    );
  }

  async healthCheck(options = {}) {
    try {
      const url = new URL("/api/tags", this.endpoint).toString();
      const response = await withTimeout(
        (signal) => fetch(url, { signal }),
        options.timeoutMs || 3000,
        options.signal,
      );
      return { ok: response.ok, provider: this.id, local: true };
    } catch {
      return { ok: false, provider: this.id, local: true };
    }
  }

  get capabilities() {
    return Object.freeze({ prompt: true, streaming: false, embeddings: false, local: true });
  }
}
