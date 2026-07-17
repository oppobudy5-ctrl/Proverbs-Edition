// =============================================================================
// schema.js — DTO jurnal v4 + migrasi dari v3 { learned, decision, prayer }.
// =============================================================================
import {
  VALIDATION_LIMITS,
  isPlainObject,
  isValidDateString,
  uid,
} from "../safe-store.js";

export const JOURNAL_SCHEMA_VERSION = 4;
export const JOURNAL_EXPORT_FORMAT = "bibletime-journal";

export const JOURNAL_TYPES = Object.freeze([
  "reflection",
  "prayer",
  "gratitude",
  "milestone_note",
]);

export const GUIDED_PROMPTS = Object.freeze([
  { id: "touched", label: "Apa yang paling menyentuh Anda hari ini?" },
  { id: "taught", label: "Apa yang Tuhan ajarkan melalui bagian ini?" },
  { id: "challenge", label: "Apa tantangan terbesar yang Anda hadapi?" },
  { id: "step", label: "Langkah kecil apa yang akan Anda lakukan minggu ini?" },
]);

export const SUGGESTED_TAGS = Object.freeze([
  "Hikmat", "Doa", "Iman", "Pengampunan", "Kesabaran", "Keluarga", "Pekerjaan",
  "Syukur", "Pengharapan", "Kasih", "Integritas", "Kerendahan hati",
]);

export function emptyPrayer() {
  return { requests: [], thanks: [], answered: [], waiting: [] };
}

export function createEntry(partial = {}) {
  if (!isPlainObject(partial)) partial = {};
  const now = new Date().toISOString();
  const type = JOURNAL_TYPES.includes(partial.type) ? partial.type : "reflection";
  return normalizeEntry({
    id: partial.id || uid(),
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    book: partial.book || "Amsal",
    chapter: partial.chapter ?? partial.day ?? null,
    verse: partial.verse ?? null,
    day: partial.day ?? (Number.isFinite(Number(partial.chapter)) ? Number(partial.chapter) : null),
    type,
    title: partial.title || "",
    body: partial.body || "",
    prayer: normalizePrayer(partial.prayer),
    gratitude: partial.gratitude || "",
    tags: Array.isArray(partial.tags) ? partial.tags.map(String).filter(Boolean) : [],
    mood: partial.mood || "",
    actionPlan: partial.actionPlan || "",
    favorite: !!partial.favorite,
    guidedAnswers: partial.guidedAnswers && typeof partial.guidedAnswers === "object"
      ? { ...partial.guidedAnswers }
      : {},
  });
}

export function normalizeEntry(raw = {}) {
  if (!isPlainObject(raw)) raw = {};
  const now = new Date().toISOString();
  const day = raw.day != null && Number.isFinite(Number(raw.day)) ? Number(raw.day) : null;
  const chapter = raw.chapter != null && Number.isFinite(Number(raw.chapter))
    ? Number(raw.chapter)
    : day;
  return {
    id: limitString(raw.id || uid(), 200),
    createdAt: normalizeDate(raw.createdAt, now),
    updatedAt: normalizeDate(raw.updatedAt, normalizeDate(raw.createdAt, now)),
    book: limitString(raw.book || "Amsal", 100),
    chapter,
    verse: raw.verse != null && String(raw.verse).trim() ? limitString(raw.verse, 100) : null,
    day,
    type: JOURNAL_TYPES.includes(raw.type) ? raw.type : "reflection",
    title: limitString(raw.title, VALIDATION_LIMITS.maxJournalTitleChars),
    body: limitString(raw.body, VALIDATION_LIMITS.maxJournalFieldChars),
    prayer: normalizePrayer(raw.prayer),
    gratitude: limitString(raw.gratitude, VALIDATION_LIMITS.maxJournalFieldChars),
    tags: uniqueStrings(raw.tags),
    mood: limitString(raw.mood, 100),
    actionPlan: limitString(raw.actionPlan, VALIDATION_LIMITS.maxJournalFieldChars),
    favorite: !!raw.favorite,
    guidedAnswers: isPlainObject(raw.guidedAnswers)
      ? Object.fromEntries(
        Object.entries(raw.guidedAnswers)
          .slice(0, VALIDATION_LIMITS.maxJournalGuidedAnswers)
          .map(([k, v]) => [limitString(k, 100), limitString(v, VALIDATION_LIMITS.maxJournalFieldChars)])
          .filter(([k, v]) => k && v),
      )
      : {},
  };
}

export function normalizePrayer(prayer) {
  if (typeof prayer === "string") {
    const text = limitString(prayer, VALIDATION_LIMITS.maxJournalFieldChars);
    return text ? { requests: [text], thanks: [], answered: [], waiting: [] } : emptyPrayer();
  }
  if (!isPlainObject(prayer)) return emptyPrayer();
  return {
    requests: asStringList(prayer.requests),
    thanks: asStringList(prayer.thanks),
    answered: asStringList(prayer.answered),
    waiting: asStringList(prayer.waiting),
  };
}

