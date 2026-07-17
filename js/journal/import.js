// =============================================================================
// import.js — Impor hasil ekspor jurnal (JSON primer).
// =============================================================================
import { importEntries } from "./store.js";
import { validateJournalPayload } from "./schema.js";
import { recordJournalImport } from "./analytics.js";
import { VALIDATION_LIMITS, safeParse, utf8ByteLength } from "../safe-store.js";

export function parseJournalImport(raw) {
  const text = typeof raw === "string" ? raw : String(raw || "");
  if (text.length > VALIDATION_LIMITS.maxJournalImportBytes
    || utf8ByteLength(text) > VALIDATION_LIMITS.maxJournalImportBytes) {
    throw new Error("File jurnal terlalu besar untuk diimpor");
  }
  const invalid = Symbol("invalid-json");
  const data = safeParse(text, invalid);
  if (data === invalid) throw new Error("JSON jurnal rusak atau tidak valid");
  return validateJournalPayload(data).entries;
}

export async function importJournalJSON(raw, options = {}) {
  const entries = parseJournalImport(raw);
  const count = await importEntries(entries, options);
  recordJournalImport();
  return { count, entries };
}
