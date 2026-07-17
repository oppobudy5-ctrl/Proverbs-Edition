# Bible Knowledge Base (BKB) — Architecture

Phase **AI-01B**. Bible Knowledge Base adalah **Single Source of Truth** untuk seluruh
fitur AI Bible Companion dan menjadi fondasi **Retrieval-Augmented Generation (RAG)**.

> **CI-01:** Runtime AI mengakses BKB **hanya** melalui [Canonical Intelligence Layer](./CIL-ARCHITECTURE.md).
> Modul di luar `src/ai/cil/**` dan `src/ai/knowledge/**` tidak boleh mengimpor mesin BKB secara langsung.

> **Prinsip inti:** Bible First · Context First · Citation First · Evidence Based ·
> Explain, Don't Invent · Transparency · Offline Friendly · Provider Agnostic · Extensible.
>
> LLM hanya **menjelaskan, merangkum, menghubungkan, memberi contoh, membantu refleksi**.
> LLM **tidak** menjadi sumber utama doktrin atau fakta Alkitab — semua jawaban bersandar
> pada data terkurasi di BKB.

---

## 1. Alur RAG (via CIL)

```
User Question
   ↓
AIService → Canonical Context Gateway
   ↓
CIL Engines (canon/topic/relation/graph/domain)
   ↓
Bible Knowledge Base (read-only data plane)
   ↓
CanonicalContext → Prompt Builder
   ↓
LLM → Citation / Confidence / Theological Guardrails
   ↓
Validated AIResponse
```

## 2. Struktur Direktori

```
knowledge/
  canon/
    books-registry.json
    reference-aliases.json
  doctrine/ characters/ timeline/ symbols/ wisdom/ application/
  metadata/
    book-proverbs.json        # Domain 01 — Bible Canon
    chapter-overlays.json     # Domain 02 — struktur/konteks/difficulty kurasi
  topics/topics.json          # Domain 05 — Topic Ontology (24 topik)
  dictionary/dictionary.json  # Domain 06 — Kamus (Ibrani/Yunani/Terms/People/…)
  crossrefs/crossrefs.json    # Domain 07 — Graph rujukan silang
  commentaries/commentaries.json # Domain 08 — Metadata tafsir (domain publik)
  faq/faq.json                # Domain 13 — FAQ
  faq/apologetics.json        # Domain 14 — Apologetika
  books/proverbs/
    chapter-01.json … chapter-31.json   # (generated) bundel dokumen per pasal
  indexes/                    # (generated) 11 index files
  dist/                       # (generated) artefak siap muat + export
    knowledge.min.json        # artefak utama (dokumen + topik + indeks)
    search-index.json  topic-index.json  crossref-index.json
    dictionary-index.json  faq-index.json  knowledge.chunks.json  manifest.json
```

**Sumber kebenaran devosional** (Domain 02/03/04/10/11/12/15) diturunkan dari
`data/content.js` + `data/schedule.js` saat build sehingga tidak ada duplikasi konten.
Domain lintas (01/05/06/07/08/09/13/14) dikurasi manual sebagai JSON di `knowledge/`.

## 3. Document Schema

Setiap dokumen dinormalisasi ke satu bentuk (`src/ai/knowledge/schema.js`):

| Field | Keterangan |
|---|---|
| `id`, `type`, `title`, `content`, `summary` | inti dokumen |
| `tags`, `keywords`, `topics`, `references` | metadata retrieval |
| `source`, `license`, `language`, `version`, `updatedAt` | provenance |
| `embeddingStatus`, `chunkId`, `chunkOrder`, `estimatedTokens`, `vectorReady` | **Semantic Preparation** |
| `meta` | field spesifik-domain (mis. `historicalContext`, `crossReferences`, `importanceScore`) |

`type` ∈ `book, chapter, verse, golden-verse, topic, dictionary, crossref, commentary,
quote, reflection, prayer, challenge, faq, apologetics, devotional`.

## 4. Retrieval Index

