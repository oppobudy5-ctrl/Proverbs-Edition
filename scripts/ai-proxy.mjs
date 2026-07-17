/**
 * Server-side AI proxy — credentials stay on the server.
 * Used by the local dev server and Cloudflare Pages Functions.
 *
 * Never import this module into the browser bundle.
 */
import { AI_CONFIG, resolveProviderId } from "../config/ai.config.js";

const PROVIDER_ENV = Object.freeze({
  openai: Object.freeze({ key: "OPENAI_API_KEY", model: "OPENAI_MODEL" }),
  gemini: Object.freeze({ key: "GEMINI_API_KEY", model: "GEMINI_MODEL" }),
  claude: Object.freeze({ key: "ANTHROPIC_API_KEY", model: "ANTHROPIC_MODEL" }),
  azure: Object.freeze({
    key: "AZURE_OPENAI_KEY",
    endpoint: "AZURE_OPENAI_ENDPOINT",
    deployment: "AZURE_OPENAI_DEPLOYMENT",
  }),
});

export function readEnv(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value);
}

export function providerCredentialStatus(providerId) {
  const id = resolveProviderId(providerId);
  if (id === "mock") {
    return { configured: true, authentication: "not_required" };
  }
  if (id === "ollama") {
    return { configured: true, authentication: "not_required" };
  }
  if (id === "azure") {
    const key = readEnv(PROVIDER_ENV.azure.key);
    const endpoint = readEnv(PROVIDER_ENV.azure.endpoint);
    const ok = Boolean(key && endpoint);
    return {
      configured: ok,
      authentication: ok ? "ok" : "missing_key",
    };
  }
  const meta = PROVIDER_ENV[id];
  if (!meta) return { configured: false, authentication: "unknown" };
  const key = readEnv(meta.key);
  return {
    configured: Boolean(key),
    authentication: key ? "ok" : "missing_key",
  };
}

export function publicAiConfig() {
  const providers = {};
  for (const id of ["mock", "openai", "gemini", "claude", "azure", "ollama"]) {
    const creds = providerCredentialStatus(id);
    providers[id] = {
      id,
      configured: creds.configured,
      authentication: creds.authentication,
      defaultModel: AI_CONFIG.models[id],
      proxyOnly: id !== "mock" && id !== "ollama",
    };
  }
  return {
    defaultProvider: AI_CONFIG.defaultProvider,
    failoverOrder: AI_CONFIG.failoverOrder,
    streaming: AI_CONFIG.streaming,
    timeoutMs: AI_CONFIG.timeoutMs,
    models: AI_CONFIG.models,
    providers,
  };
}

export async function handleAiProxyRequest({ provider, method, body, signal }) {
  const id = resolveProviderId(provider);
  if (method === "GET") {
    return healthFor(id);
  }
  if (method !== "POST") {
    return jsonResponse(405, { ok: false, message: "Method not allowed" });
  }
  if (id === "mock" || id === "ollama") {
    return jsonResponse(400, {
      ok: false,
      message: `${id} is handled by the client adapter, not the cloud proxy`,
    });
  }

  const creds = providerCredentialStatus(id);
  if (!creds.configured) {
    return jsonResponse(503, {
      ok: false,
      message: `Provider ${id} is not configured (missing API key / endpoint)`,
      reason: "configuration",
      authentication: creds.authentication,
    });
  }

  try {
    const result = await dispatchProvider(id, body || {}, signal);
    return jsonResponse(200, result);
  } catch (error) {
    const status = error.status || 502;
    return jsonResponse(status, {
      ok: false,
      message: safeErrorMessage(error),
      reason: error.reason || "provider_error",
    });
  }
}

async function healthFor(id) {
  const startedAt = Date.now();
  const creds = providerCredentialStatus(id);
  if (id === "mock") {
    return jsonResponse(200, {
      ok: true,
      provider: id,
      model: AI_CONFIG.models.mock,
      reachable: true,
      authentication: "not_required",
      modelExists: true,
      latencyMs: Date.now() - startedAt,
      status: "healthy",
      healthTimestamp: new Date().toISOString(),
    });
  }
  if (!creds.configured) {
    return jsonResponse(503, {
      ok: false,
      provider: id,
      reachable: true,
      authentication: creds.authentication,
      modelExists: false,
      latencyMs: Date.now() - startedAt,
      status: "not_configured",
      reason: "missing_key",
      healthTimestamp: new Date().toISOString(),
    });
  }
  return jsonResponse(200, {
    ok: true,
    provider: id,
    model: AI_CONFIG.models[id],
    reachable: true,
    authentication: creds.authentication,
    modelExists: true,
    latencyMs: Date.now() - startedAt,
    status: "healthy",
    healthTimestamp: new Date().toISOString(),
  });
}

