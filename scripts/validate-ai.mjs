import assert from "node:assert/strict";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = new EventTarget();

const { AILogger, AI_EVENTS } = await import("../src/ai/ai-utils.js");
AILogger.setMode("production");

const { aiController } = await import("../src/ai/ai-controller.js");
const { AIService } = await import("../src/ai/ai-service.js");
const { retrievalEngine } = await import("../src/ai/retrieval-engine.js");
const { contextBuilder } = await import("../src/ai/context-builder.js");
const { promptBuilder } = await import("../src/ai/prompt-builder.js");
const { semanticIndex } = await import("../src/ai/semantic-index.js");
const { AISettings } = await import("../src/ai/ai-settings.js");

assert.equal(aiController.listProviders().length, 5);
for (const provider of aiController.listProviders()) {
  for (const capability of ["prompt", "streaming", "embeddings"]) {
    assert.equal(typeof provider.capabilities[capability], "boolean");
  }
}

const chapter = await retrievalEngine.retrieve("", { chapter: 3, limit: 1 });
assert.equal(chapter[0].document.chapter, 3);
const keyword = await retrievalEngine.retrieve("kerendahan hati", { limit: 5 });
assert.ok(keyword.length > 0);

const { initCIL, canonicalContextGateway } = await import("../src/ai/cil/index.js");
await initCIL({});
const canonical = await canonicalContextGateway.buildCanonicalContext({ day: 1, chapter: 1, question: "Apa dasar hikmat?" });
const context = contextBuilder.build({ canonical, question: "Apa dasar hikmat?", retrieved: keyword });
assert.equal(context.book, "Amsal");
assert.equal(context.chapter, 1);
assert.ok(context.summary.length > 0);

const prompt = promptBuilder.build({
  intent: "qa",
  question: "Apa dasar hikmat?",
  context,
  canonical,
  settings: AISettings.get(),
});
assert.equal(prompt.messages.length, 2);
assert.equal(prompt.messages[0].role, "system");
assert.match(prompt.messages[1].content, /KONTEKS KANONIK/);

await semanticIndex.rebuild([
  { id: "one", title: "Takut akan Tuhan", theme: "hikmat", text: "permulaan pengetahuan" },
]);
const semantic = await semanticIndex.search("hikmat");
assert.equal(semantic[0].document.id, "one");

let started = false;
let finished = false;
const offStarted = AIService.events.on(AI_EVENTS.STARTED, () => { started = true; });
const offFinished = AIService.events.on(AI_EVENTS.FINISHED, () => { finished = true; });
let streamed = "";
const response = await AIService.ask("Apa dasar hikmat?", {
  day: 1,
  persist: false,
  cache: false,
  onToken: (token) => { streamed += token; },
});
offStarted();
offFinished();

assert.equal(response.provider, "mock");
assert.equal(response.success, true);
assert.equal(response.status, "success");
assert.equal(response.source, "ai-controller");
assert.equal(response.error, null);
assert.ok(response.timestamp);
assert.ok(response.content.length > 30);
assert.ok(response.citations);
assert.ok(Number.isFinite(response.confidence));
assert.ok(response.guardrails);
assert.equal(started, true);
assert.equal(finished, true);
// Guarded intents buffer streaming until validation — final content still delivered.
assert.ok(streamed.length > 0);
assert.equal(streamed, response.content);

const invalid = await AIService.ask("");
assert.equal(invalid.success, false);
assert.equal(invalid.error.code, "INVALID_REQUEST");
assert.ok(invalid.content);

const viaCil = await AIService.buildCanonicalContext({ chapter: 1 });
assert.equal(viaCil.degraded, false);
assert.ok(AIService.cil().gateway);

console.log("AI foundation validation passed.");

console.log("VALID: AI Foundation layers, providers, prompts, retrieval, events, and mock flow pass.");
