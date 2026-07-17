import { $, el } from "../dom.js";
import { announce } from "../a11y.js";
import { AIService } from "../../src/ai/ai-service.js";
import { aiError, aiLoading } from "./ai-dialog.js";

export function renderAiDiagnostics() {
  const output = el("div", {
    class: "ai-diagnostics-output",
    "aria-live": "polite",
    "aria-busy": "true",
  }, aiLoading("Memeriksa aktivasi provider…"));

  const refreshButton = el("button", {
    type: "button",
    class: "btn primary",
    onclick: () => void load(true),
  }, "Periksa ulang");

  const section = el("section", {
    class: "section day-section",
    "aria-labelledby": "ai-diagnostics-title",
  },
    el("div", { class: "hero" },
      el("div", { class: "hero-eyebrow" },
        el("span", { class: "dot" }),
        "Production Provider Runtime",
      ),
      el("h1", { id: "ai-diagnostics-title" }, "AI Diagnostics"),
      el("p", { class: "hero-sub" },
        "Status aktivasi, kesehatan provider, failover, dan mode offline. Tidak ada API key atau prompt internal yang ditampilkan.",
      ),
      el("div", { class: "journal-actions" }, refreshButton),
    ),
    output,
  );

  $("#app")?.append(section);
  void load(false);

  async function load(refresh) {
    refreshButton.disabled = true;
    output.setAttribute("aria-busy", "true");
    output.replaceChildren(aiLoading(refresh ? "Menjalankan health check…" : "Memuat status runtime…"));
    try {
      let status = await AIService.getProviderStatus();
      if (refresh || status.mode === "initializing") {
        status = await AIService.getProviderStatus({ refresh: true });
      }
      output.replaceChildren(...renderStatus(status));
      announce(`AI ${displayMode(status.mode)}: ${displayProvider(status)}`);
    } catch (error) {
      output.replaceChildren(aiError(error?.userMessage || error?.message || "Status provider tidak dapat dimuat."));
    } finally {
      output.removeAttribute("aria-busy");
      refreshButton.disabled = false;
    }
  }
}

function renderStatus(status) {
  const active = el("article", { class: "reading companion-card" },
    el("div", { class: "eyebrow" }, "Runtime Status"),
    el("h2", {}, displayProvider(status)),
    statusGrid([
      ["Current Provider", status.provider || "Belum aktif"],
      ["Configured Provider", status.configuredProvider || "Tidak diketahui"],
      ["Current Model", status.model || "Tidak berlaku"],
      ["Current Mode", displayMode(status.mode)],
      ["Health", status.healthy ? "Healthy" : "Unhealthy"],
      ["API Status", status.apiStatus || "unknown"],
      ["Environment Loaded", status.environmentLoaded ? "Ya" : "Tidak"],
      ["Last Check", formatTimestamp(status.lastCheck || status.timestamp)],
    ]),
  );

  const telemetry = el("article", { class: "reading companion-card" },
    el("div", { class: "eyebrow" }, "Health Dashboard"),
    el("h2", {}, "Provider telemetry"),
    statusGrid([
      ["Latency", status.latency == null ? "n/a" : `${status.latency} ms`],
      ["Retry Count", String(status.retryCount || 0)],
      ["Fallback Count", String(status.fallbackCount || 0)],
      ["Streaming", status.streaming ? "Aktif" : "Nonaktif"],
      ["Offline", status.offline ? "Ya" : "Tidak"],
      ["Fallback", status.fallback ? "Ya" : "Tidak"],
      ["Tokens", formatTokens(status.tokens)],
      ["Reason for Fallback", status.reason || "Tidak ada"],
    ]),
  );

  const healthEntries = Object.entries(status.health || {});
  const providers = el("article", { class: "reading companion-card" },
    el("div", { class: "eyebrow" }, "Provider Health"),
    el("h2", {}, "Registry checks"),
    healthEntries.length
      ? el("div", { class: "ai-health-list" },
          ...healthEntries.map(([id, health]) => providerHealth(id, health)),
        )
      : el("p", { class: "ai-assist-note" }, "Health check provider belum dijalankan."),
  );

  return [active, telemetry, providers];
}

function providerHealth(id, health = {}) {
  return el("div", { class: "reader-note" },
    el("strong", {}, `${providerName(id)} · ${health.ok ? "Healthy" : "Unavailable"}`),
    el("p", {},
      [
        health.model || null,
        health.latencyMs == null ? null : `${health.latencyMs} ms`,
        health.authentication ? `auth: ${health.authentication}` : null,
        health.modelExists === false ? "model tidak tersedia" : null,
      ].filter(Boolean).join(" · "),
    ),
    !health.ok
      ? el("p", { class: "ai-assist-note" }, health.reason || health.status || "Health check gagal.")
      : null,
  );
}

function statusGrid(rows) {
  return el("dl", { class: "companion-meta-grid" },
    ...rows.flatMap(([label, value]) => [
      el("dt", {}, label),
      el("dd", {}, value),
    ]),
  );
}

function displayProvider(status) {
  if (status.mode === "offline-canonical" || status.provider === "local") return "Offline Canonical";
  if (status.mode === "development-mock" || status.provider === "mock") return "Development Mock";
  return `${providerName(status.provider)}${status.model ? ` · ${status.model}` : ""}`;
}

function providerName(id) {
  if (id === "openai") return "OpenAI";
  if (id === "gemini") return "Gemini";
  if (id === "ollama") return "Ollama";
  if (id === "claude") return "Anthropic";
  if (id === "azure") return "Azure OpenAI";
  if (id === "mock") return "Development Mock";
  return id || "Unknown";
}

function displayMode(mode) {
  if (mode === "production") return "Production";
  if (mode === "development-mock") return "Development Mock";
  if (mode === "offline-canonical") return "Offline Canonical";
  return "Initializing";
}

function formatTimestamp(value) {
  if (!value) return "Belum diperiksa";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("id-ID");
}

function formatTokens(tokens) {
  if (!tokens) return "n/a";
  const prompt = tokens.promptTokens ?? tokens.input_tokens ?? null;
  const completion = tokens.completionTokens ?? tokens.output_tokens ?? null;
  if (prompt == null && completion == null) return "tersedia";
  return `input ${prompt ?? "n/a"} · output ${completion ?? "n/a"}`;
}
