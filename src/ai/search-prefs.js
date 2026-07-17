// =============================================================================
// search-prefs.js — Recent & favorite searches (localStorage, tanpa jurnal).
// =============================================================================

import { readJSON, writeJSON } from "../../js/safe-store.js";

const RECENT_KEY = "bibleTime.search.recent.v1";
const FAVORITE_KEY = "bibleTime.search.favorites.v1";
const MAX_RECENT = 10;

export function getRecentSearches() {
  const list = readJSON(RECENT_KEY, []);
  return Array.isArray(list) ? list.slice(0, MAX_RECENT) : [];
}

export function pushRecentSearch(query) {
  const q = String(query || "").trim();
  if (!q) return getRecentSearches();
  const next = [q, ...getRecentSearches().filter((item) => item !== q)].slice(0, MAX_RECENT);
  writeJSON(RECENT_KEY, next);
  return next;
}

export function getFavoriteSearches() {
  const list = readJSON(FAVORITE_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function toggleFavoriteSearch(query) {
  const q = String(query || "").trim();
  if (!q) return getFavoriteSearches();
  const current = getFavoriteSearches();
  const exists = current.includes(q);
  const next = exists ? current.filter((item) => item !== q) : [q, ...current].slice(0, 30);
  writeJSON(FAVORITE_KEY, next);
  return { favorites: next, favorited: !exists };
}

export function isFavoriteSearch(query) {
  return getFavoriteSearches().includes(String(query || "").trim());
}
