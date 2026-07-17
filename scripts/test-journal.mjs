// =============================================================================
// test-journal.mjs — Uji AI-07 Journal (schema, migrasi, search, export, consent).
// =============================================================================
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  get length() { return this.#values.size; }
  key(i) { return [...this.#values.keys()][i] ?? null; }
}
globalThis.localStorage = new MemoryStorage();

const {
  migrateV3Map,
  createEntry,
  isEmptyEntry,
  normalizeEntry,
} = await import("../js/journal/schema.js");
const {
  bootstrapJournalSync,
  saveEntry,
  listEntries,
  upsertDayReflection,
  clearAllEntries,
  importEntries,
  entryCount,
} = await import("../js/journal/store.js");
const { searchJournal } = await import("../js/journal/search.js");
const { exportJournalJSON, exportJournalMarkdown, exportJournalText } = await import("../js/journal/export.js");
const { parseJournalImport, importJournalJSON } = await import("../js/journal/import.js");
const { suggestTags } = await import("../js/journal/tags.js");
const { buildJournalInsights } = await import("../js/journal/insights.js");
const {
  grantJournalAiConsent,
  revokeJournalAiConsent,
  isJournalAiConsentGranted,
  JOURNAL_AI_CONSENT_COPY,
} = await import("../js/journal/consent.js");

function report(label, ms, budget) {
  const ok = ms <= budget;
  console.log(`${ok ? "OK" : "SLOW"} ${label}: ${ms.toFixed(2)} ms (budget ${budget})`);
  assert.ok(ok, `${label} melebihi budget ${budget} ms (${ms.toFixed(2)})`);
}

// --- Migrasi v3 → v4 ---
const migrated = migrateV3Map({
  1: { learned: "Hikmat dimulai dari takut akan Tuhan", decision: "Baca Amsal tiap pagi", prayer: "Tuhan ajar aku bijak", createdAt: "2026-01-01T00:00:00.000Z" },
  2: { learned: "", decision: "", prayer: "" },
});
assert.equal(migrated.length, 1);
assert.equal(migrated[0].body.includes("Hikmat"), true);
assert.equal(migrated[0].actionPlan.includes("Baca"), true);
assert.equal(migrated[0].prayer.requests[0].includes("bijak"), true);
assert.equal(migrated[0].book, "Amsal");
assert.equal(migrated[0].chapter, 1);

localStorage.setItem("bibleTime.journal.v3", JSON.stringify({
  3: { learned: "Pengampunan memulihkan", decision: "Minta maaf", prayer: "Ampuni aku", createdAt: "2026-02-01T00:00:00.000Z" },
}));
bootstrapJournalSync();
assert.ok(entryCount() >= 1, "bootstrap harus migrasi v3");
assert.equal(localStorage.getItem("bibleTime.journal.v3"), null, "v3 harus dibersihkan setelah migrasi");

// --- CRUD + search perf ---
const saveStart = performance.now();
const entry = saveEntry(createEntry({
  day: 5,
  chapter: 5,
  type: "reflection",
  body: "Aku belajar kesabaran dan hikmat di pekerjaan.",
  gratitude: "Keluarga yang mendukung",
  actionPlan: "Sabar saat rapat",
  tags: ["Hikmat"],
  prayer: { requests: ["Bijaksana dalam keputusan"], thanks: ["Kasih Tuhan"], answered: [], waiting: [] },
}));
report("Save", performance.now() - saveStart, 50);
assert.ok(entry?.id);
assert.ok(!isEmptyEntry(entry));

upsertDayReflection(7, { learned: "Iman tumbuh lewat doa", decision: "Doa pagi", prayer: "Kuatkan imanku" });

const searchStart = performance.now();
const found = searchJournal("hikmat", { tag: "Hikmat" });
report("Search", performance.now() - searchStart, 100);
assert.ok(found.some((e) => e.id === entry.id));

const byType = searchJournal("", { type: "reflection" });
assert.ok(byType.length >= 1);

// --- Tags ---
const tags = suggestTags("Saya bersyukur dan berdoa untuk keluarga");
assert.ok(tags.includes("Syukur") || tags.includes("Doa") || tags.includes("Keluarga"));

// --- Export / import round-trip ---
const json = exportJournalJSON();
const parsed = parseJournalImport(json);
assert.ok(parsed.length >= 2);
const md = exportJournalMarkdown();
assert.ok(md.includes("# Bible Time"));
const txt = exportJournalText();
assert.ok(txt.includes("Refleksi") || txt.includes("==="));

await clearAllEntries();
assert.equal(entryCount(), 0);
const { count } = await importJournalJSON(json, { merge: false });
assert.ok(count >= 2);
assert.ok(entryCount() >= 2);

// --- Insights descriptive ---
const insights = buildJournalInsights({ days: 365 });
assert.ok(Array.isArray(insights.cards));
assert.ok(insights.cards.every((c) => typeof c.text === "string" && c.text.length > 0));
assert.ok(!/menghakimi|buruk rohani|gagal rohani/i.test(insights.cards.map((c) => c.text).join(" ")));

// --- Consent gate copy + flag ---
assert.ok(JOURNAL_AI_CONSENT_COPY.includes("menolak") || JOURNAL_AI_CONSENT_COPY.includes("cabut"));
revokeJournalAiConsent();
assert.equal(isJournalAiConsentGranted(), false);
grantJournalAiConsent();
assert.equal(isJournalAiConsentGranted(), true);
revokeJournalAiConsent();
assert.equal(isJournalAiConsentGranted(), false);

// ContextBuilder harus menolak journalExcerpt tanpa consent tersimpan
const { contextBuilder } = await import("../src/ai/context-builder.js");
const leaked = contextBuilder.build({
  journalConsent: true,
  journalExcerpt: "RAHASIA_JURNAL_PRIVAT",
  day: 1,
});
assert.equal(leaked.journalExcerpt, "", "ContextBuilder wajib cek consent tersimpan");
assert.equal(leaked.metadata.journalConsent, false);

// AIService.reflectJournal harus menolak tanpa consent
const { AIService } = await import("../src/ai/ai-service.js");
let blocked = false;
try {
  await AIService.reflectJournal({ text: "Refleksi rahasia", day: 1 });
} catch (err) {
  blocked = true;
  assert.equal(err.code, "INVALID_REQUEST");
}
assert.ok(blocked, "reflectJournal harus ditolak tanpa consent");

grantJournalAiConsent();
const allowed = contextBuilder.build({
  journalConsent: true,
  journalExcerpt: "RAHASIA_JURNAL_PRIVAT",
  day: 1,
});
assert.ok(allowed.journalExcerpt.includes("RAHASIA_JURNAL_PRIVAT"), "dengan consent tersimpan boleh masuk konteks");

const aiResult = await AIService.reflectJournal({
  text: "Hari ini aku belajar hikmat dan pengampunan.",
  day: 1,
  chapter: 1,
  book: "Amsal",
});
assert.ok(aiResult?.content || aiResult?.answer, "dengan consent harus ada jawaban");

// Prompt metadata tidak boleh membawa isi jurnal mentah ke provider metadata
const { promptBuilder } = await import("../src/ai/prompt-builder.js");
const prompt = promptBuilder.build({
  intent: "journal-reflection",
  question: "Ringkas",
  context: allowed,
  metadata: { journalExcerpt: "RAHASIA_JURNAL_PRIVAT" },
});
assert.equal(prompt.metadata.context.journalExcerpt, "[redacted]");
assert.equal(prompt.metadata.journalExcerpt, "[redacted]");
assert.ok(prompt.messages[1].content.includes("RAHASIA_JURNAL_PRIVAT"), "pesan user tetap boleh berisi jurnal setelah consent");

revokeJournalAiConsent();

// Print/PDF harus escape HTML berbahaya
const { markdownToSafeHtml } = await import("../js/journal/export.js");
const safeHtml = markdownToSafeHtml("# Judul\n<script>alert(1)</script>\n<img src=x onerror=alert(2)>");
assert.ok(!safeHtml.includes("<script>"));
assert.ok(safeHtml.includes("&lt;script&gt;"));
assert.ok(safeHtml.includes("&lt;img"));

console.log("All journal tests passed.");
