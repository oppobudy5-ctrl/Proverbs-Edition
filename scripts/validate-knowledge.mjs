// =============================================================================
// validate-knowledge.mjs — Validator otomatis Bible Knowledge Base.
//
// Memastikan: JSON valid, tidak ada ID duplikat, tidak ada metadata kosong,
// tidak ada topic orphan, tidak ada cross-reference rusak, tidak ada source
// kosong. Keluar dengan kode != 0 bila ada pelanggaran.
// =============================================================================

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { validateDocument, DOCUMENT_TYPES } from "../src/ai/knowledge/schema.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "knowledge", "dist", "knowledge.min.json");

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

async function main() {
  let knowledge;
  try {
    knowledge = JSON.parse(await readFile(DIST, "utf8"));
  } catch (error) {
    console.error(`Tidak dapat memuat knowledge.min.json. Jalankan build terlebih dulu.\n${error.message}`);
    process.exit(1);
  }

  const documents = knowledge.documents || [];
  const topics = knowledge.topics || [];
  const topicIds = new Set(topics.map((t) => t.id));
  const docIds = new Set();

  // 1) JSON valid + bentuk dokumen + ID unik + source/metadata tidak kosong.
  for (const doc of documents) {
    const docErrors = validateDocument(doc);
    for (const err of docErrors) fail(`Dokumen ${doc.id || "(tanpa id)"}: ${err}`);
    if (docIds.has(doc.id)) fail(`ID duplikat: ${doc.id}`);
    docIds.add(doc.id);
    if (!String(doc.source || "").trim()) fail(`Source kosong: ${doc.id}`);
    if (!String(doc.title || "").trim() && !String(doc.content || "").trim()) fail(`Metadata kosong (title+content): ${doc.id}`);
  }

  // 2) Topik yang dirujuk dokumen harus ada di ontologi.
  for (const doc of documents) {
    for (const topicId of doc.topics || []) {
      if (!topicIds.has(topicId)) fail(`Topik tidak dikenal "${topicId}" pada dokumen ${doc.id}`);
    }
  }

  // 3) Orphan topic: hierarki konsisten + topik dipakai di suatu tempat.
  const usedTopics = new Set();
  for (const doc of documents) for (const t of doc.topics || []) usedTopics.add(t);
  for (const topic of topics) {
    if (topic.parentTopic && !topicIds.has(topic.parentTopic)) {
      fail(`Topik ${topic.id}: parentTopic tidak ada "${topic.parentTopic}"`);
    }
    for (const child of topic.childTopics || []) {
      if (!topicIds.has(child)) fail(`Topik ${topic.id}: childTopic tidak ada "${child}"`);
    }
    const hasRelation = (topic.relatedChapters || []).length > 0 || (topic.childTopics || []).length > 0 || topic.parentTopic;
    if (!usedTopics.has(topic.id) && !hasRelation) {
      fail(`Topik orphan (tidak dipakai & tanpa relasi): ${topic.id}`);
    }
    if (!usedTopics.has(topic.id)) warn(`Topik "${topic.id}" tidak dirujuk dokumen mana pun (hanya relasi ontologi).`);
  }

  // 4) Cross-reference tidak rusak: source mengacu pasal yang ada; target non-kosong.
  const chapterNumbers = new Set(
    documents.filter((d) => d.type === DOCUMENT_TYPES.CHAPTER).map((d) => Number(d.meta?.chapter)),
  );
  for (const doc of documents.filter((d) => d.type === DOCUMENT_TYPES.CROSSREF)) {
    const source = doc.meta?.source;
    const target = doc.meta?.target;
    const chapter = Number(String(source || "").match(/Amsal\s+(\d+)/i)?.[1]);
    if (!Number.isFinite(chapter) || !chapterNumbers.has(chapter)) {
      fail(`Cross-ref ${doc.id}: source "${source}" tidak mengacu pasal yang ada.`);
    }
    if (!String(target || "").trim()) fail(`Cross-ref ${doc.id}: target kosong.`);
    if (!doc.meta?.relationshipType) fail(`Cross-ref ${doc.id}: relationshipType kosong.`);
  }

  // 5) Indeks konsisten: setiap id di indeks harus ada di dokumen.
  for (const [name, bucket] of Object.entries(knowledge.indexes || {})) {
    for (const [key, ids] of Object.entries(bucket)) {
      for (const id of ids) {
        if (!docIds.has(id)) fail(`Indeks ${name}["${key}"] menunjuk id tak dikenal: ${id}`);
      }
    }
  }

  // 6) Cakupan minimum (acceptance criteria).
  const counts = knowledge.meta?.counts || {};
  const requireType = (type, min) => {
    if ((counts[type] || 0) < min) fail(`Cakupan kurang: ${type} = ${counts[type] || 0}, minimal ${min}.`);
  };
  requireType(DOCUMENT_TYPES.CHAPTER, 31);
  requireType(DOCUMENT_TYPES.GOLDEN_VERSE, 31);
  requireType(DOCUMENT_TYPES.VERSE, 1);
  requireType(DOCUMENT_TYPES.TOPIC, 20);
  requireType(DOCUMENT_TYPES.DICTIONARY, 10);
  requireType(DOCUMENT_TYPES.CROSSREF, 10);
  requireType(DOCUMENT_TYPES.COMMENTARY, 1);
  requireType(DOCUMENT_TYPES.FAQ, 5);
  requireType(DOCUMENT_TYPES.REFLECTION, 31);
  requireType(DOCUMENT_TYPES.PRAYER, 31);
  requireType(DOCUMENT_TYPES.CHALLENGE, 31);
  requireType(DOCUMENT_TYPES.DOCTRINE, 12);
  requireType(DOCUMENT_TYPES.CHARACTER, 8);
  requireType(DOCUMENT_TYPES.TIMELINE, 6);
  requireType(DOCUMENT_TYPES.SYMBOL, 15);
  requireType(DOCUMENT_TYPES.WISDOM_PATTERN, 8);
  requireType(DOCUMENT_TYPES.APPLICATION, 31);
  requireType(DOCUMENT_TYPES.CANON_BOOK, 1);

  // 7) CIL: production chapter completeness + applications + crossrefs 31/31
  const productionChapters = documents
    .filter((d) => d.type === DOCUMENT_TYPES.CHAPTER)
    .map((d) => Number(d.meta?.chapter))
    .filter(Number.isFinite);
  if (new Set(productionChapters).size !== 31) fail(`CIL: pasal production harus 31, didapat ${new Set(productionChapters).size}`);
  const appChapters = new Set(
    documents.filter((d) => d.type === DOCUMENT_TYPES.APPLICATION).map((d) => Number(d.meta?.chapter)),
  );
  for (let ch = 1; ch <= 31; ch += 1) {
    if (!appChapters.has(ch)) fail(`CIL: application hilang untuk pasal ${ch}`);
  }
  const xrefChapters = new Set();
  for (const doc of documents.filter((d) => d.type === DOCUMENT_TYPES.CROSSREF)) {
    const ch = Number(String(doc.meta?.source || "").match(/Amsal\s+(\d+)/i)?.[1]);
    if (Number.isFinite(ch)) xrefChapters.add(ch);
  }
  for (let ch = 1; ch <= 31; ch += 1) {
    if (!xrefChapters.has(ch)) fail(`CIL: crossref hilang untuk pasal ${ch}`);
  }
  const contrastCount = documents.filter(
    (d) => d.type === DOCUMENT_TYPES.CROSSREF && d.meta?.relationshipType === "contrast",
  ).length;
  if (contrastCount < 2) fail(`CIL: minimal 2 relasi contrast, didapat ${contrastCount}`);

  // 8) CIL confidence bounds + hierarchy participation
  for (const type of [
    DOCUMENT_TYPES.DOCTRINE,
    DOCUMENT_TYPES.CHARACTER,
    DOCUMENT_TYPES.TIMELINE,
    DOCUMENT_TYPES.SYMBOL,
    DOCUMENT_TYPES.WISDOM_PATTERN,
    DOCUMENT_TYPES.APPLICATION,
  ]) {
    for (const doc of documents.filter((d) => d.type === type)) {
      const conf = Number(doc.meta?.confidence);
      if (!Number.isFinite(conf) || conf < 0.5 || conf > 1) {
        fail(`CIL: confidence di luar [0.5,1] pada ${doc.id}: ${doc.meta?.confidence}`);
      }
    }
  }
  for (const topic of topics) {
    const inHierarchy = topic.parentTopic || (topic.childTopics || []).length > 0 || (topic.relatedChapters || []).length > 0;
    if (!inHierarchy) fail(`CIL: topik tanpa partisipasi hierarki: ${topic.id}`);
  }

  // 9) Seed books exempt from chapter completeness; production books must resolve
  const canonBooks = documents.filter((d) => d.type === DOCUMENT_TYPES.CANON_BOOK);
  for (const book of canonBooks) {
    const status = book.meta?.status;
    if (status === "seed") continue;
    if (status === "production" && Number(book.meta?.chapterCount) !== 31 && book.meta?.slug === "proverbs") {
      fail(`CIL: production Proverbs chapterCount harus 31`);
    }
  }

  // 10) Graph artifact presence when embedded in knowledge bundle
  if (knowledge.canon && !Array.isArray(knowledge.canon.books)) fail("CIL: canon.books hilang dari bundel");
  if (knowledge.domains && (knowledge.domains.doctrines || []).length < 12) fail("CIL: doctrines domain kurang");
  if ((knowledge.meta?.cil?.applications || 0) < 31) fail("CIL: meta.cil.applications < 31");

  if (warnings.length) {
    console.log("Peringatan:\n" + warnings.map((w) => `  - ${w}`).join("\n"));
  }
  if (errors.length) {
    console.error(`\nVALIDASI GAGAL (${errors.length}):\n` + errors.map((e) => `  ✗ ${e}`).join("\n"));
    process.exit(1);
  }
  console.log(
    `VALID: BKB+CIL lolos validasi — ${documents.length} dokumen, ${topics.length} topik, ${canonBooks.length} canon books.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
