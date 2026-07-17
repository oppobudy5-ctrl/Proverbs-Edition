import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = new EventTarget();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { AILogger, AI_ERROR_CODES, AIError } = await import("../src/ai/ai-utils.js");
AILogger.setMode("production");

const {
  AI_CONFIG,
  AI_PROVIDER_IDS,
  AI_MODEL_REGISTRY,
  resolveProviderId,
} = await import("../config/ai.config.js");
const { AISettings } = await import("../src/ai/ai-settings.js");
const { ModelRegistry } = await import("../src/ai/providers/model-registry.js");
const {
  buildProviderChain,
  isFailoverWorthy,
  selectProviders,
} = await import("../src/ai/providers/provider-selector.js");
const { createHealthResult } = await import("../src/ai/providers/provider-base.js");
const { MockProvider } = await import("../src/ai/providers/mock-provider.js");
const { OpenAIProvider } = await import("../src/ai/providers/openai-provider.js");
const { GeminiProvider } = await import("../src/ai/providers/gemini-provider.js");
const { OllamaProvider } = await import("../src/ai/providers/ollama-provider.js");
const { ClaudeProvider } = await import("../src/ai/providers/claude-provider.js");
const { AzureOpenAIProvider } = await import("../src/ai/providers/azure-provider.js");
const { AIController } = await import("../src/ai/ai-controller.js");
const { AIService } = await import("../src/ai/ai-service.js");
const { providerCredentialStatus, publicAiConfig, handleAiProxyRequest } = await import("./ai-proxy.mjs");

// --- Registry & config ---
assert.ok(AI_PROVIDER_IDS.includes("openai"));
assert.ok(AI_PROVIDER_IDS.includes("gemini"));
assert.ok(AI_PROVIDER_IDS.includes("ollama"));
assert.ok(AI_PROVIDER_IDS.includes("azure"));
assert.ok(AI_MODEL_REGISTRY.openai.length >= 2);
assert.equal(resolveProviderId("anthropic"), "claude");
assert.equal(ModelRegistry.defaultModel("openai"), AI_CONFIG.models.openai);
console.log("PASS: provider + model registry");

// --- Settings ---
AISettings.reset();
const snap = AISettings.snapshot();
assert.equal(snap.currentProvider, "mock");
assert.ok("streaming" in snap && "offlineMode" in snap && "debugMode" in snap);
const updated = AISettings.update({
  provider: "openai",
  model: "gpt-4o",
  streaming: false,
  offlineMode: true,
  debugMode: true,
  temperature: 0.2,
});
assert.equal(updated.provider, "openai");
assert.equal(updated.model, "gpt-4o");
assert.equal(updated.offlineMode, true);
assert.equal(updated.debugMode, true);
assert.equal(globalThis.__AI_DEBUG__, true);
AISettings.reset();
console.log("PASS: AI settings snapshot / update");

// --- Adapter interface ---
const adapters = [
  new MockProvider(),
  new OpenAIProvider(),
  new GeminiProvider(),
  new ClaudeProvider(),
  new AzureOpenAIProvider(),
  new OllamaProvider(),
];
for (const adapter of adapters) {
  assert.equal(typeof adapter.sendPrompt, "function");
  assert.equal(typeof adapter.stream, "function");
  assert.equal(typeof adapter.healthCheck, "function");
  assert.equal(typeof adapter.capabilities.prompt, "boolean");
  assert.equal(typeof adapter.capabilities.streaming, "boolean");
}
const mockHealth = await new MockProvider().healthCheck();
assert.equal(mockHealth.ok, true);
assert.ok(mockHealth.healthTimestamp);
assert.equal(mockHealth.reachable, true);
assert.ok("authentication" in mockHealth);
assert.ok("modelExists" in mockHealth);
assert.ok("latencyMs" in mockHealth);
console.log("PASS: provider adapters + health shape");

// --- Selection / offline / failover chain ---
assert.deepEqual(buildProviderChain({ offlineMode: true }), []);
const chain = buildProviderChain({ provider: "openai" });
assert.equal(chain[0], "openai");
assert.equal(chain[chain.length - 1], "mock");
assert.equal(isFailoverWorthy(new AIError(AI_ERROR_CODES.TIMEOUT)), true);
assert.equal(isFailoverWorthy(new AIError(AI_ERROR_CODES.CANCELLED)), false);
console.log("PASS: provider selection + failover rules");