async function dispatchProvider(id, body, signal) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const options = body.options || {};
  const model = body.model || AI_CONFIG.models[id];
  const temperature = Number.isFinite(options.temperature) ? options.temperature : AI_CONFIG.defaultTemperature;
  const maxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : AI_CONFIG.defaultMaxTokens;

  if (id === "openai") return callOpenAI({ messages, model, temperature, maxTokens, signal });
  if (id === "gemini") return callGemini({ messages, model, temperature, maxTokens, signal });
  if (id === "claude") return callAnthropic({ messages, model, temperature, maxTokens, signal });
  if (id === "azure") return callAzure({ messages, model, temperature, maxTokens, signal });
  const error = new Error(`Unsupported provider: ${id}`);
  error.status = 400;
  throw error;
}

async function callOpenAI({ messages, model, temperature, maxTokens, signal }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${readEnv("OPENAI_API_KEY")}`,
    },
    signal,
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: toOpenAiMessages(messages),
    }),
  });
  return normalizeChatResponse(response, model, "openai");
}

async function callAzure({ messages, model, temperature, maxTokens, signal }) {
  const endpoint = readEnv("AZURE_OPENAI_ENDPOINT").replace(/\/$/, "");
  const deployment = readEnv("AZURE_OPENAI_DEPLOYMENT", model);
  const apiVersion = readEnv("AZURE_OPENAI_API_VERSION", "2024-10-21");
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${apiVersion}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": readEnv("AZURE_OPENAI_KEY"),
    },
    signal,
    body: JSON.stringify({
      temperature,
      max_tokens: maxTokens,
      messages: toOpenAiMessages(messages),
    }),
  });
  return normalizeChatResponse(response, deployment, "azure");
}

async function callAnthropic({ messages, model, temperature, maxTokens, signal }) {
  const { system, chat } = splitSystem(messages);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": readEnv("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: system || undefined,
      messages: chat.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    }),
  });
  if (!response.ok) throw await providerHttpError(response, "claude");
  const data = await response.json();
  const content = Array.isArray(data.content)
    ? data.content.map((part) => part.text || "").join("")
    : "";
  if (!content) {
    const error = new Error("Empty Anthropic response");
    error.status = 502;
    throw error;
  }
  return {
    content,
    model: data.model || model,
    usage: {
      promptTokens: data.usage?.input_tokens ?? null,
      completionTokens: data.usage?.output_tokens ?? null,
    },
    metadata: { provider: "claude" },
  };
}

async function callGemini({ messages, model, temperature, maxTokens, signal }) {
  const key = readEnv("GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const { system, chat } = splitSystem(messages);
  const contents = chat.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });
  if (!response.ok) throw await providerHttpError(response, "gemini");
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  if (!content) {
    const error = new Error("Empty Gemini response");
    error.status = 502;
    throw error;
  }
  return {
    content,
    model,
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount ?? null,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? null,
    },
    metadata: { provider: "gemini" },
  };
}

async function normalizeChatResponse(response, model, provider) {
  if (!response.ok) throw await providerHttpError(response, provider);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    const error = new Error(`Invalid ${provider} response`);
    error.status = 502;
    throw error;
  }
  return {
    content,
    model: data.model || model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
    },
    metadata: { provider },
  };
}

async function providerHttpError(response, provider) {
  let detail = "";
  try {
    const data = await response.json();
    detail = data.error?.message || data.message || JSON.stringify(data).slice(0, 200);
  } catch {
    detail = await response.text().catch(() => "");
  }
  const error = new Error(detail || `${provider} HTTP ${response.status}`);
  error.status = response.status;
  if (response.status === 401 || response.status === 403) error.reason = "authentication";
  else if (response.status === 429) error.reason = "quota";
  else if (response.status >= 500) error.reason = "provider_unavailable";
  else error.reason = "provider_error";
  return error;
}

function toOpenAiMessages(messages) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
    content: String(message.content || ""),
  }));
}

function splitSystem(messages) {
  const systemParts = [];
  const chat = [];
  for (const message of messages) {
    if (message.role === "system") systemParts.push(String(message.content || ""));
    else chat.push(message);
  }
  return { system: systemParts.join("\n\n"), chat };
}

function safeErrorMessage(error) {
  const raw = String(error?.message || "Provider request failed");
  // Never echo raw key material if a misconfigured upstream includes it.
  return raw.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 300);
}

function jsonResponse(status, payload) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}