Dibangun saat build **dan** dapat dibangun ulang saat load (offline fallback):
Keyword · Topic · Verse · Chapter · Book · People · Places · Quote · Dictionary ·
Commentary · FAQ.

## 5. Topic Ontology

24 topik dengan hierarki `parentTopic`/`childTopics`, `aliases` (Indonesia + Ibrani),
dan relasi `relatedChapters`/`relatedVerses` yang **dihitung otomatis** dengan mencocokkan
alias terhadap keyword/tema tiap pasal. Contoh: `character → integrity, humility, discipline`.

## 6. Cross Reference Mapping

Graph sederhana `source → target` dengan `relationshipType`
(`thematic, parallel, fulfillment, amplification, contrast, quotation`), `reason`,
dan `confidence` (0–1) yang dipakai untuk ranking.

## 7. Search Ranking

Skor = jumlah bobot kecocokan (exact title/keyword, topic, partial, verse, prefix,
summary, content, fuzzy) + `importanceScore·4` + `popularity·3`. Fuzzy memakai jarak
Levenshtein (toleransi 1–2) untuk salah ketik.

## 8. Chunk Strategy

Target **200–400 token**, tidak memotong paragraf (batas = baris kosong); paragraf
raksasa dipecah pada batas kalimat. Setiap chunk membawa prefix judul agar konteks
terjaga. Output ke `dist/knowledge.chunks.json` dengan `parentId`, `chunkOrder`,
`estimatedTokens`, `embeddingStatus:"pending"`, `vectorReady:false`.

## 9. Context Builder API

`src/ai/knowledge/knowledge-context.js`:
`getChapterContext` · `getVerseContext` · `getTopicContext` · `getReflectionContext` ·
`getPrayerContext` · `getFAQContext` · `getCrossReferenceContext` · `combine(parts, { tokenBudget })`.
Setiap konteks mengembalikan `{ sections, citations[], topics[], estimatedTokens, text }`.

## 10. Future Embeddings

Field `embeddingStatus`, `chunkId`, `vectorReady` sudah tersedia. Ketika embeddings
diaktifkan, pipeline mengisi vektor per chunk tanpa mengubah skema atau API di atas.

## 11. Validation

`npm run validate-knowledge` memastikan: JSON valid · tanpa ID duplikat · tanpa metadata
kosong · tanpa topic orphan · tanpa cross-reference rusak · tanpa source kosong · indeks
konsisten · cakupan minimum domain terpenuhi.

## 12. Performance Target (tercapai)

| Operasi | Target | Aktual (Node) |
|---|---|---|
| Knowledge Load | < 200 ms | ~1.4 ms |
| Search | < 50 ms | ~1.7 ms |
| Context Builder | < 20 ms | ~0.3 ms |
| Offline Search | < 30 ms | ~1.5 ms |

## 13. Security

BKB bersifat **Read Only** dari UI — semua dokumen dibekukan (`Object.freeze`), tidak ada
setter, dan seluruh data tervalidasi sebelum build.

## 14. Contribution Guide

1. Sunting file kurasi di `knowledge/` **atau** konten di `data/`.
2. `npm run build-knowledge` untuk regenerasi `books/`, `indexes/`, `dist/`.
3. `npm run validate-knowledge` — wajib lolos.
4. `npm run test-knowledge` — cek performa & fungsional.
   (Ketiganya sekaligus: `npm run knowledge`.)
5. Jangan menyalin teks tafsir berhak cipta — commentary hanya metadata + ringkasan.

## 15. Future Compatibility

Struktur data & API dijaga stabil untuk AI-02 (Smart Summary), AI-03 (Bible Q&A),
AI-04 (Semantic Search), AI-05 (Ask This Chapter), AI-06 (Wisdom Coach),
AI-07 (AI Reflection & Journal — see docs/JOURNAL-ARCHITECTURE.md), AI-08 (AI Devotional), AI-09 (Multi Book Study),
AI-10 (Church Study Assistant) — tanpa perubahan struktur.