export function migrateV3Entry(day, v3 = {}) {
  const learned = String(v3.learned || "").trim();
  const decision = String(v3.decision || "").trim();
  const prayer = String(v3.prayer || "").trim();
  if (!learned && !decision && !prayer) return null;
  return createEntry({
    id: v3.id || `v3-day-${day}`,
    day: Number(day),
    book: "Amsal",
    chapter: Number(day),
    type: "reflection",
    title: "",
    body: learned,
    actionPlan: decision,
    prayer: prayer ? { requests: [prayer], thanks: [], answered: [], waiting: [] } : emptyPrayer(),
    createdAt: v3.createdAt,
    updatedAt: v3.updatedAt || v3.createdAt,
  });
}

export function migrateV3Map(map = {}) {
  const entries = [];
  Object.entries(isPlainObject(map) ? map : {})
    .slice(0, VALIDATION_LIMITS.maxJournalEntries)
    .forEach(([dayKey, value]) => {
    const migrated = migrateV3Entry(Number(dayKey), value || {});
    if (migrated) entries.push(migrated);
  });
  return entries;
}

export function validateJournalPayload(data) {
  let entries;
  let version = null;

  if (Array.isArray(data)) {
    entries = data; // legacy array export
  } else if (isPlainObject(data)) {
    if (data.format != null && data.format !== JOURNAL_EXPORT_FORMAT) {
      throw new Error("Format impor jurnal tidak dikenali");
    }
    version = data.schemaVersion ?? data.version ?? null;
    if (version != null && (!Number.isInteger(Number(version)) || Number(version) < 1)) {
      throw new Error("Versi schema jurnal tidak valid");
    }
    if (version != null && Number(version) > JOURNAL_SCHEMA_VERSION) {
      throw new Error(`Versi jurnal ${version} belum didukung`);
    }
    entries = data.entries;
  }

  if (!Array.isArray(entries)) throw new Error("Format impor jurnal tidak dikenali");
  if (entries.length > VALIDATION_LIMITS.maxJournalEntries) {
    throw new Error(`Impor dibatasi ${VALIDATION_LIMITS.maxJournalEntries} entri`);
  }

  return {
    version: version == null ? null : Number(version),
    entries: validateAndNormalizeEntries(entries),
  };
}

export function validateAndNormalizeEntries(entries) {
  if (!Array.isArray(entries)) throw new Error("Daftar entri jurnal harus berupa array");
  if (entries.length > VALIDATION_LIMITS.maxJournalEntries) {
    throw new Error(`Impor dibatasi ${VALIDATION_LIMITS.maxJournalEntries} entri`);
  }

  const deduped = new Map();
  entries.forEach((raw, index) => {
    validateImportEntry(raw, index);
    const entry = normalizeEntry(raw);
    const previous = deduped.get(entry.id);
    if (!previous || entry.updatedAt >= previous.updatedAt) deduped.set(entry.id, entry);
  });
  return [...deduped.values()];
}

export function normalizeStoredEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const deduped = new Map();
  entries
    .slice(0, VALIDATION_LIMITS.maxJournalEntries)
    .filter(isPlainObject)
    .forEach((raw) => {
      const entry = normalizeEntry(raw);
      const previous = deduped.get(entry.id);
      if (!previous || entry.updatedAt >= previous.updatedAt) deduped.set(entry.id, entry);
    });
  return [...deduped.values()];
}

export function normalizeStoredJournalPayload(data) {
  if (!isPlainObject(data) || !Array.isArray(data.entries)) return [];
  const version = data.schemaVersion ?? data.version ?? JOURNAL_SCHEMA_VERSION;
  if (!Number.isInteger(Number(version)) || Number(version) > JOURNAL_SCHEMA_VERSION) return [];
  if (data.format != null && data.format !== JOURNAL_EXPORT_FORMAT) return [];
  return normalizeStoredEntries(data.entries);
}

export function isEmptyEntry(entry) {
  if (!entry) return true;
  const prayer = entry.prayer || emptyPrayer();
  const prayerText = [...prayer.requests, ...prayer.thanks, ...prayer.answered, ...prayer.waiting].some(Boolean);
  const guided = Object.values(entry.guidedAnswers || {}).some((v) => String(v || "").trim());
  return !(
    entry.body
    || entry.title
    || entry.gratitude
    || entry.actionPlan
    || entry.mood
    || prayerText
    || guided
    || (entry.tags && entry.tags.length)
  );
}

