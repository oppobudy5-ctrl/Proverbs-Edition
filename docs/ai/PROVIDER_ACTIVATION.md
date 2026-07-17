# Phase 006B.1 — Production Provider Activation

## Architecture

Runtime activation sits inside the provider layer:

```text
Application startup
  → AIService.getProviderStatus({ refresh: true })
  → Provider registry
  → Runtime configuration (/api/ai/config)
  → Health checks
  → Active provider or Offline Canonical
  → Runtime diagnostics
```

The UI, Bible Companion, Biblical Reasoning Engine, Prompt Builder, CIL, and
validation contracts remain unchanged. They continue to call `AIService`.

## Activation Flow

1. `js/main.js` starts provider verification without blocking initial rendering.
2. Runtime configuration is loaded from same-origin `/api/ai/config`.
3. The configured provider is checked first.
4. Healthy configured failover providers are checked in order.
5. The first healthy provider becomes `ACTIVE`.
6. If no production provider is healthy, runtime mode becomes
   `offline-canonical`.
7. `mock` is considered only when runtime mode is `development` or `test`.

The active result is available through:

```js
const status = await AIService.getProviderStatus();
const refreshed = await AIService.getProviderStatus({ refresh: true });
```

## Health Check

Each checked provider reports:

- reachable
- authentication
- model existence
- latency
- status/reason
- health timestamp

The health result does not contain API keys, request prompts, or response
content.

## Runtime Status

`AIService.getProviderStatus()` returns:

- `provider`
- `configuredProvider`
- `model`
- `mode`
- `healthy`
- `reason`
- `latency`
- `streaming`
- `offline`
- `timestamp` / `lastCheck`
- `retryCount`
- `fallbackCount`
- `fallback`
- `tokens` (when available)
- `environmentLoaded`
- `apiStatus`
- per-provider `health`

Open **Pengaturan → Buka AI Diagnostics** or navigate to
`/ai-diagnostics` to view this status.

## Fallback Rules

### Production

```text
Configured production provider
  → configured healthy provider(s)
  → Offline Canonical
```

Production never silently activates `mock`. Missing keys, failed
authentication, unavailable models, timeouts, quota errors, and unreachable
providers are recorded in `reason`.

### Development

```text
Configured provider
  → healthy alternatives
  → Development Mock
```

Mock fallback is explicitly labelled `development-mock`.

### Explicit Offline

When `offlineMode` is enabled, provider calls are bypassed and the Reasoning
Engine returns a Knowledge Bundle/CIL-based canonical answer.

## Debug Output

With Debug AI enabled:

```text
[AI]
Provider: openai
Model: gpt-4o-mini
Mode: production
Reasoning: Ready
Gateway: Ready
Validation: Ready
Renderer: Ready
Latency: 412ms
Fallback: false
Reason: Configured provider is healthy.
Tokens: {"promptTokens":320,"completionTokens":180}
Streaming: true
```

Secrets, system prompts, internal prompts, and hidden reasoning are never
logged.

## Troubleshooting

### Offline Canonical appears in production

1. Open `/ai-diagnostics`.
2. Check `Configured Provider`, `Environment Loaded`, and provider health.
3. Verify the corresponding server secret:
   - OpenAI: `OPENAI_API_KEY`
   - Gemini: `GEMINI_API_KEY`
   - Anthropic: `ANTHROPIC_API_KEY`
   - Azure: `AZURE_OPENAI_KEY` + `AZURE_OPENAI_ENDPOINT`
4. Verify model name/deployment.
5. Run the health check again.

### Development Mock appears

This is valid only on localhost or with `AI_RUNTIME_MODE=development`.
Production should set:

```text
AI_RUNTIME_MODE=production
AI_PROVIDER=openai
```

### Ollama not reachable

Confirm Ollama is running, the selected model is installed, and
`OLLAMA_BASE_URL` points to the `/api/chat` endpoint.

## Production Checklist

- [ ] `AI_RUNTIME_MODE=production`
- [ ] `AI_PROVIDER` names a production provider
- [ ] Provider API key is stored as a server secret
- [ ] `/api/ai/config` returns no credentials
- [ ] `/api/ai/health` is reachable
- [ ] `/ai-diagnostics` shows `Production`
- [ ] Active provider/model are correct
- [ ] Test answer does not contain sample/mock/template wording
- [ ] Missing-key test ends in `Offline Canonical`, not mock
- [ ] Build, lint, and tests pass
