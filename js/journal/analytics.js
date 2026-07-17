// =============================================================================
// analytics.js — Metrik fitur jurnal saja (tidak pernah isi teks jurnal).
// =============================================================================
import { readJSON, writeJSON } from "../safe-store.js";

const KEY = "bibleTime.journal.analytics.v1";

function load() {
  return readJSON(KEY, {
    saves: 0,
    exports: 0,
    imports: 0,
    aiAssists: 0,
    lastEventAt: null,
  });
}

function bump(field) {
  const data = load();
  data[field] = (data[field] || 0) + 1;
  data.lastEventAt = new Date().toISOString();
  writeJSON(KEY, data);
  return data;
}

export function recordJournalSave(_entry) {
  // Hanya hitung; jangan simpan body/tags isi.
  return bump("saves");
}

export function recordJournalExport() {
  return bump("exports");
}

export function recordJournalImport() {
  return bump("imports");
}

export function recordJournalAiAssist() {
  return bump("aiAssists");
}

export function getJournalAnalytics() {
  return load();
}

export function clearJournalAnalytics() {
  writeJSON(KEY, {
    saves: 0,
    exports: 0,
    imports: 0,
    aiAssists: 0,
    lastEventAt: null,
  });
}
