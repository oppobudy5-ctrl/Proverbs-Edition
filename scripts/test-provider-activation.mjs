import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = new EventTarget();

const { AISettings } = await import("../src/ai/ai-settings.js");
const { AIService } = await import("../src/ai/ai-service.js");
const { AIController } = await import("../src/ai/ai-controller.js");
const {
  activateRuntimeProvider,
  getRuntimeProviderStatus,
} = await import("../src/ai/providers/provider-runtime.js");
const { buildProviderChain } = await import("../src/ai/providers/provider-selector.js");

class RuntimeProvider {
  constructor(id, { ok = true, model = `${id}-production`, content = null } = {}) {
    this.id = id;
    this.model = model;
    this.ok = ok;
    this.content = content || `Respons produksi dari ${id} berdasarkan konteks kanonik.`;
    this.capabilities = Object.freeze({ prompt: true, streaming: true, embeddings: false });
  }
  async healthCheck() {
    return {
      ok: this.ok,
      provider: this.id,
      model: this.model,
      reachable: this.ok,
      authentication: this.ok ? "ok" : "missing_key",
      modelExists: this.ok,
      latencyMs: 4,
      status: this.ok ? "healthy" : "not_configured",
      reason: this.ok ? null : "missing_key",
      healthTimestamp: new Date().toISOString(),
    };
  }
  async sendPrompt() {
    if (!this.ok) throw new Error(`${this.id} unavailable`);
    return {
      content: this.content,
      model: this.model,
      usage: { promptTokens: 12, completionTokens: 18 },
      metadata: { production: true },
    };
  }
  async *stream() {
    yield this.content;
  }
  async embeddings() { return []; }
}

