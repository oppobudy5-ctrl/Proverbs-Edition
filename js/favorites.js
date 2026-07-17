// =============================================================================
// favorites.js — Tanda favorit untuk ayat emas, renungan, dan tantangan.
// Disimpan lokal sebagai peta { "type:day": {...} }.
// =============================================================================
import { readJSON, writeJSON, emitChange } from "./safe-store.js";

const KEY = "bibleTime.favorites.v3";

export const FAVORITE_TYPES = {
  verse: { label: "Ayat", icon: "\u2728" },
  renungan: { label: "Renungan", icon: "\u{1F4DD}" },
  challenge: { label: "Tantangan", icon: "\u{1F3AF}" },
};

const keyOf = (type, day) => `${type}:${day}`;

export function listFavorites() {
  const map = readJSON(KEY, {});
  return Object.values(map).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

export function isFavorite(type, day) {
  return !!readJSON(KEY, {})[keyOf(type, day)];
}

export function toggleFavorite({ type, day, chapter, text }) {
  const map = readJSON(KEY, {});
  const k = keyOf(type, day);
  let on;
  if (map[k]) { delete map[k]; on = false; }
  else { map[k] = { type, day, chapter, text, at: new Date().toISOString() }; on = true; }
  writeJSON(KEY, map);
  emitChange("favorites", { type, day, on });
  return on;
}

export function removeFavorite(type, day) {
  const map = readJSON(KEY, {});
  delete map[keyOf(type, day)];
  writeJSON(KEY, map);
  emitChange("favorites", { type, day, on: false });
}

export function favoriteCount() {
  return Object.keys(readJSON(KEY, {})).length;
}
