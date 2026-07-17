// =============================================================================
// store.js — CRUD jurnal v4: memory cache + localStorage mirror + IndexedDB.
// IndexedDB adalah sumber durable; LS adalah mirror cepat untuk UI sync.
// =============================================================================
import { readJSON, writeJSON, removeKey, emitChange, uid } from "../safe-store.js";
import {
  createEntry,
  normalizeEntry,
  migrateV3Map,
  isEmptyEntry,
  toLegacyFields,
} from "./schema.js";
import { idbGetAll, idbPut, idbPutAll, idbDelete, idbClear } from "./idb.js";
import { JournalCrypto } from "./crypto.js";
import { recordJournalSave } from "./analytics.js";

export const LS_KEY_V4 = "bibleTime.journal.v4";
export const LS_KEY_V3 = "bibleTime.journal.v3";
export const META_KEY = "bibleTime.journal.meta.v4";

/** @type {Map<string, object>} */
const cache = new Map();
let ready = false;
let reconciled = false;
let reconcilePromise = null;

export function isJournalReady() {
  return ready;
}

export function isJournalReconciled() {
  return reconciled;
}

/**
 * Rekonsiliasi durable store (IndexedDB) dengan mirror LS.
 * Selalu boleh dipanggil meski bootstrap sync sudah menandai ready.
 */
export async function initJournalStore() {
  if (reconciled) return getSnapshot();
  if (reconcilePromise) return reconcilePromise;

  reconcilePromise = (async () => {
    ensureBoot();

    const fromIdbRaw = await idbGetAll();
    const fromIdb = Array.isArray(fromIdbRaw) && fromIdbRaw.length
      ? (await JournalCrypto.unwrapEntries(fromIdbRaw)).map(normalizeEntry)
      : [];

    const lsV4 = readJSON(LS_KEY_V4, null);
    const fromLs = lsV4 && typeof lsV4 === "object" && Array.isArray(lsV4.entries)
      ? lsV4.entries.map(normalizeEntry)
      : [];

    // Prioritas durable: jika IDB punya data, merge dengan LS (menang updatedAt lebih baru).
    if (fromIdb.length) {
      replaceCache(mergeEntriesByUpdatedAt(fromIdb, fromLs.length ? fromLs : [...cache.values()]));
      mirrorLocalStorage();
      await idbPutAll([...cache.values()]);
    } else if (cache.size || fromLs.length) {
      // IDB kosong — seed dari cache/LS, lalu tulis ke IDB.
      if (!cache.size && fromLs.length) replaceCache(fromLs);
      if (cache.size) await idbPutAll([...cache.values()]);
    } else {
      // Keduanya kosong — coba migrasi v3.
      const v3 = readJSON(LS_KEY_V3, null);
      if (v3 && typeof v3 === "object" && Object.keys(v3).length) {
        const migrated = migrateV3Map(v3);
        replaceCache(migrated);
        mirrorLocalStorage();
        await idbPutAll([...cache.values()]);
        writeJSON(META_KEY, { migratedFromV3At: new Date().toISOString(), count: migrated.length });
        removeKey(LS_KEY_V3);
      }
    }

    reconciled = true;
    ready = true;
    return getSnapshot();
  })();

  try {
    return await reconcilePromise;
  } finally {
    reconcilePromise = null;
  }
}

/**
 * Bootstrap sync untuk UI/tests: hydrate dari LS/v3 segera,
 * lalu selalu kick off rekonsiliasi IDB (tidak di-block oleh ready).
 */
export function bootstrapJournalSync() {
  if (!ready) {
    const lsV4 = readJSON(LS_KEY_V4, null);
    if (lsV4 && typeof lsV4 === "object" && Array.isArray(lsV4.entries) && lsV4.entries.length) {
      replaceCache(lsV4.entries.map(normalizeEntry));
      ready = true;
    } else {
      const v3 = readJSON(LS_KEY_V3, null);
      if (v3 && typeof v3 === "object" && Object.keys(v3).length) {
        const migrated = migrateV3Map(v3);
        replaceCache(migrated);
        mirrorLocalStorage();
        removeKey(LS_KEY_V3);
        writeJSON(META_KEY, { migratedFromV3At: new Date().toISOString(), count: migrated.length });
        ready = true;
      } else if (lsV4 && typeof lsV4 === "object" && Array.isArray(lsV4.entries)) {
        // Mirror kosong: jangan blokir recovery IDB — biarkan reconcile mengisi.
        replaceCache([]);
        ready = true;
      } else {
        ready = true;
      }
    }
  }

  // Selalu rekonsiliasi IDB; early-return hanya jika sudah reconciled.
  initJournalStore().catch(() => {});
  return getSnapshot();
}

export function getSnapshot() {
  return [...cache.values()].map((e) => ({
    ...e,
    prayer: { ...e.prayer },
    tags: [...e.tags],
    guidedAnswers: { ...e.guidedAnswers },
  }));
}

