// =============================================================================
// store.js — Persistensi localStorage: progress/streak, preferensi versi, dan
// tata letak reader. Semua tanggal memakai waktu lokal (date-helper).
// =============================================================================
import { todayISO, shiftISO } from "./date-helper.js";
import {
  BIBLE_VERSIONS, COMPANION_VERSIONS, READER_LAYOUTS,
  DEFAULT_MAIN_VERSION, DEFAULT_SECONDARY_VERSION,
} from "./versions.js";
import {
  listKeys,
  readJSON,
  readValue,
  removeKey,
  writeJSON,
  writeValue,
} from "./safe-store.js";

const STORAGE_KEY = "bibleTime.proverbs.progress.v2";
const MAIN_VERSION_KEY = "bibleTime.mainVersion";
const SECONDARY_VERSION_KEY = "bibleTime.secondaryVersion";
const READER_LAYOUT_KEY = "bibleTime.readerLayout";
const BOOKMARKS_KEY = "bibleTime.proverbs.bookmarks.v2";
const LEGACY_NOTICE_KEY = "bibleTime.legacyBookmarkNotice.v2";
const DEFAULT_PROGRESS = Object.freeze({ done: {}, quiz: {}, lastVisit: null, streak: 0 });

// ---------------------------------------------------------------------------
// Progress & streak
// ---------------------------------------------------------------------------
export const Store = {
  load() {
    return normalizeProgress(readJSON(STORAGE_KEY, DEFAULT_PROGRESS));
  },
  save(s) {
    writeJSON(STORAGE_KEY, s);
  },
  clear() {
    removeKey(STORAGE_KEY);
  },
  markRead(day) {
    const s = this.load();
    s.done[day] = { at: new Date().toISOString() };
    this.bumpStreak(s);
    this.save(s);
    return s;
  },
  markQuiz(day, score, total) {
    const s = this.load();
    s.quiz[day] = { score, total, at: new Date().toISOString() };
    this.save(s);
    return s;
  },
  bumpStreak(s) {
    const today = todayISO();
    if (s.lastVisit === today) return;
    const yesterday = shiftISO(today, -1);
    s.streak = s.lastVisit === yesterday ? (s.streak || 0) + 1 : 1;
    s.lastVisit = today;
  },
};

// ---------------------------------------------------------------------------
// Bookmark Amsal + perlindungan data bookmark edisi lama.
// ---------------------------------------------------------------------------
export const Bookmarks = {
  load() {
    const value = readJSON(BOOKMARKS_KEY, []);
    return Array.isArray(value) ? value : [];
  },
  save(items) {
    writeJSON(BOOKMARKS_KEY, items);
  },
  has(day) {
    return this.load().some((item) => item && item.day === day && item.book === "Amsal");
  },
  add(day, chapter) {
    const items = this.load().filter((item) => item && item.book === "Amsal");
    if (!items.some((item) => item.day === day)) items.push({ day, book: "Amsal", chapter });
    this.save(items);
  },
  remove(day) {
    this.save(this.load().filter((item) => item && item.day !== day));
  },
};

// Hapus SELURUH data aplikasi (progress, preferensi, koleksi Phase 03).
// Menyisakan catatan legacy agar toast tidak muncul ulang.
// Juga membersihkan IndexedDB jurnal + cache/percakapan AI bila tersedia.
export async function clearAllData({ clearAi = true } = {}) {
  const keep = new Set([LEGACY_NOTICE_KEY]);
  listKeys()
    .filter((key) => key.startsWith("bibleTime.") && !keep.has(key))
    .forEach(removeKey);

  try {
    const { clearAllEntries } = await import("./journal/store.js");
    await clearAllEntries();
  } catch {
    /* jurnal belum siap */
  }

  if (clearAi) {
    try {
      const { conversationStore } = await import("../src/ai/conversation-store.js");
      const { aiCache } = await import("../src/ai/ai-cache.js");
      await conversationStore.clear?.();
      await aiCache.clear?.();
    } catch {
      /* AI store opsional */
    }
    try {
      if (globalThis.indexedDB) {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase("bibleTime.ai.v1");
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
      }
    } catch {
      /* noop */
    }
  }
}

export function consumeLegacyBookmarkNotice() {
  if (readValue(LEGACY_NOTICE_KEY)) return false;
  let found = false;
  for (const key of listKeys()) {
    if (!/bookmark/i.test(key)) continue;
    const value = readValue(key, "");
    if (/mazmur|psalm|sba\.mazmur/i.test(`${key} ${value}`)) {
      found = true;
      break;
    }
  }
  if (found) writeValue(LEGACY_NOTICE_KEY, "shown");
  return found;
}

// ---------------------------------------------------------------------------
// Preferensi versi Alkitab — utama & pendamping DISIMPAN TERPISAH.
// ---------------------------------------------------------------------------
export function getMainVersion() {
  const v = readValue(MAIN_VERSION_KEY);
  return BIBLE_VERSIONS.some((x) => x.code === v) ? v : DEFAULT_MAIN_VERSION;
}
export function setMainVersion(v) {
  if (BIBLE_VERSIONS.some((x) => x.code === v)) writeValue(MAIN_VERSION_KEY, v);
}

export function getSecondaryVersion() {
  const v = readValue(SECONDARY_VERSION_KEY);
  return COMPANION_VERSIONS.some((x) => x.code === v) ? v : DEFAULT_SECONDARY_VERSION;
}
export function setSecondaryVersion(v) {
  if (COMPANION_VERSIONS.some((x) => x.code === v)) writeValue(SECONDARY_VERSION_KEY, v);
}

// ---------------------------------------------------------------------------
// Tata letak reader
// ---------------------------------------------------------------------------
export function getReaderLayout() {
  return readValue(READER_LAYOUT_KEY) === "cols" ? "cols" : "interleave";
}
export function setReaderLayout(v) {
  if (READER_LAYOUTS.some((x) => x.id === v)) writeValue(READER_LAYOUT_KEY, v);
}

function normalizeProgress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { done: {}, quiz: {}, lastVisit: null, streak: 0 };
  }
  return {
    done: value.done && typeof value.done === "object" && !Array.isArray(value.done) ? value.done : {},
    quiz: value.quiz && typeof value.quiz === "object" && !Array.isArray(value.quiz) ? value.quiz : {},
    lastVisit: typeof value.lastVisit === "string" ? value.lastVisit : null,
    streak: Number.isFinite(Number(value.streak)) ? Number(value.streak) : 0,
  };
}