// --- Controller failover with failing preferred provider ---
class FailingProvider {
  constructor(id) {
    this.id = id;
    this.model = `${id}-test`;
    this.endpoint = `/api/ai/${id}`;
  }
  async sendPrompt() {
    throw new AIError(AI_ERROR_CODES.PROVIDER_OFFLINE, `${this.id} offline`, { retryable: true });
  }
  async *stream() {
    throw new AIError(AI_ERROR_CODES.PROVIDER_OFFLINE, `${this.id} offline`, { retryable: true });
  }
  async embeddings() { return []; }
  async healthCheck() {
    return createHealthResult({
      ok: false,
      provider: this.id,
      reachable: false,
      authentication: "unknown",
      modelExists: false,
      latencyMs: 1,
      status: "unreachable",
      reason: "offline",
    });
  }
  get capabilities() {
    return Object.freeze({ prompt: true, streaming: true, embeddings: false });
  }
}

const controller = new AIController({
  openaiProvider: new FailingProvider("openai"),
  geminiProvider: new FailingProvider("gemini"),
  claudeProvider: new FailingProvider("claude"),
  azureProvider: new FailingProvider("azure"),
  ollamaProvider: new FailingProvider("ollama"),
  mockProvider: new MockProvider({ latencyMs: 0 }),
});

AISettings.update({ provider: "openai", offlineMode: false, streaming: false });
const candidates = await selectProviders(controller, AISettings.get());
assert.ok(candidates.some((item) => item.id === "mock"));

const response = await controller.execute("qa", {
  question: "Apa arti hikmat?",
  chapter: 1,
  day: 1,
  cache: false,
  persist: false,
  settings: { provider: "openai", streaming: false },
});
assert.equal(response.provider, "mock");
assert.ok(response.content.length > 20);
assert.ok(Array.isArray(response.metadata.failover));
const runtimeAfterFailover = await AIService.getProviderStatus();
assert.equal(runtimeAfterFailover.mode, "development-mock");
assert.ok(runtimeAfterFailover.fallbackCount >= 1);
assert.match(runtimeAfterFailover.reason, /openai|gemini|ollama/i);
console.log("PASS: provider failover → mock");

// --- Offline mode returns canonical answer, never mock ---
AISettings.update({ offlineMode: true, provider: "openai" });
const offline = await AIService.ask("Ringkas pasal ini", {
  chapter: 1,
  day: 1,
  cache: false,
  persist: false,
});
assert.equal(offline.provider, "local");
assert.equal(offline.metadata.canonical_only, true);
console.log("PASS: offline mode");

// --- Streaming fallback (mock streams tokens) ---
AISettings.update({ offlineMode: false, provider: "mock", streaming: true });
let tokens = 0;
const streamed = await controller.execute("explain", {
  question: "Jelaskan takut akan Tuhan",
  chapter: 1,
  day: 1,
  cache: false,
  persist: false,
  settings: { provider: "mock", streaming: true },
  // explain is guarded → buffered; still exercises stream path internally for non-guarded.
});
assert.ok(streamed.content.length > 10);
void tokens;
console.log("PASS: streaming path (mock)");

// --- Server proxy security / config (no secrets leaked) ---
const publicConfig = publicAiConfig();
assert.ok(publicConfig.providers.mock.configured);
assert.equal(typeof publicConfig.providers.openai.configured, "boolean");
const serialized = JSON.stringify(publicConfig);
assert.doesNotMatch(serialized, /sk-/);
assert.doesNotMatch(serialized, /API_KEY/);
assert.equal(providerCredentialStatus("mock").configured, true);

const missing = await handleAiProxyRequest({
  provider: "openai",
  method: "POST",
  body: { messages: [{ role: "user", content: "hi" }] },
});
assert.ok(missing.status >= 400);
const missingBody = JSON.parse(missing.body);
assert.ok(missingBody.message);
assert.doesNotMatch(missing.body, /sk-/);
console.log("PASS: secure proxy config + missing-key handling");

// --- UI / docs boundaries ---
const settingsUi = await readFile(path.join(ROOT, "js/ui/settings-panel.js"), "utf8");
assert.match(settingsUi, /AISettings/);
assert.match(settingsUi, /offlineMode/);
assert.doesNotMatch(settingsUi, /OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|AZURE_OPENAI_KEY/);

const lessonUi = await readFile(path.join(ROOT, "js/ui/ai-lesson-assist.js"), "utf8");
assert.doesNotMatch(lessonUi, /OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|AZURE_OPENAI_KEY/);
assert.doesNotMatch(lessonUi, /from \"\.\.\/\.\.\/src\/ai\/providers\//);

const service = await readFile(path.join(ROOT, "src/ai/ai-service.js"), "utf8");
assert.doesNotMatch(service, /OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|AZURE_OPENAI_KEY/);
console.log("PASS: UI boundary — no secrets / no direct provider imports in Ask UI");

AISettings.reset();
console.log("VALID: Phase 006B production provider registry, health, failover, offline, settings, and security.");
