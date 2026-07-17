import { AI_CONFIG } from "../../../config/ai.config.js";
import { ProviderBase, createHealthResult } from "./provider-base.js";
import { AIError, AI_ERROR_CODES, AILogger, toAIError, withRetry, withTimeout } from "../ai-utils.js";

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
    const startedAt = Date.now();
    try {
      const result = await withRetry(
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
            if (!response.ok) {
              throw toAIError(Object.assign(new Error(`Ollama HTTP ${response.status}`), { status: response.status }), response);
            }
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
              metadata: { local: true, streaming: false },
            };
          },
          options.timeoutMs || AI_CONFIG.timeoutMs,
          options.signal,
        ),
        { signal: options.signal, retry: options.retry || AI_CONFIG.retry },
      );
      AILogger.debug("provider success", {
        provider: this.id,
        model: result.model,
        latencyMs: Date.now() - startedAt,
        streaming: false,
        tokens: result.usage,
      });
      return result;
    } catch (error) {
      const aiError = toAIError(error);
      AILogger.warn("provider failure", {
        provider: this.id,
        code: aiError.code,
        latencyMs: Date.now() - startedAt,
      });
      throw aiError;
    }
  }

  async *stream(request, options = {}) {
    try {
      const response = await withTimeout(
        async (signal) => fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            model: options.model || this.model,
            messages: request.messages,
            stream: true,
            options: {
              temperature: options.temperature,
              num_predict: options.maxTokens,
            },
          }),
        }),
        options.timeoutMs || AI_CONFIG.timeoutMs,
        options.signal,
      );
      if (!response.ok || !response.body) {
        throw toAIError(Object.assign(new Error(`Ollama HTTP ${response.status}`), { status: response.status }), response);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            const token = parsed.message?.content || parsed.response || "";
            if (token) yield token;
          } catch {
            /* ignore partial JSON lines */
          }
        }
      }
      return;
    } catch (error) {
      if (error instanceof AIError && error.code === AI_ERROR_CODES.CANCELLED) throw error;
      AILogger.debug("ollama stream fallback", { reason: error?.message || "stream failed" });
    }
    const result = await this.sendPrompt(request, options);
    for (const token of String(result.content || "").split(/(\s+)/).filter(Boolean)) yield token;
  }

  async healthCheck(options = {}) {
    const startedAt = Date.now();
    const model = options.model || this.model;
    try {
      const url = new URL("/api/tags", this.endpoint).toString();
      const response = await withTimeout(
        (signal) => fetch(url, { signal }),
        options.timeoutMs || AI_CONFIG.healthTimeoutMs || 3000,
        options.signal,
      );
      if (!response.ok) {
        return createHealthResult({
          ok: false,
          provider: this.id,
          model,
          reachable: true,
          authentication: "not_required",
          modelExists: false,
          latencyMs: Date.now() - startedAt,
          status: `http_${response.status}`,
        });
      }
      const data = await response.json().catch(() => ({}));
      const names = (data.models || []).map((item) => item.name || item.model || "");
      const modelExists = !model || names.some((name) => name === model || name.startsWith(`${model}:`));
      return createHealthResult({
        ok: true,
        provider: this.id,
        model,
        reachable: true,
        authentication: "not_required",
        modelExists,
        latencyMs: Date.now() - startedAt,
        status: modelExists ? "healthy" : "model_missing",
        reason: modelExists ? null : "model_not_found",
      });
    } catch (error) {
      return createHealthResult({
        ok: false,
        provider: this.id,
        model,
        reachable: false,
        authentication: "not_required",
        modelExists: false,
        latencyMs: Date.now() - startedAt,
        status: "unreachable",
        reason: toAIError(error).code,
      });
    }
  }

  get capabilities() {
    return Object.freeze({ prompt: true, streaming: true, embeddings: false, local: true });
  }
}
