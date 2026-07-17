import assert from "node:assert/strict";

const {
  DATA_SCHEMA_VERSION,
  VALIDATION_LIMITS,
  safeParse,
  safeStringify,
} = await import("../js/safe-store.js");
const {
  JOURNAL_SCHEMA_VERSION,
  validateJournalPayload,
} = await import("../js/journal/schema.js");
const { parseJournalImport } = await import("../js/journal/import.js");
const { exportJournalJSON } = await import("../js/journal/export.js");

const validEntry = {
  id: "entry-1",
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T01:00:00.000Z",
  day: 1,
  chapter: 1,
  type: "reflection",
  body: "Hikmat",
  favorite: false,
};

assert.deepEqual(safeParse("{broken", { safe: true }), { safe: true });
assert.equal(safeStringify({ ok: true }), '{"ok":true}');

const valid = parseJournalImport(JSON.stringify({
  format: "bibletime-journal",
  version: JOURNAL_SCHEMA_VERSION,
  entries: [validEntry],
}));
assert.equal(valid.length, 1);
assert.equal(valid[0].body, "Hikmat");

assert.throws(() => parseJournalImport("{broken"), /JSON jurnal rusak/);
assert.throws(() => parseJournalImport("42"), /Format impor/);
assert.throws(
  () => parseJournalImport(" ".repeat(VALIDATION_LIMITS.maxJournalImportBytes + 1)),
  /terlalu besar/,
);
assert.throws(
  () => validateJournalPayload({ entries: Array(VALIDATION_LIMITS.maxJournalEntries + 1).fill(validEntry) }),
  /dibatasi/,
);
assert.throws(
  () => parseJournalImport(JSON.stringify({ version: JOURNAL_SCHEMA_VERSION + 1, entries: [] })),
  /belum didukung/,
);
assert.throws(
  () => parseJournalImport(JSON.stringify([{ ...validEntry, createdAt: "not-a-date" }])),
  /createdAt tidak valid/,
);
assert.throws(
  () => parseJournalImport(JSON.stringify([{ ...validEntry, favorite: "yes" }])),
  /favorite harus boolean/,
);

const legacy = parseJournalImport(JSON.stringify([{ body: "Data lama", unknown: "ignored" }]));
assert.equal(legacy.length, 1);
assert.equal(legacy[0].body, "Data lama");
assert.equal("unknown" in legacy[0], false);

const duplicates = parseJournalImport(JSON.stringify([
  validEntry,
  { ...validEntry, updatedAt: "2026-07-18T01:00:00.000Z", body: "Versi terbaru" },
]));
assert.equal(duplicates.length, 1);
assert.equal(duplicates[0].body, "Versi terbaru");

const circular = { ...validEntry };
circular.self = circular;
const exported = exportJournalJSON([circular], { track: false });
const exportPayload = JSON.parse(exported);
assert.equal(exportPayload.schemaVersion, JOURNAL_SCHEMA_VERSION);
assert.equal(exportPayload.dataVersion, DATA_SCHEMA_VERSION);
assert.equal(exportPayload.entries.length, 1);
assert.equal("self" in exportPayload.entries[0], false);

console.log("VALID: JSON, schema, import limits, legacy, duplicates, dates, dan circular export aman.");
