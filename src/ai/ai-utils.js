import { AI_CONFIG } from "../../config/ai.config.js";

export const AI_EVENTS = Object.freeze({
  STARTED: "AI_STARTED",
  PROGRESS: "AI_PROGRESS",
  FINISHED: "AI_FINISHED",
  ERROR: "AI_ERROR",
  CANCELLED: "AI_CANCELLED",
});

export const AI_ERROR_CODES = Object.freeze({
  PROVIDER_OFFLINE: "PROVIDER_OFFLINE",
  TIMEOUT: "TIMEOUT",
  RATE_LIMIT: "RATE_LIMIT",
  API_ERROR: "API_ERROR",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  CANCELLED: "CANCELLED",
  INVALID_REQUEST: "INVALID_REQUEST",
  UNKNOWN: "UNKNOWN",
});

const FRIENDLY_MESSAGES = Object.freeze({
  PROVIDER_OFFLINE: "Layanan AI sedang tidak dapat dijangkau. Coba lagi setelah koneksi tersedia.",
  TIMEOUT: "Jawaban AI membutuhkan waktu terlalu lama. Silakan coba kembali.",
  RATE_LIMIT: "Terlalu banyak permintaan dalam waktu singkat. Tunggu sebentar lalu coba lagi.",
  API_ERROR: "Layanan AI mengalami gangguan. Silakan coba kembali.",
  QUOTA_EXCEEDED: "Kuota layanan AI sedang habis. Pilih provider lain atau coba lagi nanti.",
  CANCELLED: "Permintaan AI dibatalkan.",
  INVALID_REQUEST: "Permintaan belum lengkap atau tidak valid.",
  UNKNOWN: "Terjadi kendala saat menyiapkan jawaban. Silakan coba kembali.",
});

export class AIError extends Error {
  constructor(code, message, options = {}) {
    const safeCode = AI_ERROR_CODES[code] ? code : AI_ERROR_CODES.UNKNOWN;
    super(message || FRIENDLY_MESSAGES[safeCode], { cause: options.cause });
    this.name = "AIError";
    this.code = safeCode;
    this.userMessage = options.userMessage || FRIENDLY_MESSAGES[safeCode];
    this.status = options.status || null;
    this.retryable = options.retryable ?? [AI_ERROR_CODES.TIMEOUT, AI_ERROR_CODES.RATE_LIMIT, AI_ERROR_CODES.PROVIDER_OFFLINE].includes(safeCode);
    this.details = options.details || null;
  }
}

class AIEventBus {
  #target = new EventTarget();

  on(eventName, handler) {
    this.#target.addEventListener(eventName, handler);
    return () => this.#target.removeEventListener(eventName, handler);
  }

  once(eventName, handler) {
    const wrapped = (event) => {
      this.#target.removeEventListener(eventName, wrapped);
      handler(event);
    };
    return this.on(eventName, wrapped);
  }

  emit(eventName, detail = {}) {
    this.#target.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

export const AIEvents = new AIEventBus();

export const AILogger = {
  mode: resolveLogMode(AI_CONFIG.logLevel),
  setMode(mode) { this.mode = mode === "production" ? "production" : "development"; },
  debug(...args) { if (this.mode === "development") console.debug("[BibleTime AI]", ...args); },
  info(...args) { if (this.mode === "development") console.info("[BibleTime AI]", ...args); },
  warn(...args) { if (this.mode === "development") console.warn("[BibleTime AI]", ...args); },
  error(...args) {
    if (this.mode === "development") console.error("[BibleTime AI]", ...args);
    else console.error("[BibleTime AI] request failed");
  },
};

function resolveLogMode(configured) {
  if (configured === "development" || configured === "production") return configured;
  const hostname = globalThis.location?.hostname || "";
  return hostname === "localhost" || hostname === "127.0.0.1" ? "development" : "production";
}

/**
 * Opt-in end-to-end execution tracer for the AI pipeline (Phase 006A).
 *
 * DEBUG MODE is OFF by default and never affects behaviour or output.
 * Enable it explicitly with any of:
 *   - browser:  localStorage.setItem("ai_debug", "true")
 *   - runtime:  globalThis.__AI_DEBUG__ = true
 *   - node:     AI_DEBUG=true / AI_DEBUG=1 (env var)
 *
 * It only prints canonical stage markers (intent, context, provider, latency,
 * validation) — never system prompts, API keys, or hidden chain-of-thought.
 */
export const AIDebug = {
  enabled() {
    if (globalThis.__AI_DEBUG__ === true) return true;
    if (globalThis.__AI_DEBUG__ === false) return false;
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("ai_debug") === "true") {
        return true;
      }
    } catch {
      /* localStorage may be unavailable (private mode / SSR) — ignore. */
    }
    const env = globalThis.process?.env || {};
    return env.AI_DEBUG === "true" || env.AI_DEBUG === "1";
  },

