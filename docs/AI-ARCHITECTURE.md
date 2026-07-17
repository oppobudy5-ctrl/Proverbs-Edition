# Bible Time AI Foundation

Phase AI-01 provides an offline-first, provider-agnostic AI layer. **CI-01** adds the
[Canonical Intelligence Layer](./CIL-ARCHITECTURE.md) as the only runtime gateway to biblical knowledge.
It does not expose a complete chatbot. Future UI features must import only `src/ai/ai-service.js`.

Phase 002 standardizes that facade as the unified, safe service contract. See
[AI Service Layer](./AI-SERVICE-LAYER.md) for available methods, response
envelope, error handling, logging, and UI-boundary rules.

Phase 004 adds the [AI Review Engine & Bible Mentor](./ai/AI_REVIEW_ENGINE.md)
as a structured evaluation layer for reflections, exposed via
`AIService.review()` and `AIService.mentor()`.

Phase 005 adds the [Multi-Book Bible Companion](./ai/MULTI_BOOK_COMPANION.md),
the 66-book registry, book-aware CIL retrieval, canonical navigation, and
availability-safe offline responses through `AIService.companion()`.

## Layered architecture

```text
UI
  ↓ AIService.ask / summarize / search / reflect / reflectJournal / explain
    + buildCanonicalContext / semanticSearch (via CIL)
AI Controller
  ↓ orchestration, cache, events, cancellation, persistence
Canonical Context Gateway (CIL)
  ↓ engines → BKB data plane → CanonicalContext
Prompt Builder
  ↓ token-budgeted canonical context + cite-only policy
Provider Adapter
  ↓ common provider contract
LLM / Mock Provider
  ↓
Guardrails + Citation + Confidence
  ↓ validated AIResponse
```

The controller coordinates the layers; lower layers do not import UI code. Provider modules do not import application content or raw BKB.

## Public UI contract

```js
import { AIService } from "../src/ai/ai-service.js";

const response = await AIService.ask("Apa arti takut akan Tuhan?", {
  chapter: 1,
  onToken(token, fullText) {
    // Streaming-ready UI callback.
  },
  onFinish(result) {},
  onError(error) {},
});
```

Other public operations:

- `AIService.summarize({ chapter: 3 })`
- `AIService.search("perkataan yang bijaksana")`
- `AIService.reflect({ day: 7 })` — scripture-guided; does not read private journal
- `AIService.reflectJournal({ text, day, chapter })` — **requires** journal AI consent; see [JOURNAL-ARCHITECTURE.md](./JOURNAL-ARCHITECTURE.md)
- `AIService.explain("Jelaskan Amsal 3:5", { chapter: 3 })`
- `AIService.buildCanonicalContext({ chapter: 1 })`
- `AIService.cil()` — read-only engine facades
- `AIService.semanticSearch / suggestSearch / relatedSearch` — routed through CIL

Responses use the common `AIResponse` shape (CI-01 extensions included):

```js
{
  id, content, provider, model, cached,
  usage, metadata, createdAt,
  citations, confidence, confidenceComponents,
  guardrails: { status, checks, warnings, inventedRefs }
}
```

## Provider interface

All providers extend `ProviderBase` or implement the same methods:

```js
sendPrompt(request, options)  // Promise<{ content, model, usage, metadata }>
stream(request, options)      // AsyncIterable<string>
embeddings(input, options)    // Promise<number[][]>
healthCheck(options)          // Promise<{ ok, ... }>
```

Register a custom adapter through the controller composition boundary:

```js
import { aiController } from "../src/ai/ai-controller.js";
aiController.registerProvider("my-backend", myProvider);
```

The default provider is `mock`. It supports deterministic responses and simulated token streaming without an API key.

### Security boundary

`OpenAIProvider`, `GeminiProvider`, and `ClaudeProvider` call same-origin proxy endpoints configured in `config/ai.config.js`. They never accept, read, or persist API keys. The future Cloudflare Worker, Vercel Function, Supabase Edge Function, or other backend owns credentials and maps the neutral request to a vendor SDK.

Expected proxy request:

```json
{
  "provider": "openai",
  "model": "default",
  "messages": [{ "role": "system", "content": "..." }],
  "metadata": {},
  "options": {
    "temperature": 0.35,
    "maxTokens": 900,
    "responseLength": "medium",
    "language": "id",
    "stream": false
  }
}
```

Expected proxy response:

```json
{
  "content": "Jawaban...",
  "model": "provider-model",
  "usage": {},
  "metadata": {}
}
```

`OllamaProvider` is the only direct adapter and targets a user-controlled local Ollama endpoint. It stores no credential.

## Prompt flow

1. `AIService` selects an intent, never a vendor.
2. `AIController` loads non-secret preferences from `AISettings`.
3. `RetrievalEngine` ranks local Amsal documents.
4. `ContextBuilder` creates a frozen `AIContext`.
5. `PromptBuilder` selects a versioned template under `src/ai/prompts/`.
6. It combines system policy, local Bible context, user question, and metadata into standard messages.
7. The selected provider receives the same neutral request.

Prompts must never be embedded in UI modules. New prompt behavior should be added as a versioned prompt module and mapped in `prompt-builder.js`.

## Retrieval flow

The current engine uses deterministic local weighting:

- exact chapter/day
- title
- theme
- keyword
- golden verse
- summary

`SemanticIndex` already exposes:

```js
indexDocument(document)
search(query, options)
rebuild(documents)
clear()
```

Its current implementation is lexical preparation. AI-04 can replace it with embeddings/vector persistence without changing `RetrievalEngine` or `AIService`.

## Conversation flow

1. A request gets a `conversationId` (provided or generated).
2. A successful response is stored in IndexedDB database `bibleTime.ai.v1`.
3. Each record contains question, answer, timestamp, chapter, provider, conversation ID, and metadata.
4. `ConversationStore` supports list, get-by-conversation, remove-conversation, and clear.

Conversation data is never stored in Local Storage. Local Storage contains only non-secret AI preferences.

## Cache flow

`AICache` uses IndexedDB and a SHA-256 key (FNV-1a fallback) over:

- complete prompt
- chapter
- provider

Default TTL is seven days. Expired entries are ignored and removed. Cache failures never block an AI response.

## Events and streaming

Subscribe through `AIService.events`:

- `AI_STARTED`
- `AI_PROGRESS`
- `AI_FINISHED`
- `AI_ERROR`
- `AI_CANCELLED`

Every service method accepts `onToken`, `onFinish`, and `onError`. Providers with native streaming can yield tokens; non-streaming providers still produce one complete progress chunk. Cancellation is implemented inside `AIController` with `AbortController`.

## Error handling

All failures normalize to `AIError`:

- `PROVIDER_OFFLINE`
- `TIMEOUT`
- `RATE_LIMIT`
- `API_ERROR`
- `QUOTA_EXCEEDED`
- `CANCELLED`
- `INVALID_REQUEST`
- `UNKNOWN`

Each error has a stable code, developer message, friendly Indonesian `userMessage`, retry metadata, and optional HTTP status.

## Configuration and settings

Static defaults live in `config/ai.config.js`: provider, model aliases, endpoints, retries, timeout, context limit, cache TTL, language, and logging.

`AISettings` persists only:

- provider
- temperature
- max tokens
- streaming
- response length
- language

It intentionally ignores unknown fields, including API keys.

## Roadmap

- **AI-02 Smart Summary / Bible Insight:** use `AIService.summarize()` grounded in BKB.
- **AI-03 Semantic Search:** ontology + knowledge-graph ranking via `AIService.semanticSearch()` (vector embeddings later behind `SemanticIndex`).
- **AI-04 Ask This Chapter / Bible Q&A:** build UI around `AIService.ask()`, events, and conversation IDs.
- **AI-05 Wisdom Coach:** coaching flows on top of BKB retrieval + semantic search.
- **AI-05 Ask This Chapter:** pass the current day/chapter to `AIService.ask()`; no architecture change required.
- Add native streaming parsers to proxy adapters while preserving `ProviderBase.stream()`.
- Move proxy contracts into a deployed edge backend and add server-side authentication, quotas, and observability.
