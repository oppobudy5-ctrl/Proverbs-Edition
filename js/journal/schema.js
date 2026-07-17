// =============================================================================
// schema.js — DTO jurnal v4 + migrasi dari v3 { learned, decision, prayer }.
// =============================================================================
import { uid } from "../safe-store.js";

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
  const day = raw.day != null && Number.isFinite(Number(raw.day)) ? Number(raw.day) : null;
  const chapter = raw.chapter != null && Number.isFinite(Number(raw.chapter))
    ? Number(raw.chapter)
    : day;
  return {
    id: String(raw.id || uid()),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString()),
    book: String(raw.book || "Amsal"),
    chapter,
    verse: raw.verse != null && String(raw.verse).trim() ? String(raw.verse).trim() : null,
    day,
    type: JOURNAL_TYPES.includes(raw.type) ? raw.type : "reflection",
    title: String(raw.title || "").trim(),
    body: String(raw.body || "").trim(),
    prayer: normalizePrayer(raw.prayer),
    gratitude: String(raw.gratitude || "").trim(),
    tags: uniqueStrings(raw.tags),
    mood: String(raw.mood || "").trim(),
    actionPlan: String(raw.actionPlan || "").trim(),
    favorite: !!raw.favorite,
    guidedAnswers: raw.guidedAnswers && typeof raw.guidedAnswers === "object"
      ? Object.fromEntries(
        Object.entries(raw.guidedAnswers).map(([k, v]) => [k, String(v || "").trim()]).filter(([, v]) => v),
      )
      : {},
  };
}

export function normalizePrayer(prayer) {
  if (!prayer || typeof prayer !== "object") return emptyPrayer();
  if (typeof prayer === "string") {
    const text = prayer.trim();
    return text ? { requests: [text], thanks: [], answered: [], waiting: [] } : emptyPrayer();
  }
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
  Object.entries(map).forEach(([dayKey, value]) => {
    const migrated = migrateV3Entry(Number(dayKey), value || {});
    if (migrated) entries.push(migrated);
  });
  return entries;
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
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function uniqueStrings(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const text = String(item || "").trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}