  log(stage, detail) {
    if (!this.enabled()) return;
    if (detail === undefined) console.log(`[AI] ${stage}`);
    else console.log(`[AI] ${stage}:`, detail);
  },

  /** Print the consolidated end-to-end trace block from TASK 10. */
  trace(fields = {}) {
    if (!this.enabled()) return;
    const lines = ["[AI]"];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null || value === "") continue;
      lines.push(`${key}: ${value}`);
    }
    console.log(lines.join("\n"));
  },
};

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function hashString(value) {
  const input = String(value);
  if (globalThis.crypto?.subtle && typeof TextEncoder !== "undefined") {
    const bytes = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    const cancel = () => {
      clearTimeout(timer);
      reject(new AIError(AI_ERROR_CODES.CANCELLED));
    };
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
  });
}

export async function withTimeout(operation, timeoutMs = AI_CONFIG.timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const forwardAbort = () => controller.abort("cancelled");
  if (externalSignal?.aborted) forwardAbort();
  else externalSignal?.addEventListener("abort", forwardAbort, { once: true });
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      const timeout = controller.signal.reason === "timeout";
      throw new AIError(timeout ? AI_ERROR_CODES.TIMEOUT : AI_ERROR_CODES.CANCELLED, null, { cause: error });
    }
    throw toAIError(error);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", forwardAbort);
  }
}

export async function withRetry(operation, options = {}) {
  const retry = { ...AI_CONFIG.retry, ...(options.retry || {}) };
  let lastError;
  for (let attempt = 0; attempt <= retry.attempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = toAIError(error);
      if (!lastError.retryable || attempt >= retry.attempts) throw lastError;
      const delay = Math.min(retry.maxDelayMs, retry.baseDelayMs * (2 ** attempt));
      await sleep(delay + Math.floor(Math.random() * 150), options.signal);
    }
  }
  throw lastError;
}

export function toAIError(error, response) {
  if (error instanceof AIError) return error;
  if (error?.name === "AbortError") return new AIError(AI_ERROR_CODES.CANCELLED, null, { cause: error });
  const status = response?.status || error?.status;
  if (status === 429) return new AIError(AI_ERROR_CODES.RATE_LIMIT, null, { cause: error, status });
  if (status === 402 || /quota|credit/i.test(error?.message || "")) {
    return new AIError(AI_ERROR_CODES.QUOTA_EXCEEDED, null, { cause: error, status, retryable: false });
  }
  if (status >= 500) return new AIError(AI_ERROR_CODES.API_ERROR, null, { cause: error, status });
  if (status >= 400) return new AIError(AI_ERROR_CODES.API_ERROR, null, { cause: error, status, retryable: false });
  if (error instanceof TypeError && /fetch|network|offline/i.test(error.message || "")) {
    return new AIError(AI_ERROR_CODES.PROVIDER_OFFLINE, null, { cause: error });
  }
  return new AIError(AI_ERROR_CODES.UNKNOWN, error?.message, { cause: error, status, retryable: false });
}

export function truncate(value, maxCharacters = AI_CONFIG.maxContextCharacters) {
  const text = String(value || "");
  return text.length > maxCharacters ? `${text.slice(0, Math.max(0, maxCharacters - 1))}…` : text;
}
