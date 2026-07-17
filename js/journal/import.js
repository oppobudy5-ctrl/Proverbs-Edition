// =============================================================================
// import.js — Impor hasil ekspor jurnal (JSON primer).
// =============================================================================
import { importEntries } from "./store.js";
import { normalizeEntry } from "./schema.js";
import { recordJournalImport } from "./analytics.js";

export function parseJournalImport(raw) {
  const text = typeof raw === "string" ? raw : String(raw || "");
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    return data.map(normalizeEntry);
  }
  if (data && Array.isArray(data.entries)) {
    return data.entries.map(normalizeEntry);
  }
  throw new Error("Format impor jurnal tidak dikenali");
}

export async function importJournalJSON(raw, options = {}) {
  const entries = parseJournalImport(raw);
  const count = await importEntries(entries, options);
  recordJournalImport();
  return { count, entries };
}
