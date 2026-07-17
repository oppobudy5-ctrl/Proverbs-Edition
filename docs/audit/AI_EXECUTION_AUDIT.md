# Phase 006A — End-to-End AI Execution Audit

Audit scope: verify that pressing **"Kirim pertanyaan"** (Ask This Chapter) runs
the real AI pipeline end-to-end — not a mock/sample/hardcoded UI response — and
that the same pipeline backs every other AI-facing feature.

No behaviour was changed. The only edits are **opt-in DEBUG logging** (off by
default) plus this report. The Bible Knowledge Base, Editorial Dataset,
Canonical Intelligence Layer, Biblical Reasoning Engine, AI Gateway, AI
Provider, and AI prompts were **not** modified.

---

## 1. UI Entry Point

| Feature | File | Entry call |
| --- | --- | --- |
| Ask This Chapter | `js/ui/ai-lesson-assist.js` | `AIService.ask(q, …)` |
| Ringkas AI | `js/ui/ai-lesson-assist.js` | `AIService.summarize(…)` |
| Jelaskan | `js/ui/ai-lesson-assist.js` | `AIService.reason(…)` |
| Wisdom Coach | `js/ui/ai-lesson-assist.js` | `AIService.wisdom(…)` |
| Bible Companion | `js/ui/bible-companion.js` | `AIService.companion(…)` |
| Review / Mentor | `js/ui/ai-reflection-panel.js` | `AIService.review` / `AIService.mentor` |
| Semantic Search | `js/ui/semantic-search-ui.js` | `AIService.semanticSearch(…)` |
| Plans | `js/ui/planning.js` | `AIService.plan(…)` |

No UI module imports a provider, prompt template, retrieval engine, or store
directly. All AI access is routed through the `AIService` facade.

## 2. Event Flow (Ask This Chapter)

`js/ui/ai-lesson-assist.js` → `openAskDialog()` builds a `<textarea>` and a
`"Kirim pertanyaan"` `<button>` whose `onclick` handler:

1. Trims the textarea value; empty input → toast, no call.
2. Disables the button, shows `aiLoading(…)`.
3. `await AIService.ask(q, { chapter, day, book, onToken })`.
4. Renders `extractAiText(result)` via `aiAnswerBlock` + `aiReasoningBasis`.
5. On error, renders `aiError(err.userMessage)`.

**Verified:** the button truly calls `AIService.ask()`; the rendered text is the
returned AI content, never a literal string.

## 3. AI Service

`src/ai/ai-service.js` → `AIService.ask()` / `AIService.reason()` both call
`runBiblicalReasoning(question, options)` and wrap the result in the standard
Phase 002 envelope (`wrapReasoningOutput`). No sample/short-circuit path exists.

## 4. Reasoning Engine → Gateway → Provider

`src/ai/reasoning/reasoning-engine.js` runs the full pipeline:

1. `analyzeBiblicalIntent(text)` — intent classification.
2. `buildReasoningContext(...)` — CIL canonical context + evidence projection
   (`src/ai/reasoning/reasoning-context.js`), which initialises the CIL and
   calls `canonicalContextGateway.buildCanonicalContext(...)`.
3. `buildThemePath(...)` — theme reasoning.
4. If `llmEnabled !== false` and context is richer than `metadata-only`:
   `execute("qa", …)` → `aiController.execute(...)`
   (`src/ai/ai-controller.js`) which is the **AI Gateway**:
   - `initCIL` → `gateway.buildCanonicalContext` → `promptBuilder.build`
   - cache lookup (`aiCache`)
   - `#runProvider(provider, …)` → active provider `sendPrompt` / `stream`
   - `gateway.validateResponse(...)` (theological guardrails + citations)
5. `validateCanonicalAnswer(...)` — canonical validation.
6. `formatReasoningOutput(...)` — standard output schema.

**Verified:** the gateway and a real provider are invoked for every eligible
question. The active provider is selected by `AISettings.get().provider`
(config default `mock`).

## 5. Provider

Registered in `src/ai/ai-controller.js`: `mock`, `openai`, `gemini`, `claude`,
`ollama`. The **default provider is `mock`** (`config/ai.config.js`) because no
cloud key is configured in this repository.

`MockProvider` (`src/ai/providers/mock-provider.js`) is a *deterministic offline
provider*, not a UI stub: it receives the fully-built prompt/context and returns
context-aware text through the same `sendPrompt`/`stream` interface as the cloud
providers. Switching `AISettings.provider` to `openai`/`gemini`/`claude`/`ollama`
(with a key/endpoint) routes through the identical pipeline with zero UI or
service changes.

## 6. Offline Flow

Two real (non-placeholder) offline paths exist:

- **Provider throws / times out** → `runBiblicalReasoning` catches the error,
  `validateCanonicalAnswer` runs against the canonical context, and
  `formatReasoningOutput` returns the **canonical fallback**
  (`theologicalGuardrails.buildSafeFallback(canonical)`) built from the
  Knowledge Bundle — a genuine, grounded answer with `provider: "local"`.
