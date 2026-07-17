// =============================================================================
// bookmark.js — Bookmark kaya: pasal / renungan / ayat emas.
// Mendukung nama opsional, kategori, tanggal dibuat, edit, dan hapus.
// =============================================================================
import { readJSON, writeJSON, emitChange, uid } from "./safe-store.js";

const KEY = "bibleTime.bookmarks.v3";
const LEGACY_KEY = "bibleTime.proverbs.bookmarks.v2";

export const BOOKMARK_TYPES = {
  chapter: { label: "Pasal", icon: "\u{1F4D6}" },
  renungan: { label: "Renungan", icon: "\u{1F4DD}" },
  verse: { label: "Ayat Emas", icon: "\u2728" },
};

export const BOOKMARK_CATEGORIES = ["Umum", "Doa", "Studi", "Pengingat"];

let migrated = false;
function migrateLegacy(list) {
  if (migrated) return list;
  migrated = true;
  const legacy = readJSON(LEGACY_KEY, []);
  if (Array.isArray(legacy) && legacy.length && !list.length) {
    legacy.forEach((item) => {
      if (item && item.book === "Amsal" && item.day) {
        list.push({
          id: uid(), day: item.day, chapter: item.chapter || item.day,
          type: "chapter", name: "", category: "Umum",
          text: `Amsal ${item.chapter || item.day}`, createdAt: new Date().toISOString(),
        });
      }
    });
    if (list.length) writeJSON(KEY, list);
  }
  return list;
}

export function listBookmarks() {
  return migrateLegacy(readJSON(KEY, []));
}

export function bookmarkFor(day, type) {
  return listBookmarks().find((b) => b.day === day && b.type === type) || null;
}

export function isBookmarked(day, type) {
  return !!bookmarkFor(day, type);
}

export function addBookmark({ day, chapter, type = "chapter", name = "", category = "Umum", text = "" }) {
  const list = listBookmarks();
  const entry = { id: uid(), day, chapter, type, name, category, text, createdAt: new Date().toISOString() };
  list.push(entry);
  writeJSON(KEY, list);
  emitChange("bookmarks", { action: "add", entry });
  return entry;
}

export function updateBookmark(id, patch) {
  const list = listBookmarks();
  const item = list.find((b) => b.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  writeJSON(KEY, list);
  emitChange("bookmarks", { action: "update", entry: item });
  return item;
}

export function removeBookmark(id) {
  const list = listBookmarks().filter((b) => b.id !== id);
  writeJSON(KEY, list);
  emitChange("bookmarks", { action: "remove", id });
}

// Toggle cepat berbasis (day, type). Mengembalikan boolean status baru.
export function toggleBookmark(payload) {
  const existing = bookmarkFor(payload.day, payload.type);
  if (existing) { removeBookmark(existing.id); return false; }
  addBookmark(payload);
  return true;
}