export function listEntries({ sort = "updatedDesc" } = {}) {
  ensureBoot();
  const list = getSnapshot();
  if (sort === "dayAsc") {
    return list.sort((a, b) => (a.day || 0) - (b.day || 0) || a.updatedAt.localeCompare(b.updatedAt));
  }
  if (sort === "createdDesc") return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getEntry(id) {
  ensureBoot();
  const entry = cache.get(id);
  return entry ? normalizeEntry(entry) : null;
}

export function getEntriesByDay(day) {
  ensureBoot();
  const d = Number(day);
  return listEntries({ sort: "updatedDesc" }).filter((e) => Number(e.day) === d);
}

export function getPrimaryDayEntry(day) {
  const items = getEntriesByDay(day);
  if (!items.length) return null;
  return items.find((e) => e.type === "reflection") || items[0];
}

export function saveEntry(partial) {
  ensureBoot();
  const existing = partial.id ? cache.get(partial.id) : null;
  const base = existing
    ? createEntry({ ...existing, ...partial, id: existing.id, createdAt: existing.createdAt })
    : createEntry(partial);
  base.updatedAt = new Date().toISOString();

  if (isEmptyEntry(base)) {
    if (existing) removeEntry(existing.id);
    return null;
  }

  cache.set(base.id, base);
  persistEntry(base);
  emitChange("journal", { id: base.id, day: base.day });
  recordJournalSave(base);
  return normalizeEntry(base);
}

export function upsertDayReflection(day, fields = {}) {
  ensureBoot();
  const d = Number(day);
  const existing = getPrimaryDayEntry(d);
  const prayerText = String(fields.prayer || "").trim();
  return saveEntry({
    id: existing?.id,
    day: d,
    book: "Amsal",
    chapter: d,
    type: "reflection",
    body: fields.learned ?? fields.body ?? existing?.body ?? "",
    actionPlan: fields.decision ?? fields.actionPlan ?? existing?.actionPlan ?? "",
    prayer: prayerText
      ? {
        requests: [prayerText],
        thanks: existing?.prayer?.thanks || [],
        answered: existing?.prayer?.answered || [],
        waiting: existing?.prayer?.waiting || [],
      }
      : (fields.prayerObj || existing?.prayer),
    title: fields.title ?? existing?.title ?? "",
    gratitude: fields.gratitude ?? existing?.gratitude ?? "",
    tags: fields.tags ?? existing?.tags ?? [],
    mood: fields.mood ?? existing?.mood ?? "",
    favorite: fields.favorite ?? existing?.favorite ?? false,
    guidedAnswers: fields.guidedAnswers ?? existing?.guidedAnswers ?? {},
    createdAt: existing?.createdAt,
  });
}

export function removeEntry(id) {
  ensureBoot();
  const existing = cache.get(id);
  if (!existing) return false;
  cache.delete(id);
  mirrorLocalStorage();
  idbDelete(id).catch(() => {});
  emitChange("journal", { id, day: existing.day, removed: true });
  return true;
}

export function removeEntriesByDay(day) {
  ensureBoot();
  const d = Number(day);
  const ids = [...cache.values()].filter((e) => Number(e.day) === d).map((e) => e.id);
  ids.forEach((id) => removeEntry(id));
  return ids.length;
}

export function toggleFavorite(id) {
  const entry = getEntry(id);
  if (!entry) return null;
  return saveEntry({ ...entry, favorite: !entry.favorite });
}

export function entryCount() {
  ensureBoot();
  return cache.size;
}

export function prayerItemCount() {
  ensureBoot();
  let n = 0;
  cache.forEach((e) => {
    const p = e.prayer || {};
    n += (p.requests?.length || 0) + (p.thanks?.length || 0) + (p.answered?.length || 0) + (p.waiting?.length || 0);
  });
  return n;
}

export function gratitudeCount() {
  ensureBoot();
  let n = 0;
  cache.forEach((e) => {
    if (e.type === "gratitude" || (e.gratitude && e.gratitude.trim())) n += 1;
  });
  return n;
}

export async function clearAllEntries() {
  cache.clear();
  mirrorLocalStorage();
  removeKey(LS_KEY_V3);
  await idbClear();
  emitChange("journal", { cleared: true });
}

export async function importEntries(entries, { merge = true } = {}) {
  ensureBoot();
  const list = Array.isArray(entries) ? entries.map(normalizeEntry) : [];
  if (!merge) {
    cache.clear();
    await idbClear();
  }
  list.forEach((entry) => {
    if (!entry.id) entry.id = uid();
    if (isEmptyEntry(entry)) return;
    cache.set(entry.id, entry);
  });
  mirrorLocalStorage();
  await idbPutAll([...cache.values()]);
  emitChange("journal", { imported: list.length });
  return list.length;
}

function ensureBoot() {
  if (!ready) bootstrapJournalSync();
}

function replaceCache(entries) {
  cache.clear();
  (entries || []).forEach((entry) => {
    const n = normalizeEntry(entry);
    cache.set(n.id, n);
  });
}

function mergeEntriesByUpdatedAt(primary, secondary) {
  const map = new Map();
  [...primary, ...secondary].forEach((raw) => {
    const entry = normalizeEntry(raw);
    const prev = map.get(entry.id);
    if (!prev || String(entry.updatedAt || "") >= String(prev.updatedAt || "")) {
      map.set(entry.id, entry);
    }
  });
  return [...map.values()];
}

function mirrorLocalStorage() {
  writeJSON(LS_KEY_V4, {
    version: 4,
    updatedAt: new Date().toISOString(),
    entries: [...cache.values()],
  });
}

function persistEntry(entry) {
  mirrorLocalStorage();
  idbPut(entry).catch(() => {});
}

// Legacy helpers used by facade
export { toLegacyFields };
