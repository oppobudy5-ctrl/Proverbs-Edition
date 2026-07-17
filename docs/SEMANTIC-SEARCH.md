# Semantic Search Engine — Architecture

Phase **AI-03**. Semantic Search memahami **makna** query pengguna (bahasa alami,
situasi hidup, konsep), bukan hanya kecocokan kata, dengan tetap **offline-first**
dan berbasis Bible Knowledge Base.

> Embeddings vektor **belum** diaktifkan. Ranking memakai ontologi topik, situation
> map, synonym expansion, knowledge graph, dan skor leksikal. Field
> `embeddingStatus` / `vectorReady` / `chunkId` sudah disiapkan untuk AI berikutnya.

---

## Pipeline

```
User Query
  → Query Analyzer      (tokenize, stopwords, synonym, spell, intent, topic/situation)
  → Knowledge Graph     (topic ↔ chapter ↔ verse ↔ crossref ↔ situation)
  → Semantic Ranking    (topic, meaning, chapter, importance, crossref, confidence, popularity, lexical)
  → Retrieval (BKB)     (SearchEngine lokal)
  → Explain Why + Related Results
```

LLM **tidak** menerima seluruh Knowledge Base. Retrieval lokal dulu; sintesis LLM
opsional hanya lewat `AIService.search()` (fase AI Foundation) jika dibutuhkan.

## Modules

| File | Peran |
|---|---|
| [`src/ai/knowledge/query-analyzer.js`](../src/ai/knowledge/query-analyzer.js) | Intent: natural_language, concept, life_situation, question, related, keyword |
| [`src/ai/knowledge/knowledge-graph.js`](../src/ai/knowledge/knowledge-graph.js) | Graph relasi untuk ekspansi & related |
| [`src/ai/knowledge/semantic-search.js`](../src/ai/knowledge/semantic-search.js) | Engine utama + suggest + relatedSearch |
| [`knowledge/situations/situations.json`](../knowledge/situations/situations.json) | Peta situasi hidup → topik |
| [`knowledge/synonyms/synonyms.json`](../knowledge/synonyms/synonyms.json) | Perluasan sinonim / ejaan |
| [`js/ui/semantic-search-ui.js`](../js/ui/semantic-search-ui.js) | UI: saran, filter, explain-why, related, recent/favorite |
| [`src/ai/search-prefs.js`](../src/ai/search-prefs.js) | 10 recent + favorites (localStorage) |
| [`src/ai/search-analytics.js`](../src/ai/search-analytics.js) | Intent/topic/duration/clicks — tanpa teks jurnal |

## Public API

```js
await AIService.semanticSearch("Saya bingung mengambil keputusan", { limit: 10 });
await AIService.suggestSearch("hik");
await AIService.relatedSearch({ chapter: 3, topicId: "wisdom" });
```

Setiap hasil berisi: `reference`, `title`, `snippet`, `topics`, `reason`, `confidence`,
`relatedChapters`, plus field vector-prep.

## UI

Halaman **Kalender** memakai panel Semantic Search (filter, saran realtime, recent,
favorite, explain-why, related). Grid hari ikut terfilter berdasarkan pasal yang
muncul di hasil.

## Performance targets

| Operasi | Target |
|---|---|
| Search | < 100 ms |
| Offline Search | < 50 ms |
| Suggestion | ~80 ms debounce |

## Future vector search

Dokumen/chunk BKB sudah punya `embeddingStatus`, `chunkId`, `chunkOrder`,
`estimatedTokens`, `vectorReady`. `SemanticIndex` mempertahankan API
`indexDocument` / `search` / `rebuild` / `clear` untuk adapter embeddings nanti.

## Validation

```bash
npm run test-semantic
```
