// =============================================================================
// journal.js — Facade publik jurnal (kompatibel v3 + API v4).
// =============================================================================
import {
  bootstrapJournalSync,
  initJournalStore,
  listEntries,
  getPrimaryDayEntry,
  upsertDayReflection,
  removeEntriesByDay,
  removeEntry,
  entryCount,
  prayerItemCount,
  gratitudeCount,
  toLegacyFields,
  clearAllEntries,
  saveEntry,
  getEntry,
  toggleFavorite,
  importEntries,
} from "./journal/store.js";
import { GUIDED_PROMPTS } from "./journal/schema.js";

bootstrapJournalSync();

/** Field legacy 3-kolom — tetap diekspor untuk kompatibilitas. */
export const JOURNAL_FIELDS = [
  { id: "learned", label: "Apa yang Tuhan ajarkan hari ini?", placeholder: "Tuliskan satu kebenaran yang menyentuhmu\u2026" },
  { id: "decision", label: "Keputusan yang akan saya ambil", placeholder: "Satu langkah nyata sebagai respons\u2026" },
  { id: "prayer", label: "Pokok doa", placeholder: "Hal yang ingin kamu bawa dalam doa\u2026" },
];

export { GUIDED_PROMPTS, initJournalStore, listEntries, saveEntry, getEntry, toggleFavorite, clearAllEntries, importEntries, prayerItemCount, gratitudeCount };

export function getJournal(day) {
  const entry = getPrimaryDayEntry(day);
  return toLegacyFields(entry);
}

export function saveJournal(day, fields) {
  const saved = upsertDayReflection(day, fields);
  return saved ? toLegacyFields(saved) : null;
}

export function listJournal() {
  return listEntries({ sort: "dayAsc" }).map((e) => {
    const legacy = toLegacyFields(e);
    return { ...legacy, ...e, learned: legacy.learned, decision: legacy.decision, prayer: legacy.prayer };
  });
}

export function journalCount() {
  return entryCount();
}

export function removeJournal(day) {
  removeEntriesByDay(day);
}

export function removeJournalById(id) {
  return removeEntry(id);
}
