import { AI_CONFIG } from "../../../config/ai.config.js";
import {
  AIError,
  AI_ERROR_CODES,
  AILogger,
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
    return createHealthResult({
      ok: true,
      provider: this.id,
      model: this.model,
      reachable: true,
      authentication: "not_required",
      modelExists: true,
      latencyMs: 0,
      status: "healthy",
    });
  }

  get capabilities() {
    return Object.freeze({ prompt: true, streaming: false, embeddings: false });
  }
}

/**
 * Shared adapter for cloud providers.
 * Calls only an application-owned proxy — API credentials stay on the server.
 */
export class ProxyProviderBase extends ProviderBase {
  async sendPrompt(request, options = {}) {
    if (!this.endpoint) {
      throw new AIError(AI_ERROR_CODES.PROVIDER_OFFLINE, `No proxy endpoint configured for ${this.id}`, {
        retryable: false,
        details: { reason: "missing_endpoint" },
      });
    }
    const startedAt = Date.now();
    try {
      const result = await withRetry(
        () => withTimeout(
          (signal) => this.#request(request, { ...options, signal, stream: false }),
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
        tokens: result.usage || null,
      });
      return result;
    } catch (error) {
      const aiError = toAIError(error);
      AILogger.warn("provider failure", {
        provider: this.id,
        code: aiError.code,
        latencyMs: Date.now() - startedAt,
        reason: aiError.message,
      });
      throw aiError;
    }
  }

  async *stream(request, options = {}) {
    if (!this.endpoint) {
      throw new AIError(AI_ERROR_CODES.PROVIDER_OFFLINE, `No proxy endpoint configured for ${this.id}`, {
        retryable: false,
      });
    }
    // Prefer server SSE streaming; fall back to non-stream chunking if unsupported.
    try {
      const response = await withTimeout(
        (signal) => fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream, application/json",
          },
          credentials: "same-origin",
          signal,
          body: JSON.stringify(buildProxyBody(this.id, request, { ...options, stream: true })),
        }),
        options.timeoutMs || AI_CONFIG.timeoutMs,
        options.signal,
      );
      if (!response.ok) {
        throw toAIError(Object.assign(new Error(`HTTP ${response.status}`), { status: response.status }), response);
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && response.body) {
        let full = "";
        for await (const token of readSseTokens(response.body)) {
          full += token;
          yield token;
        }
        if (!full) {
          // Empty stream → fall through to non-stream below.
        } else {
          return;
        }
      }
    } catch (error) {
      if (error instanceof AIError && error.code === AI_ERROR_CODES.CANCELLED) throw error;
      AILogger.debug("provider stream fallback", { provider: this.id, reason: error?.message || "stream unsupported" });
    }

    const result = await this.sendPrompt(request, { ...options, streaming: false });
    const tokens = String(result.content || "").split(/(\s+)/).filter(Boolean);
    for (const token of tokens) yield token;
  }

  async #request(request, options) {
    let response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        signal: options.signal,
        body: JSON.stringify(buildProxyBody(this.id, request, options)),
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
      metadata: { ...(data.metadata || {}), proxy: true },
    };
  }

  async healthCheck(options = {}) {
    const startedAt = Date.now();
    if (!this.endpoint) {
      return createHealthResult({
        ok: false,
        provider: this.id,
        model: this.model,
        reachable: false,
        authentication: "unknown",
        modelExists: false,
        latencyMs: 0,
        status: "missing_endpoint",
        reason: "missing_endpoint",
      });
    }
    try {
      const response = await withTimeout(
        (signal) => fetch(this.endpoint, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          signal,
        }),
        options.timeoutMs || AI_CONFIG.healthTimeoutMs || 5000,
        options.signal,
      );
      let body = {};
      try { body = await response.json(); } catch { body = {}; }
      const latencyMs = Math.round(Date.now() - startedAt);
      const authentication = body.authentication
        || (response.status === 401 || response.status === 403 ? "failed" : response.ok ? "ok" : "unknown");
      const modelExists = body.modelExists !== false;
      const ok = Boolean(response.ok && body.ok !== false && authentication !== "failed");
      return createHealthResult({
        ok,
        provider: this.id,
        model: body.model || options.model || this.model,
        reachable: true,
        authentication,
        modelExists,
        latencyMs,
        status: ok ? "healthy" : (body.status || `http_${response.status}`),
        reason: body.reason || null,
      });
    } catch (error) {
      return createHealthResult({
        ok: false,
        provider: this.id,
        model: this.model,
        reachable: false,
        authentication: "unknown",
        modelExists: false,
        latencyMs: Math.round(Date.now() - startedAt),
        status: "unreachable",
        reason: toAIError(error).code,
      });
    }
  }

  get capabilities() {
    return Object.freeze({ prompt: true, streaming: true, embeddings: false, proxyOnly: true });
  }
}

export function createHealthResult(fields = {}) {
  return Object.freeze({
    ok: Boolean(fields.ok),
    provider: fields.provider || "unknown",
    model: fields.model || null,
    reachable: Boolean(fields.reachable),
    authentication: fields.authentication || "unknown",
    modelExists: fields.modelExists !== false,
    latencyMs: Number.isFinite(fields.latencyMs) ? fields.latencyMs : null,
    status: fields.status || (fields.ok ? "healthy" : "unhealthy"),
    reason: fields.reason || null,
    healthTimestamp: fields.healthTimestamp || new Date().toISOString(),
  });
}

function buildProxyBody(providerId, request, options = {}) {
  return {
    provider: providerId,
    model: options.model || undefined,
    messages: request.messages,
    metadata: request.metadata || {},
    options: {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      responseLength: options.responseLength,
      language: options.language,
      stream: Boolean(options.stream),
      timeoutMs: options.timeoutMs,
    },
  };
}

async function* readSseTokens(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n");
    buffer = chunks.pop() || "";
    for (const line of chunks) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        const token = parsed.token ?? parsed.content ?? parsed.delta ?? "";
        if (token) yield String(token);
      } catch {
        yield payload;
      }
    }
  }
}
