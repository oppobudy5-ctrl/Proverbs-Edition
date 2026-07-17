# Phase 006B — Production AI Provider Integration

## 1. Architecture

```
UI
 ↓
AIService (unchanged API)
 ↓
Biblical Reasoning Engine / AI Controller (Gateway)
 ↓
Provider Selector (configured → healthy → mock)
 ↓
Provider Adapter (OpenAI | Gemini | Claude | Azure | Ollama | Mock)
 ↓
Server Proxy /api/ai/*   ← API keys live only here
 ↓
Canonical Validation → Formatter → Renderer
```

UI, Reasoning Engine, and Bible Companion never import a concrete provider.
They only talk to `AIService` → Gateway → interchangeable adapters.

## 2. Provider Adapter

Shared interface (`ProviderBase` / `ProxyProviderBase`):

| Method | Purpose |
| --- | --- |
| `sendPrompt(request, options)` | Non-stream completion |
| `stream(request, options)` | Token stream (SSE / native / chunk fallback) |
| `healthCheck(options)` | Reachability + auth + model + latency |
| `embeddings(input)` | Optional vector support |
| `capabilities` | `{ prompt, streaming, embeddings, … }` |

Registered adapters:

- `mock` — deterministic offline provider
- `openai` — via `/api/ai/openai`
- `gemini` — via `/api/ai/gemini`
- `claude` — Anthropic via `/api/ai/claude` (alias: `anthropic`)
- `azure` — Azure OpenAI via `/api/ai/azure`
- `ollama` — local HTTP (`OLLAMA_BASE_URL`)

## 3. Configuration

Client defaults: `config/ai.config.js`  
User preferences: `AISettings` (`provider`, `model`, `streaming`, `temperature`, `maxTokens`, `offlineMode`, `debugMode`)  
Server secrets: environment variables only (never in the browser bundle).

## 4. Environment Variables

See `.env.example`.

| Variable | Role |
| --- | --- |
| `AI_PROVIDER` | Default provider id |
| `AI_FAILOVER_ORDER` | Comma-separated failover chain |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Claude |
| `AZURE_OPENAI_KEY` / `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_DEPLOYMENT` | Azure |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | Local Ollama |
| `AI_TEMPERATURE` / `AI_MAX_TOKENS` / `AI_STREAMING` / `AI_TIMEOUT_MS` / `AI_OFFLINE_MODE` | Runtime defaults |

## 5. Health Check

Every adapter returns:

```json
{
  "ok": true,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "reachable": true,
  "authentication": "ok",
  "modelExists": true,
  "latencyMs": 42,
  "status": "healthy",
  "healthTimestamp": "…"
}
```

Public endpoints (no secrets):

- `GET /api/ai/health`
- `GET /api/ai/config`
- `GET /api/ai/:provider` — per-provider health

## 6. Failover Strategy

1. Preferred / configured provider  
2. Remaining providers in `AI_FAILOVER_ORDER`  
3. `mock` (last resort)

Failover triggers: timeout, offline, 429 / rate limit, quota, 5xx, authentication / missing key.  
Cancelled requests never fail over.  
If every provider fails, the Gateway throws a safe error; Ask/Reasoning falls back to the **Offline Canonical Response** (Knowledge Bundle + CIL). Raw upstream errors are never shown.

## 7. Offline Strategy

Triggered when:

- `AISettings.offlineMode === true`
- no network / provider unreachable
- API key missing on the server proxy
- all production providers fail

Then:

Reasoning Engine → Knowledge Bundle → Canonical Context → Offline Answer  
(`provider: "local"` / `canonical_only`, or `mock` when the Gateway uses the mock adapter).

## 8. Streaming

If `streaming: true` and the adapter advertises `capabilities.streaming`:

- Proxy adapters prefer SSE from `/api/ai/*`, then fall back to non-stream chunking
- Ollama uses native NDJSON streaming, then falls back to non-stream

Guarded intents still buffer until canonical validation (unchanged).

## 9. Security

- API keys exist only in server env / Cloudflare secrets
- Browser calls same-origin `/api/ai/*` with `credentials: "same-origin"`
- Proxy redacts key-shaped substrings from error messages
- Public `/api/ai/config` never includes secrets
- System / internal prompts stay inside Prompt Builder — never returned to the client

## 10. Deployment Guide

### Local Development

```bash
cp .env.example .env
# fill OPENAI_API_KEY / GEMINI_API_KEY / … as needed
npm run dev
```

Set `AI_PROVIDER=openai` (or another configured provider) in `.env`, or pick the provider in **Pengaturan → AI Provider**.

### Production (generic Node host)

1. Export the same env vars in the process environment.  
2. Serve the static app and route `/api/ai/*` to `scripts/ai-proxy.mjs` (as the dev server does).  
3. Do **not** ship `.env` in the client build.

### Cloudflare Pages

1. Deploy the repo; Pages Functions pick up `functions/api/ai/[[path]].js`.  
2. In the Cloudflare dashboard, set secrets:
   - `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, …
   - `AI_PROVIDER=openai` (recommended for production)
3. Enable Node compatibility if your Pages project requires it for the shared proxy module.  
4. Confirm `GET /api/ai/health` reports `configured: true` for the chosen provider.

### Docker (optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
ENV PORT=8080
ENV AI_PROVIDER=openai
# Pass secrets at runtime: -e OPENAI_API_KEY=…
EXPOSE 8080
CMD ["node", "scripts/dev-server.mjs"]
```

Never bake API keys into the image.

### Switching providers

- Settings UI: Provider / Model / Streaming / Offline / Debug / Temperature  
- Or `AISettings.update({ provider: "gemini", model: "gemini-2.0-flash" })`  
- Or server `AI_PROVIDER` for the default on fresh clients

## Model Registry

Configurable catalogs live in `AI_MODEL_REGISTRY` (`config/ai.config.js`).  
Defaults come from `OPENAI_MODEL`, `GEMINI_MODEL`, etc. — models are never hard-coded inside adapters.
