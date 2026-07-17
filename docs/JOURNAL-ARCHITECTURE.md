# Journal Architecture (AI-07)

Private, offline-first Reflection & Journal for Bible Time.

## Principles

- **Scripture first** — entries link to book/chapter/day when possible
- **User ownership** — all data stays on device by default
- **Privacy by default** — never send journal text to an LLM without explicit consent
- **Reflection before advice** — AI summarizes and asks; it does not invent the user’s story
- **Growth over time** — insights and timeline are descriptive, not judgmental

## Storage ladder (sync-ready)

```text
v3 localStorage (legacy day map)
  → migrate once
v4 memory cache + localStorage mirror (`bibleTime.journal.v4`)
  → IndexedDB `bibleTime.journal.v4` (primary durable; reconciled on boot)
  → future: Supabase / cloud backup (same DTO via repository boundary)
```

Boot path: `bootstrapJournalSync()` hydrates the UI from the localStorage mirror immediately, then `initJournalStore()` reconciles IndexedDB ↔ mirror (prefer newer `updatedAt`). Empty LS mirrors no longer block IDB recovery.

Encryption at rest is **stubbed** (`js/journal/crypto.js`) for a later phase. AI-07 privacy relies on local storage + consent.

## Entry shape (v4)

`id`, `createdAt`, `updatedAt`, `book`, `chapter`, `verse?`, `day?`, `type`, `title`, `body`, `prayer{requests,thanks,answered,waiting}`, `gratitude`, `tags`, `mood?`, `actionPlan?`, `favorite`, `guidedAnswers`

Types: `reflection` | `prayer` | `gratitude` | `milestone_note`

## Modules

| Path | Role |
|------|------|
| `js/journal/schema.js` | DTO + v3 migration |
| `js/journal/store.js` | CRUD + facade helpers |
| `js/journal/idb.js` | IndexedDB adapter |
| `js/journal/consent.js` | AI journal consent grant/revoke |
| `js/journal/search.js` | Local search/filters |
| `js/journal/tags.js` | Auto-suggest tags |
| `js/journal/insights.js` | Descriptive aggregates |
| `js/journal/timeline.js` | Growth timeline merge |
| `js/journal/export.js` / `import.js` | JSON / MD / TXT (+ print PDF) |
| `js/journal/analytics.js` | Feature counts only (never body text) |
| `js/ui/journal-editor.js` | Rich editor |
| `js/ui/ai-reflection-panel.js` | Consent + AI assist |
| `src/ai/prompts/journal-reflection.prompt.js` | Consent-gated prompt |

Public facade: `js/journal.js` (keeps `getJournal` / `saveJournal` / `listJournal` compatible).

## AI consent

Before any journal text reaches a provider:

1. UI shows consent copy from `JOURNAL_AI_CONSENT_COPY`
2. User grants → `bibleTime.journal.aiConsent.v1`
3. `AIService.reflectJournal(...)` refuses unless granted; uses `cache: false` and `persist: false`
4. CIL `CanonicalContextGateway` also requires **stored** consent (request flag alone is not enough); journal is never indexed into graph/search
5. Prompt provider metadata redacts `journalExcerpt`; revoke clears local AI cache/conversations
6. User may revoke anytime (Koleksi → Jurnal or Tentang)

`AIService.reflect({ day })` remains scripture-only and does **not** read the private journal.

See also [CIL-ARCHITECTURE.md](./CIL-ARCHITECTURE.md) for the canonical context path used by all AI intents.

## UI surfaces

- Day page journal box → rich editor + guided prompts + AI panel
- Koleksi → **Jurnal** (search, filters, export/import, delete)
- Koleksi → **Insight** / **Timeline**

## Verification

```bash
node scripts/test-journal.mjs
```

## Foundation for later phases

- AI-08 Bible Study Assistant — separate consent if journal is ever shared into study chat
- AI-09 Spiritual Growth Dashboard — reuse insights/timeline aggregates
- AI-10 Personalized Discipleship Journey — reuse tags, milestones, action plans