- **`llmEnabled: false` or `metadata-only` context** → the provider call is
  skipped and the same canonical fallback is used.

In all cases the answer is derived from Reasoning → Knowledge Bundle → Canonical
Context, never a hardcoded paragraph.

## 7. Renderer

`js/ui/ai-dialog.js`:
- `extractAiText(result)` reads `result.content || result.answer || result.text`.
- `aiAnswerBlock(label, text)` renders that text.
- `aiReasoningBasis(result)` renders themes/citations/crossrefs/validation from
  the response (evidence only — never prompts, keys, or chain-of-thought).

**Verified:** the renderer displays the AI response object. There is no
hardcoded/sample/dummy/template paragraph in any renderer.

## 8. Mock Response Found

Searched the repository for: `sample`, `mock`, `dummy`, `placeholder`,
`example`, `defaultAnswer`, `fake`, `staticAnswer`, `fallbackAnswer`,
`templateAnswer`, `responseExample`, `Lorem ipsum`.

| Location | Match | Verdict |
| --- | --- | --- |
| `src/ai/providers/mock-provider.js` | deterministic offline provider | **Legitimate** — real provider behind the gateway; out of scope to change (AI Provider is protected). |
| `js/ui/ai-lesson-assist.js` L175 | `placeholder: "Contoh: Apa arti…"` | **Legitimate** — input hint on an empty textarea (UX), not a response. |
| `js/ui/ai-lesson-assist.js` L91 | note: "Provider default bisa berupa contoh (mock)…" | **Legitimate** — honest disclosure to the user. |
| `js/ui/{journal-editor,semantic-search-ui,calendar,library,planning}.js` | `placeholder:` attributes | **Legitimate** — form field hints. |

**No mock/sample/dummy AI *response* is rendered by the UI.** The only "sample"
text originates from the `MockProvider` output itself, which is the configured
offline provider and is explicitly disclosed to the user.

## 9. Placeholder Removed

No development-only placeholder responses (`"Jawaban contoh…"` hardcoded in UI,
`"Sample response…"`, `"Lorem ipsum…"`) exist in UI or service code, so none
needed removal. Input-field placeholders and the mock-provider disclosure were
intentionally retained (functional UX / provider is protected scope).

## 10. Remaining Issues

- **Default provider is `mock`.** Answers read as "…contoh…" until a cloud
  provider key/endpoint is configured. This is expected for an offline-first
  build and is disclosed in the UI, but end-users may misread it as a stub.
- Cloud provider endpoints (`/api/ai/*`) require a backend proxy that is not part
  of this repository; without it, only `mock` and `ollama` (local) are usable.

## 11. Recommendations

1. When deploying, set `AISettings.provider` to a configured cloud/local provider
   so answers are model-generated; the pipeline needs no further changes.
2. Consider softening the `MockProvider` wording (e.g. "jawaban ringkas offline")
   in a future phase that is *allowed* to touch the provider, to avoid the
   "sample" reading. (Out of scope here — AI Provider is protected.)
3. Keep DEBUG MODE for field diagnostics (see below).

---

## DEBUG MODE (Phase 006A)

Opt-in, **off by default**, no effect on output. Enable with any of:

```js
localStorage.setItem("ai_debug", "true"); // browser
globalThis.__AI_DEBUG__ = true;           // runtime
// AI_DEBUG=true  (or AI_DEBUG=1)          // node / env var
```

Emitted stage markers (`src/ai/ai-utils.js` → `AIDebug`):

- Reasoning Engine: `Intent Detected`, `Context Loaded`, `Knowledge Bundle
  Loaded`, `Cross References Loaded`, `Provider Called/Returned/Failed/Skipped`,
  `Validation`, `Reasoning Completed`.
- Gateway (`ai-controller`): `Gateway Called`, `Provider Returned`,
  `Gateway Failed: <offline | timeout | rate limit | quota exceeded | provider
  API error | configuration>`.
- Renderer (`ai-lesson-assist`): `Response Rendered`.

Consolidated trace block (TASK 10 format):

```
[AI]
Intent: definition
Context: Amsal 2
Reasoning: Success
Gateway: Success
Provider: mock
Latency: 0.12s
Validation: insufficient_context
Rendering: Ready
```

When DEBUG is off, nothing is printed.

---

## Acceptance Criteria

| Criterion | Status |
| --- | --- |
| Button calls AI Service | ✅ `AIService.ask()` |
| Intent Analyzer called | ✅ `analyzeBiblicalIntent` |
| Context Builder called | ✅ `buildReasoningContext` → CIL gateway |
| Reasoning Engine called | ✅ `runBiblicalReasoning` |
| AI Gateway called | ✅ `aiController.execute` |
| Provider called (or Offline Engine) | ✅ provider `sendPrompt`/`stream` or canonical fallback |
| Response Formatter called | ✅ `formatReasoningOutput` |
| UI renders AI Response | ✅ `extractAiText` + `aiAnswerBlock` |
| No sample response in UI | ✅ |
| No hardcoded answer | ✅ |
| No placeholder response | ✅ (input placeholders retained) |
| Debug Log available | ✅ opt-in `AIDebug` |
