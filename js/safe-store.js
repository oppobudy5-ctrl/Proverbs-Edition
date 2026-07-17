// =============================================================================
// safe-store.js — Helper localStorage aman (JSON) + event perubahan.
//
// Semua modul state Phase 03 memakai helper ini agar konsisten, tahan-error
// (quota/parse), dan dapat memancarkan event ringan saat data berubah sehingga
// UI bisa memperbarui diri tanpa framework.
// =============================================================================

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return structuredCloneSafe(fallback);
    const value = JSON.parse(raw);
    return value == null ? structuredCloneSafe(fallback) : value;
  } catch {
    return structuredCloneSafe(fallback);
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
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
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
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
