// =============================================================================
// safe-store.js — Helper JSON/localStorage aman + event perubahan.
//
// Semua modul state Phase 03 memakai helper ini agar konsisten, tahan-error
// (quota/parse), dan dapat memancarkan event ringan saat data berubah sehingga
// UI bisa memperbarui diri tanpa framework.
// =============================================================================

export const DATA_SCHEMA_VERSION = 1;

export const VALIDATION_LIMITS = Object.freeze({
  maxJournalImportBytes: 2 * 1024 * 1024,
  maxJournalEntries: 2000,
  maxJournalFieldChars: 100_000,
  maxJournalTitleChars: 500,
  maxJournalTags: 50,
  maxJournalListItems: 100,
  maxJournalGuidedAnswers: 32,
  maxBookmarks: 500,
});

export function safeParse(raw, fallback = null) {
  if (typeof raw !== "string") return structuredCloneSafe(fallback);
  try {
    const value = JSON.parse(raw);
    return value === undefined ? structuredCloneSafe(fallback) : value;
  } catch {
    return structuredCloneSafe(fallback);
  }
}

export function safeStringify(value, fallback = null, space = 0) {
  try {
    const serialized = JSON.stringify(value, null, space);
    return typeof serialized === "string" ? serialized : fallback;
  } catch {
    return fallback;
  }
}

export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isValidDateString(value) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(text)) {
    return false;
  }
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return false;
  return text.includes("T") || new Date(parsed).toISOString().slice(0, 10) === text;
}

export function utf8ByteLength(value) {
  const text = String(value ?? "");
  if (typeof TextEncoder === "function") return new TextEncoder().encode(text).byteLength;
  // Fallback konservatif untuk browser lama.
  return unescape(encodeURIComponent(text)).length;
}

export function readJSON(key, fallback, { maxBytes = Infinity } = {}) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return structuredCloneSafe(fallback);
    if (Number.isFinite(maxBytes) && utf8ByteLength(raw) > maxBytes) {
      return structuredCloneSafe(fallback);
    }
    const value = safeParse(raw, fallback);
    return value == null ? structuredCloneSafe(fallback) : value;
  } catch {
    return structuredCloneSafe(fallback);
  }
}

export function writeJSON(key, value) {
  try {
    const serialized = safeStringify(value);
    if (serialized == null) return false;
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

// Nilai string mentah (preferensi versi/layout) harus tetap kompatibel dengan
// format penyimpanan lama, jadi tidak boleh dipaksa melewati JSON.stringify.
export function readValue(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeValue(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function listKeys() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key != null) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

function structuredCloneSafe(value) {
  if (value == null) return value;
  const serialized = safeStringify(value);
  return serialized == null ? value : safeParse(serialized, value);
}

// Bus event sederhana untuk sinkronisasi antar-view (mis. dashboard menyimak
// perubahan bookmark/journal/progress).
const bus = new EventTarget();

export function emitChange(topic, detail) {
  bus.dispatchEvent(new CustomEvent(topic, { detail }));
}

export function onChange(topic, handler) {
  bus.addEventListener(topic, handler);
  return () => bus.removeEventListener(topic, handler);
}

// UID pendek untuk item koleksi (bookmark/journal/favorite).
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
