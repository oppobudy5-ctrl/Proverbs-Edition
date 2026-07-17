import { AI_CONFIG } from "../../../config/ai.config.js";
import {
  AIError,
  AI_ERROR_CODES,
  toAIError,
  withRetry,
  withTimeout,
} from "../ai-utils.js";

export class ProviderBase {
  constructor({ id, model = "unknown", endpoint = "" } = {}) {
    if (!id) throw new TypeError("Provider id is required");
    this.id = id;
    this.model = model;
    this.endpoint = endpoint;
  }

  async sendPrompt() {
    throw new AIError(AI_ERROR_CODES.API_ERROR, `${this.id}.sendPrompt() is not implemented`, { retryable: false });
  }

  async *stream(request, options = {}) {
    const response = await this.sendPrompt(request, options);
    const tokens = String(response.content || "").split(/(\s+)/).filter(Boolean);
    for (const token of tokens) yield token;
  }

  async embeddings() {
    throw new AIError(AI_ERROR_CODES.API_ERROR, `${this.id} does not support embeddings yet`, { retryable: false });
  }

  async healthCheck() {
    return { ok: true, provider: this.id, model: this.model, mode: "available" };
  }

  get capabilities() {
    return Object.freeze({ prompt: true, streaming: false, embeddings: false });
  }
}

// Shared adapter for cloud providers. It only calls an application-owned proxy:
// API credentials remain in a Worker / Function / backend, never in this bundle.
export class ProxyProviderBase extends ProviderBase {
  async sendPrompt(request, options = {}) {
    if (!this.endpoint) {
      throw new AIError(AI_ERROR_CODES.PROVIDER_OFFLINE, `No proxy endpoint configured for ${this.id}`, { retryable: false });
    }
    return withRetry(
      () => withTimeout(
        (signal) => this.#request(request, { ...options, signal }),
        options.timeoutMs || AI_CONFIG.timeoutMs,
        options.signal,
      ),
      { signal: options.signal, retry: options.retry },
    );
  }

  async #request(request, options) {
    let response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        signal: options.signal,
        body: JSON.stringify({
          provider: this.id,
          model: options.model || this.model,
          messages: request.messages,
          metadata: request.metadata || {},
          options: {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            responseLength: options.responseLength,
            language: options.language,
            stream: false,
          },
        }),
      });
    } catch (error) {
      throw toAIError(error);
    }
    if (!response.ok) {
      let detail = "";
      try { detail = (await response.json())?.message || ""; } catch { detail = await response.text().catch(() => ""); }
      throw toAIError(Object.assign(new Error(detail || `HTTP ${response.status}`), { status: response.status }), response);
    }
    const data = await response.json();
    const content = data.content ?? data.text ?? data.message?.content;
    if (typeof content !== "string") {
      throw new AIError(AI_ERROR_CODES.API_ERROR, `Invalid response from ${this.id} proxy`, { retryable: false });
    }
    return {
      content,
      model: data.model || options.model || this.model,
      usage: data.usage || null,
      metadata: data.metadata || {},
    };
  }

  async healthCheck(options = {}) {
    if (!this.endpoint) return { ok: false, provider: this.id, reason: "missing_endpoint" };
    try {
      const response = await withTimeout(
        (signal) => fetch(this.endpoint, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          signal,
        }),
        options.timeoutMs || 5000,
        options.signal,
      );
      return { ok: response.ok, provider: this.id, status: response.status };
    } catch (error) {
      return { ok: false, provider: this.id, error: toAIError(error).code };
    }
  }

  get capabilities() {
    return Object.freeze({ prompt: true, streaming: false, embeddings: false, proxyOnly: true });
  }
}
