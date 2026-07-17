# AI Review Engine & Bible Mentor

Phase 004 — Canonical Intelligence Layer

## 1. Overview

The AI Review Engine is a structured evaluation layer for user reflections and journal entries. It is **not** a general-purpose chatbot. It acts as a Bible Mentor: reviewing reflections, providing biblical context, practical applications, supporting verses, prayers, and pastoral encouragement.

```
Journal / Reflection
        │
        ▼
   AIService.review() / AIService.mentor()
        │
        ▼
   ReviewEngine (src/ai/review/review-engine.js)
        │
        ├── buildCanonicalContext  (one CIL call)
        │         │
        │         ├── themes (via topics)
        │         ├── goldenVerse → memory_verse
        │         ├── crossrefs
        │         ├── historical
        │         ├── wisdomPatterns
        │         ├── application
        │         ├── prayer / challenge
        │         └── citations / confidence
        │
        ├── [optional] AIController reflection intent  (LLM prose)
        │
        └── review-formatter.js → immutable ReviewOutput
                │
                ▼
           Journal AI Panel
```

## 2. Review Pipeline

Every review follows this sequence:

1. **Input Validation** — requires reflection text or a chapter/day target
2. **Context Analysis** — single `buildCanonicalContext` call
3. **Canonical Validation** — all output grounded in CIL/BKB data
4. **Cross Reference Search** — from `ctx.crossrefs`
5. **Theme Detection** — from `ctx.topics` (fallback: `application.invitation`)
6. **Historical Context** — from `ctx.historical`
7. **Application Generator** — from `ctx.application.practices`
8. **Prayer Generator** — from `ctx.prayer` (or challenge/reflection)
9. **Encouragement** — LLM prose if available; otherwise `ctx.challenge`
10. **Final Formatting** — immutable `ReviewOutput` via `review-formatter.js`

## 3. Canonical Validation

The Review Engine **never invents** biblical content. All structured fields are derived from the Canonical Intelligence Layer:

| Output field | CIL source |
|---|---|
| `themes` | `topics[].name` → `application.invitation` → `themes`/`theme` |
| `memory_verse` | `goldenVerse` |
| `cross_references` | `crossrefs` |
| `historical_context` | `historical[].summary` |
| `wisdom` | `wisdomPatterns[].summary` |
| `application` | `application.invitation` + `practices` |
| `prayer` | `prayer` or `reflection[0]` |
| `summary` | `summary` or `title` |
| `citations` | `citations` |
| `confidence` | `confidence` (0–100) |

LLM prose (when available) may enrich `strengths`, `missing_points`, `encouragement`, `next_step`, and `reflection_question`. If the provider fails, those fields fall back to canonical values and `canonical_only: true` is set.

## 4. Bible Mentor Flow

`AIService.mentor()` is the same Review Engine in `mode: "mentor"`. The LLM prompt emphasises pastoral guidance:

```
Summary → Review → Application → Prayer → Next Step → Reflection Question
```

In the Journal UI, the **Bible Mentor** button calls `AIService.mentor()` and renders the structured output using the same section renderer as Review AI.

## 5. Output Schema

```js
{
  summary: string,
  strengths: string[],
  missing_points: string[],
  application: string,
  memory_verse: { ref, text, translation } | null,
  cross_references: [{ source, target, reason, confidence }],
  historical_context: string,
  themes: string[],
  wisdom: string,
  encouragement: string,
  prayer: string,
  next_step: string,
  reflection_question: string,
  confidence: number,          // 0–100
  citations: object[],
  provider: string,            // "mock" | "local" | provider name
  timestamp: string,           // ISO 8601
  canonical_only: boolean,     // true when LLM was unavailable
}
```

Returned inside the Phase 002 AIService envelope:

```js
{
  success: true,
  status: "success",
  provider: "...",
  source: "review-engine",
  content: "<summary>",
  review: { /* ReviewOutput above */ },
  citations: [...],
  metadata: { method: "review"|"mentor", canonical_only, themes, confidence, durationMs },
  error: null,
  timestamp: "...",
}
```

## 6. Error Handling

| Scenario | Behaviour |
|---|---|
| No text and no chapter/day | Returns `{ success: false, error: { code: "INVALID_REQUEST" } }` |
| CIL unavailable / degraded | Returns minimal safe ReviewOutput (`canonical_only: true`) |
| LLM provider fails | Falls back to canonical-only ReviewOutput — no crash |
| Consent not granted | Handled by UI consent gate before calling AIService |

UI always receives a safe response. No exceptions propagate to the DOM layer.

## 7. Integration

### AIService

```js
import { AIService } from "./src/ai/ai-service.js";

const result = await AIService.review({
  text: "Renungan saya hari ini…",
  day: 1,
  chapter: 1,
  book: "Amsal",
  journalConsent: true,
});

if (result.success) {
  const { summary, strengths, memory_verse, prayer } = result.review;
}
```

```js
const mentor = await AIService.mentor({ chapter: 1, day: 1 });
```

### Journal UI

`js/ui/ai-reflection-panel.js` exposes three buttons after consent:

| Button | Method | Purpose |
|---|---|---|
| Bantu refleksi (AI) | `AIService.reflectJournal` | Free-form reflection assist |
| Review AI | `AIService.review` | Structured biblical review |
| Bible Mentor | `AIService.mentor` | Pastoral mentor guidance |

UI files import **only** `AIService`. No direct engine or CIL imports.

## 8. Future Enhancement

- Teach `AIController.execute` to accept a prebuilt `canonical` context (eliminates the second CIL call when LLM enrichment is requested).
- Dedicated Prayer Engine (currently derived from CIL `prayer` field; `AIService.prayer()` remains `NOT_IMPLEMENTED`).
- Multi-book support beyond Proverbs.
- Streaming progressive review sections to the UI.
- Persist anonymised review analytics (opt-in).
