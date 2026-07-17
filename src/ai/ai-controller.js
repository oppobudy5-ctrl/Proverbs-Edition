import { AI_CONFIG } from "../../config/ai.config.js";
import { AISettings } from "./ai-settings.js";
import { promptBuilder } from "./prompt-builder.js";
import { contextBuilder } from "./context-builder.js";
import { retrievalEngine } from "./retrieval-engine.js";
import { aiCache } from "./ai-cache.js";
import { conversationStore, createConversationId } from "./conversation-store.js";
import { createAIResponse } from "./types/ai-response.js";
import {
  AIError,
  AI_ERROR_CODES,
  AIEvents,
  AI_EVENTS,
  AILogger,
  AIDebug,
  toAIError,
} from "./ai-utils.js";
import { MockProvider } from "./providers/mock-provider.js";
import { OpenAIProvider } from "./providers/openai-provider.js";
import { GeminiProvider } from "./providers/gemini-provider.js";
import { ClaudeProvider } from "./providers/claude-provider.js";
import { OllamaProvider } from "./providers/ollama-provider.js";
import { canonicalContextGateway, initCIL } from "./cil/index.js";
import { theologicalGuardrails } from "./cil/theological-guardrails.js";

export class AIController {
  #providers = new Map();
  #active = new Map();

  constructor(dependencies = {}) {
    this.promptBuilder = dependencies.promptBuilder || promptBuilder;
    this.contextBuilder = dependencies.contextBuilder || contextBuilder;
    this.retrieval = dependencies.retrieval || retrievalEngine;
    this.cache = dependencies.cache || aiCache;
    this.conversations = dependencies.conversations || conversationStore;
    this.gateway = dependencies.gateway || canonicalContextGateway;

    this.registerProvider("mock", dependencies.mockProvider || new MockProvider());
    this.registerProvider("openai", dependencies.openaiProvider || new OpenAIProvider());
    this.registerProvider("gemini", dependencies.geminiProvider || new GeminiProvider());
    this.registerProvider("claude", dependencies.claudeProvider || new ClaudeProvider());
    this.registerProvider("ollama", dependencies.ollamaProvider || new OllamaProvider());
  }

  registerProvider(id, provider) {
    const required = ["sendPrompt", "stream", "embeddings", "healthCheck"];
    if (!id || !provider || required.some((method) => typeof provider[method] !== "function")) {
      throw new TypeError(`Provider "${id || "unknown"}" does not implement the required interface`);
    }
    this.#providers.set(id, provider);
    return this;
  }

  getProvider(id) {
    const provider = this.#providers.get(id);
    if (!provider) throw new AIError(AI_ERROR_CODES.INVALID_REQUEST, `Unknown AI provider: ${id}`, { retryable: false });
    return provider;
  }