class RuntimeRegistry {
  constructor(health = {}) {
    this.providers = new Map();
    for (const id of ["openai", "gemini", "ollama", "claude", "azure", "mock"]) {
      this.providers.set(id, new RuntimeProvider(id, {
        ok: health[id] ?? (id === "mock"),
        model: `${id}-runtime`,
      }));
    }
  }
  getProvider(id) {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown provider ${id}`);
    return provider;
  }
  async healthCheck(id) {
    return this.getProvider(id).healthCheck();
  }
}

function runtimeConfig(defaultProvider, configured = {}) {
  return {
    defaultProvider,
    runtimeMode: "production",
    environmentLoaded: true,
    failoverOrder: ["openai", "gemini", "ollama", "mock"],
    providers: Object.fromEntries(
      ["openai", "gemini", "ollama", "claude", "azure", "mock"].map((id) => [
        id,
        { id, configured: configured[id] ?? id === defaultProvider },
      ]),
    ),
  };
}

// Production activation: configured provider becomes active.
for (const id of ["openai", "gemini", "ollama"]) {
  const registry = new RuntimeRegistry({ [id]: true });
  const result = await activateRuntimeProvider(registry, {
    force: true,
    development: false,
    settings: { ...AISettings.get(), provider: id, model: `${id}-runtime`, offlineMode: false },
    runtimeConfig: runtimeConfig(id, { [id]: true }),
  });
  assert.equal(result.provider, id);
  assert.equal(result.mode, "production");
  assert.equal(result.healthy, true);
  assert.equal(result.offline, false);
}
console.log("PASS: OpenAI / Gemini / Ollama runtime activation");

// Provider switching persists across a simulated browser refresh.
AISettings.update({ provider: "gemini", model: "gemini-2.0-flash", offlineMode: false });
assert.equal(AISettings.get().provider, "gemini");
const refreshedSettings = AISettings.get();
const switched = await activateRuntimeProvider(new RuntimeRegistry({ gemini: true }), {
  force: true,
  development: false,
  settings: refreshedSettings,
  runtimeConfig: runtimeConfig("gemini", { gemini: true }),
});
assert.equal(switched.provider, "gemini");
assert.equal(switched.configuredProvider, "gemini");
console.log("PASS: provider switch + browser refresh persistence");

// Production never silently selects mock.
const failed = await activateRuntimeProvider(new RuntimeRegistry({
  openai: false,
  gemini: false,
  ollama: false,
  mock: true,
}), {
  force: true,
  development: false,
  settings: { ...AISettings.get(), provider: "openai", offlineMode: false },
  runtimeConfig: runtimeConfig("openai", {
    openai: false,
    gemini: false,
    ollama: true,
    mock: true,
  }),
});
assert.equal(failed.provider, "local");
assert.equal(failed.mode, "offline-canonical");
assert.equal(failed.offline, true);
assert.match(failed.reason, /OpenAI|Ollama/);
assert.doesNotMatch(failed.reason, /silent/i);
assert.ok(!buildProviderChain(
  { provider: "openai", offlineMode: false },
  { development: false },
).includes("mock"));
console.log("PASS: missing key / unreachable → Offline Canonical (no silent mock)");

// Mock remains available only in development mode.
const development = await activateRuntimeProvider(new RuntimeRegistry({ mock: true }), {
  force: true,
  development: true,
  settings: { ...AISettings.get(), provider: "mock", offlineMode: false },
  runtimeConfig: {
    ...runtimeConfig("mock", { mock: true }),
    runtimeMode: "development",
  },
});
assert.equal(development.provider, "mock");
assert.equal(development.mode, "development-mock");
console.log("PASS: mock restricted to Development Mode");

// Offline setting bypasses all providers.
const offline = await activateRuntimeProvider(new RuntimeRegistry({ openai: true, mock: true }), {
  force: true,
  development: false,
  settings: { ...AISettings.get(), provider: "openai", offlineMode: true },
  runtimeConfig: runtimeConfig("openai", { openai: true }),
});
assert.equal(offline.provider, "local");
assert.equal(offline.mode, "offline-canonical");
console.log("PASS: explicit Offline Canonical activation");

// Real production-provider question execution cannot contain mock/sample/template wording.
const productionController = new AIController({
  openaiProvider: new RuntimeProvider("openai", {
    ok: true,
    model: "openai-live-test",
    content: "Jawaban berdasarkan konteks Alkitab yang tersedia dan telah melalui validasi kanonik.",
  }),
});
await activateRuntimeProvider(productionController, {
  force: true,
  development: false,
  settings: { ...AISettings.get(), provider: "openai", model: "openai-live-test", offlineMode: false },
  runtimeConfig: runtimeConfig("openai", { openai: true }),
});
for (const question of [
  "Apa itu dosa?",
  "Ciri-ciri orang fasik?",
  "Mengapa takut akan Tuhan?",
  "Apa pelajaran utama Amsal 2?",
]) {
  const response = await productionController.execute("qa", {
    question,
    chapter: 2,
    cache: false,
    persist: false,
    settings: {
      provider: "openai",
      model: "openai-live-test",
      streaming: false,
      offlineMode: false,
    },
  });
  assert.equal(response.provider, "openai");
  assert.doesNotMatch(response.content, /Jawaban contoh|Sample|Mock|Template/i);
}
console.log("PASS: production real-question output has no sample/mock/template text");

// Public status API exposes all required diagnostics fields.
const status = await AIService.getProviderStatus();
for (const field of [
  "provider",
  "model",
  "mode",
  "healthy",
  "reason",
  "latency",
  "streaming",
  "offline",
  "timestamp",
  "retryCount",
  "fallbackCount",
  "configuredProvider",
  "environmentLoaded",
  "apiStatus",
]) {
  assert.ok(field in status, `provider status must expose ${field}`);
}
assert.deepEqual(status, getRuntimeProviderStatus());
console.log("PASS: AIService.getProviderStatus runtime diagnostics");

const diagnosticsUi = await readFile(
  new URL("../js/ui/ai-diagnostics.js", import.meta.url),
  "utf8",
);
for (const label of [
  "Current Provider",
  "Configured Provider",
  "Provider Health",
  "Current Model",
  "API Status",
  "Environment Loaded",
  "Reason for Fallback",
  "Current Mode",
]) {
  assert.match(diagnosticsUi, new RegExp(label));
}
assert.doesNotMatch(diagnosticsUi, /OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY/);
console.log("PASS: AI Diagnostics exposes safe runtime fields");

AISettings.reset();
console.log("VALID: Phase 006B.1 activation, production mock restriction, offline fallback, refresh, and diagnostics.");