export function entrySearchText(entry) {
  if (!entry) return "";
  const prayer = entry.prayer || emptyPrayer();
  return [
    entry.title,
    entry.body,
    entry.gratitude,
    entry.actionPlan,
    entry.mood,
    entry.book,
    entry.chapter,
    entry.verse,
    entry.type,
    ...(entry.tags || []),
    ...prayer.requests,
    ...prayer.thanks,
    ...prayer.answered,
    ...prayer.waiting,
    ...Object.values(entry.guidedAnswers || {}),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function toLegacyFields(entry) {
  if (!entry) return null;
  const prayer = entry.prayer || emptyPrayer();
  return {
    day: entry.day,
    learned: entry.body || "",
    decision: entry.actionPlan || "",
    prayer: prayer.requests[0] || prayer.thanks[0] || "",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    id: entry.id,
    favorite: entry.favorite,
    tags: entry.tags,
    type: entry.type,
  };
}

function asStringList(value) {
  if (Array.isArray(value)) {
    return value
      .slice(0, VALIDATION_LIMITS.maxJournalListItems)
      .map((v) => limitString(v, VALIDATION_LIMITS.maxJournalFieldChars))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [limitString(value, VALIDATION_LIMITS.maxJournalFieldChars)];
  }
  return [];
}

function uniqueStrings(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list.slice(0, VALIDATION_LIMITS.maxJournalTags) : []).forEach((item) => {
    const text = limitString(item, 100);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}

function validateImportEntry(raw, index) {
  const label = `Entri ${index + 1}`;
  if (!isPlainObject(raw)) throw new Error(`${label} harus berupa object`);

  validateOptionalString(raw, "id", label, 200);
  validateOptionalString(raw, "book", label, 100);
  validateOptionalString(raw, "verse", label, 100, true);
  validateOptionalString(raw, "title", label, VALIDATION_LIMITS.maxJournalTitleChars);
  validateOptionalString(raw, "body", label, VALIDATION_LIMITS.maxJournalFieldChars);
  validateOptionalString(raw, "gratitude", label, VALIDATION_LIMITS.maxJournalFieldChars);
  validateOptionalString(raw, "mood", label, 100);
  validateOptionalString(raw, "actionPlan", label, VALIDATION_LIMITS.maxJournalFieldChars);

  for (const field of ["createdAt", "updatedAt"]) {
    if (raw[field] != null && !isValidDateString(raw[field])) {
      throw new Error(`${label}: ${field} tidak valid`);
    }
  }

  for (const field of ["day", "chapter"]) {
    if (raw[field] == null) continue;
    const value = Number(raw[field]);
    if (!Number.isInteger(value) || value < 1 || value > 31) {
      throw new Error(`${label}: ${field} tidak valid`);
    }
  }

  if (raw.type != null && !JOURNAL_TYPES.includes(raw.type)) {
    throw new Error(`${label}: type tidak valid`);
  }
  if (raw.favorite != null && typeof raw.favorite !== "boolean") {
    throw new Error(`${label}: favorite harus boolean`);
  }
  if (raw.tags != null && !Array.isArray(raw.tags)) {
    throw new Error(`${label}: tags harus array`);
  }
  if (Array.isArray(raw.tags) && raw.tags.length > VALIDATION_LIMITS.maxJournalTags) {
    throw new Error(`${label}: jumlah tag melebihi batas`);
  }
  if (Array.isArray(raw.tags)) validateStringItems(raw.tags, `${label}: tags`, 100);
  if (raw.guidedAnswers != null && !isPlainObject(raw.guidedAnswers)) {
    throw new Error(`${label}: guidedAnswers harus object`);
  }
  if (isPlainObject(raw.guidedAnswers) && Object.keys(raw.guidedAnswers).length > VALIDATION_LIMITS.maxJournalGuidedAnswers) {
    throw new Error(`${label}: guidedAnswers melebihi batas`);
  }
  if (isPlainObject(raw.guidedAnswers)) {
    for (const value of Object.values(raw.guidedAnswers)) {
      if (typeof value !== "string" || value.length > VALIDATION_LIMITS.maxJournalFieldChars) {
        throw new Error(`${label}: nilai guidedAnswers tidak valid`);
      }
    }
  }
  validatePrayerShape(raw.prayer, label);
}

function validatePrayerShape(prayer, label) {
  if (prayer == null || typeof prayer === "string") return;
  if (!isPlainObject(prayer)) throw new Error(`${label}: prayer harus object atau string`);
  for (const field of ["requests", "thanks", "answered", "waiting"]) {
    if (prayer[field] == null) continue;
    if (!Array.isArray(prayer[field])) throw new Error(`${label}: prayer.${field} harus array`);
    if (prayer[field].length > VALIDATION_LIMITS.maxJournalListItems) {
      throw new Error(`${label}: prayer.${field} melebihi batas`);
    }
    validateStringItems(
      prayer[field],
      `${label}: prayer.${field}`,
      VALIDATION_LIMITS.maxJournalFieldChars,
    );
  }
}

function validateStringItems(values, label, max) {
  if (values.some((value) => typeof value !== "string" || value.length > max)) {
    throw new Error(`${label} berisi nilai yang tidak valid`);
  }
}

function validateOptionalString(raw, field, label, max, allowNumber = false) {
  const value = raw[field];
  if (value == null) return;
  if (typeof value !== "string" && !(allowNumber && typeof value === "number")) {
    throw new Error(`${label}: ${field} harus string`);
  }
  if (String(value).length > max) throw new Error(`${label}: ${field} terlalu panjang`);
}

function normalizeDate(value, fallback) {
  if (!isValidDateString(value)) return fallback;
  try { return new Date(value).toISOString(); } catch { return fallback; }
}

function limitString(value, max) {
  return String(value ?? "").trim().slice(0, max);
}