  listProviders() {
    return Array.from(this.#providers.entries()).map(([id, provider]) => ({
      id,
      model: provider.model,
      capabilities: provider.capabilities,
    }));
  }

  async execute(intent, payload = {}, callbacks = {}) {
    const requestId = payload.requestId || `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const abortController = new AbortController();
    const externalSignal = payload.signal;
    const forwardAbort = () => abortController.abort("external");
    if (externalSignal?.aborted) forwardAbort();
    else externalSignal?.addEventListener("abort", forwardAbort, { once: true });
    this.#active.set(requestId, abortController);

    const settings = Object.freeze({ ...AISettings.get(), ...(payload.settings || {}) });
    const provider = this.getProvider(settings.provider);
    const question = String(payload.question || "").trim();
    const conversationId = payload.conversationId || createConversationId();
    const startedAt = performanceNow();

    AIEvents.emit(AI_EVENTS.STARTED, { requestId, intent, provider: provider.id, conversationId });
    AILogger.debug("request started", { requestId, intent, provider: provider.id });
    AIDebug.log("Gateway Called", `provider=${provider.id} intent=${intent}`);

    try {
      await initCIL(payload.cilInit || {});

      const canonical = payload.canonical || await this.gateway.buildCanonicalContext({
        book: payload.book || "proverbs",
        chapter: payload.chapter,
        verse: payload.verse,
        day: payload.day,
        intent,
        topic: payload.topic,
        query: payload.query || question,
        question,
        conversation: payload.conversationId,
        tokenBudget: payload.tokenBudget,
        journalConsent: payload.journalConsent,
        journal: payload.journalExcerpt ? { excerpt: payload.journalExcerpt } : null,
        metadata: { requestId, intent, ...(payload.metadata || {}) },
        limit: payload.retrievalLimit || AI_CONFIG.retrievalLimit,
      });

      const retrieved = canonical.retrieved || [];
      const context = this.gateway.toLegacyContext(canonical, {
        question,
        metadata: { requestId, intent, canonical: true, ...(payload.metadata || {}) },
      });

      const prompt = this.promptBuilder.build({
        intent,
        question,
        context,
        canonical,
        settings,
        metadata: { requestId, conversationId, ...(payload.metadata || {}) },
      });
      const cacheInput = {
        prompt: prompt.messages.map((message) => `${message.role}:${message.content}`).join("\n"),
        chapter: context.chapter,
        provider: provider.id,
      };

      if (payload.cache !== false) {
        const cached = await this.#safeCacheGet(cacheInput);
        if (cached) {
          const response = createAIResponse({
            ...cached,
            cached: true,
            metadata: { ...(cached.metadata || {}), requestId, conversationId, retrieved, cil: true },
          });
          if (payload.persist !== false) {
            await this.#safeConversationAdd({
              question: question || defaultQuestion(intent, context),
              answer: response.content,
              chapter: context.chapter,
              provider: provider.id,
              conversationId,
              metadata: { intent, requestId, responseId: response.id, cached: true },
            });
          }
          callbacks.onToken?.(response.content, response.content);
          AIEvents.emit(AI_EVENTS.PROGRESS, {
            requestId,
            token: response.content,
            content: response.content,
            completeChunk: true,
            cached: true,
          });
          callbacks.onFinish?.(response);
          AIEvents.emit(AI_EVENTS.FINISHED, { requestId, response, cached: true });
          return response;
        }
      }

      const guarded = theologicalGuardrails.isGuardedIntent(intent);

      const providerResult = await this.#runProvider(provider, prompt, settings, {
        ...callbacks,
        requestId,
        signal: abortController.signal,
        timeoutMs: payload.timeoutMs,
        bufferUntilValidated: guarded,
      });

      const validation = this.gateway.validateResponse(providerResult.content, canonical, { intent });
      const response = createAIResponse({
        content: validation.content,
        provider: provider.id,
        model: providerResult.model || provider.model,
        usage: providerResult.usage,
        citations: validation.citations,
        confidence: validation.confidence,
        confidenceComponents: validation.confidenceComponents,
        guardrails: {
          status: validation.status,
          checks: validation.checks,
          warnings: validation.warnings,
          inventedRefs: validation.inventedRefs,
        },
        metadata: {
          ...(providerResult.metadata || {}),
          requestId,
          conversationId,
          intent,
          chapter: context.chapter,
          retrieved,
          durationMs: Math.round(performanceNow() - startedAt),
          cil: true,
          degraded: Boolean(canonical.degraded),
          usedFallback: validation.usedFallback,
        },
      });

      if (guarded) {
        callbacks.onToken?.(validation.content, validation.content);
        AIEvents.emit(AI_EVENTS.PROGRESS, {
          requestId,
          token: validation.content,
          content: validation.content,
          completeChunk: true,
          validated: true,
        });
      }

      if (payload.cache !== false) await this.#safeCacheSet(cacheInput, response, payload.cacheTtlMs);
      if (payload.persist !== false) {
        await this.#safeConversationAdd({
          question: question || defaultQuestion(intent, context),
          answer: response.content,
          chapter: context.chapter,
          provider: provider.id,
          conversationId,
          metadata: { intent, requestId, responseId: response.id },
        });
      }

      AIDebug.log("Provider Returned", `${provider.id} · ${response.metadata.durationMs}ms · guardrails=${validation.status}`);
      callbacks.onFinish?.(response);
      AIEvents.emit(AI_EVENTS.FINISHED, { requestId, response, cached: false });
      AILogger.info("request finished", { requestId, provider: provider.id, durationMs: response.metadata.durationMs });
      return response;
    } catch (error) {
      const aiError = toAIError(error);
      if (aiError.code === AI_ERROR_CODES.CANCELLED) {
        AIEvents.emit(AI_EVENTS.CANCELLED, { requestId, error: aiError });
      } else {
        AIEvents.emit(AI_EVENTS.ERROR, { requestId, error: aiError });
        AILogger.error("request failed", { requestId, code: aiError.code, error });
      }
      AIDebug.log("Gateway Failed", `${provider.id} · ${classifyGatewayFailure(aiError)}`);
      callbacks.onError?.(aiError);
      throw aiError;
    } finally {
      this.#active.delete(requestId);
      externalSignal?.removeEventListener("abort", forwardAbort);
    }
  }

  cancel(requestId) {
    const controller = this.#active.get(requestId);
    if (!controller) return false;
    controller.abort("cancelled");
    return true;
  }

  cancelAll() {
    for (const controller of this.#active.values()) controller.abort("cancelled");
    this.#active.clear();
  }

  async healthCheck(providerId = AISettings.get().provider) {
    return this.getProvider(providerId).healthCheck();
  }

  async #runProvider(provider, prompt, settings, callbacks) {
    const options = {
      ...settings,
      signal: callbacks.signal,
      timeoutMs: callbacks.timeoutMs || AI_CONFIG.timeoutMs,
    };
    const buffer = Boolean(callbacks.bufferUntilValidated);
    if (settings.streaming && provider.capabilities.streaming) {
      let content = "";
      for await (const token of provider.stream(prompt, options)) {
        content += token;
        if (!buffer) {
          callbacks.onToken?.(token, content);
          AIEvents.emit(AI_EVENTS.PROGRESS, { requestId: callbacks.requestId, token, content });
        }
      }
      return { content, model: provider.model, metadata: { streamed: true, buffered: buffer } };
    }
    const result = await provider.sendPrompt(prompt, options);
    if (result.content && !buffer) {
      callbacks.onToken?.(result.content, result.content);
      AIEvents.emit(AI_EVENTS.PROGRESS, {
        requestId: callbacks.requestId,
        token: result.content,
        content: result.content,
        completeChunk: true,
      });
    }
    return result;
  }

  async #safeCacheGet(input) {
    try { return await this.cache.get(input); }
    catch (error) { AILogger.warn("cache read skipped", error); return null; }
  }

  async #safeCacheSet(input, response, ttlMs) {
    try { await this.cache.set(input, response, { ttlMs }); }
    catch (error) { AILogger.warn("cache write skipped", error); }
  }

  async #safeConversationAdd(record) {
    try { await this.conversations.add(record); }
    catch (error) { AILogger.warn("conversation persistence skipped", error); }
  }
}

/** Map an AIError to the human-readable failure reasons required by TASK 6. */
function classifyGatewayFailure(error) {
  switch (error?.code) {
    case AI_ERROR_CODES.PROVIDER_OFFLINE: return "offline / provider unavailable";
    case AI_ERROR_CODES.TIMEOUT: return "timeout";
    case AI_ERROR_CODES.RATE_LIMIT: return "rate limit";
    case AI_ERROR_CODES.QUOTA_EXCEEDED: return "quota exceeded";
    case AI_ERROR_CODES.API_ERROR: return "provider API error";
    case AI_ERROR_CODES.INVALID_REQUEST: return "configuration / missing key or context";
    default: return error?.message || "unknown";
  }
}

function defaultQuestion(intent, context) {
  const reference = context.book && context.chapter ? `${context.book} ${context.chapter}` : "bacaan ini";
  return `${intent}: ${reference}`;
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export const aiController = new AIController();
