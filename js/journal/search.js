// =============================================================================
// search.js — Pencarian lokal jurnal (< 100 ms untuk volume tipikal).
// =============================================================================
import { listEntries } from "./store.js";
import { entrySearchText } from "./schema.js";

export function searchJournal(query = "", filters = {}) {
  const q = String(query || "").trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  let results = listEntries({ sort: "updatedDesc" });

  if (filters.favorite === true) {
    results = results.filter((e) => e.favorite);
  }
  if (filters.type) {
    results = results.filter((e) => e.type === filters.type);
  }
  if (filters.day != null && filters.day !== "") {
    results = results.filter((e) => Number(e.day) === Number(filters.day));
  }
  if (filters.chapter != null && filters.chapter !== "") {
    results = results.filter((e) => Number(e.chapter) === Number(filters.chapter));
  }
  if (filters.book) {
    const book = String(filters.book).toLowerCase();
    results = results.filter((e) => String(e.book || "").toLowerCase() === book);
  }
  if (filters.verse) {
    const verse = String(filters.verse).toLowerCase();
    results = results.filter((e) => String(e.verse || "").toLowerCase().includes(verse));
  }
  if (filters.tag) {
    const tag = String(filters.tag).toLowerCase();
    results = results.filter((e) => (e.tags || []).some((t) => t.toLowerCase() === tag));
  }
  if (filters.from || filters.to) {
    results = results.filter((e) => {
      const d = (e.updatedAt || e.createdAt || "").slice(0, 10);
      if (filters.from && d < filters.from) return false;
      if (filters.to && d > filters.to) return false;
      return true;
    });
  }

  if (tokens.length) {
    results = results.filter((e) => {
      const hay = entrySearchText(e);
      return tokens.every((token) => hay.includes(token));
    });
  }

  return results;
}

export function listAllTags() {
  const counts = new Map();
  listEntries().forEach((e) => {
    (e.tags || []).forEach((tag) => {
      const key = tag.toLowerCase();
      const prev = counts.get(key) || { tag, count: 0 };
      prev.count += 1;
      counts.set(key, prev);
    });
  });
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
