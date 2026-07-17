// =============================================================================
// search-analytics.js — Analitik lokal Semantic Search (tanpa isi jurnal).
// Catat: query length, intent, topic, click, duration — bukan teks pribadi.
// =============================================================================

import { readJSON, writeJSON } from "../../js/safe-store.js";

const KEY = "bibleTime.search.analytics.v1";

export const SearchAnalytics = {
  recordSearch({ intent = null, topic = null, queryLength = 0, tookMs = 0, resultCount = 0 } = {}) {
    const state = load();
    state.searches += 1;
    state.totalMs += Number(tookMs) || 0;
    state.lastIntent = intent || null;
    state.lastTopic = topic || null;
    state.lastQueryLength = Number(queryLength) || 0;
    state.lastResultCount = Number(resultCount) || 0;
    if (intent) state.intents[intent] = (state.intents[intent] || 0) + 1;
    if (topic) state.topics[topic] = (state.topics[topic] || 0) + 1;
    writeJSON(KEY, state);
    return snapshot(state);
  },

  recordClick({ type = null } = {}) {
    const state = load();
    state.clicks += 1;
    if (type) state.clickTypes[type] = (state.clickTypes[type] || 0) + 1;
    writeJSON(KEY, state);
    return snapshot(state);
  },

  get() {
    return snapshot(load());
  },
};

function load() {
  const raw = readJSON(KEY, null);
  return {
    searches: Number(raw?.searches) || 0,
    clicks: Number(raw?.clicks) || 0,
    totalMs: Number(raw?.totalMs) || 0,
    lastIntent: raw?.lastIntent || null,
    lastTopic: raw?.lastTopic || null,
    lastQueryLength: Number(raw?.lastQueryLength) || 0,
    lastResultCount: Number(raw?.lastResultCount) || 0,
    intents: raw?.intents && typeof raw.intents === "object" ? { ...raw.intents } : {},
    topics: raw?.topics && typeof raw.topics === "object" ? { ...raw.topics } : {},
    clickTypes: raw?.clickTypes && typeof raw.clickTypes === "object" ? { ...raw.clickTypes } : {},
  };
}

function snapshot(state) {
  return Object.freeze({
    ...state,
    intents: Object.freeze({ ...state.intents }),
    topics: Object.freeze({ ...state.topics }),
    clickTypes: Object.freeze({ ...state.clickTypes }),
  });
}
