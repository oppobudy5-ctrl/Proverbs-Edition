# Bible Time Proverbs Edition

**31 Hari Hidup dalam Hikmat** adalah Daily Wisdom Journey melalui Amsal 1–31.
Setiap hari memuat satu pasal, ayat emas, ringkasan, renungan pastoral, kata
kunci, catatan eksegesis, pertanyaan refleksi, doa, tantangan, dan kuis.

## Project Overview

- Vanilla JavaScript dengan ES modules
- 31 hari, satu pasal Amsal per hari
- Progress dan streak tersimpan di browser
- Pembaca paralel TB + versi pendamping
- Offline-first PWA
- Tidak memakai framework atau dependency runtime

## Struktur

```text
.
├── index.html
├── styles.css
├── manifest.webmanifest
├── sw.js
├── data/
│   ├── schedule.js
│   ├── content.js
│   └── proverbs/
│       ├── part-01.js
│       ├── part-02.js
│       ├── part-03.js
│       └── part-04.js
├── js/
│   ├── main.js
│   ├── router.js
│   ├── plan.js
│   ├── date-helper.js
│   ├── store.js
│   ├── search.js
│   ├── bible-api.js
│   └── ui/
├── src/
│   └── ai/                 # Provider-agnostic AI Foundation
│       └── knowledge/      # Bible Knowledge Base (RAG) runtime
├── knowledge/              # Bible Knowledge Base — Single Source of Truth
│   ├── metadata/ topics/ dictionary/ crossrefs/ commentaries/ faq/
│   ├── situations/ synonyms/   # life-situation + synonym maps (Semantic Search)
│   ├── books/proverbs/     # (generated) bundel per pasal
│   ├── indexes/            # (generated) index files
│   └── dist/               # (generated) knowledge.min.json + exports
├── config/
│   └── ai.config.js
├── docs/
│   ├── AI-ARCHITECTURE.md
│   ├── CIL-ARCHITECTURE.md
│   ├── KNOWLEDGE-ARCHITECTURE.md
│   ├── JOURNAL-ARCHITECTURE.md
│   └── SEMANTIC-SEARCH.md
├── icons/
└── scripts/
    ├── gen-icons.mjs
    ├── validate-content.mjs
    ├── build-knowledge.mjs
    ├── validate-knowledge.mjs
    ├── validate-cil.mjs
    ├── test-knowledge.mjs
    ├── test-semantic.mjs
    ├── test-journal.mjs
    └── test-cil-*.mjs
```

`data/schedule.js` menyimpan urutan perjalanan. Konten dibagi menjadi empat
modul agar mudah ditinjau, lalu digabung oleh `data/content.js`. Seluruh
renderer tetap independen dari jumlah hari.

## Development

Modul ES membutuhkan server HTTP:

```bash
npm install
npm run dev
```

Buka `http://localhost:8080/`. Alternatif tanpa Node:

```bash
python -m http.server 8080
```

Di Windows, `start.bat` dapat digunakan.

## Validasi Konten

```bash
npm run validate-content
```

Validator memastikan:

- tepat 31 hari dan pasal 1–31;
- semua field wajib terisi;
- minimal enam kata kunci;
- tepat tiga pertanyaan refleksi;
- tepat lima soal pilihan ganda;
- rentang kata ringkasan, renungan, eksegesis, dan doa sesuai panduan;
- tidak ada referensi edisi lama di data.

## Search dan Bookmark

`js/search.js` mengindeks judul, tema, kata kunci, referensi, dan teks ayat
emas. `js/store.js` memakai namespace khusus Proverbs Edition agar progress
edisi lama tidak tercampur. Bookmark edisi sebelumnya dideteksi dengan aman
dan menghasilkan notifikasi bahwa bookmark tersebut tidak lagi tersedia.

## PWA

`sw.js` mem-precache app shell, seluruh modul konten, ikon, dan data jadwal.
Kode memakai strategi network-first, sedangkan aset statis memakai cache-first.
Naikkan konstanta `VERSION` di `sw.js` setiap kali struktur app shell berubah.

## AI Foundation

Fondasi AI provider-agnostic berada di `src/ai/`. Provider default adalah
`mock`, sehingga pengembangan tidak memerlukan API key. Adapter cloud hanya
memanggil endpoint proxy backend; credential tidak pernah disimpan di frontend.

Semua path AI runtime melewati **Canonical Intelligence Layer (CIL)** —
lihat [docs/CIL-ARCHITECTURE.md](docs/CIL-ARCHITECTURE.md). Arsitektur provider,
prompt, keamanan, dan roadmap AI dijelaskan di
[docs/AI-ARCHITECTURE.md](docs/AI-ARCHITECTURE.md).

```bash
npm run test-cil
npm test
```

### Bible Knowledge Base (RAG)

`knowledge/` adalah **Single Source of Truth** untuk RAG: kanon, metadata pasal/ayat,
ayat emas, ontologi topik, kamus, rujukan silang, metadata tafsir, kutipan, refleksi,
doa, tantangan, FAQ, dan apologetika. Dokumen bersifat **read-only** dan tervalidasi.

```bash
npm run build-knowledge      # regenerasi books/, indexes/, dist/
npm run validate-knowledge   # cek ID duplikat, metadata kosong, topic orphan, cross-ref rusak
npm run test-knowledge       # cek target performa & fungsional (load/search/context/offline)
npm run knowledge            # ketiganya sekaligus
```

Detail domain, skema, chunking, ranking, dan kesiapan embeddings dijelaskan di
[docs/KNOWLEDGE-ARCHITECTURE.md](docs/KNOWLEDGE-ARCHITECTURE.md).

### Semantic Search

Pencarian berbasis makna (bahasa alami, situasi hidup, konsep) memakai ontologi
topik, peta situasi, sinonim, dan knowledge graph — offline-first, tanpa mengirim
seluruh KB ke LLM.

```bash
npm run test-semantic
```

UI tersedia di halaman Kalender. Detail di [docs/SEMANTIC-SEARCH.md](docs/SEMANTIC-SEARCH.md).

### AI Reflection & Journal (AI-07)

Jurnal pribadi offline-first dengan tag, pencarian, insight, timeline, ekspor/impor,
dan asisten refleksi AI yang **hanya** membaca jurnal setelah izin eksplisit.

```bash
npm run test-journal
```

Detail: [docs/JOURNAL-ARCHITECTURE.md](docs/JOURNAL-ARCHITECTURE.md).

Regenerasi ikon dan gambar sosial:

```bash
npm run icons
```

## Deploy

Target utama adalah Vercel:

```bash
vercel deploy --prod
```

`vercel.json` menyediakan proxy `/bible/*` untuk pembaca paralel dan header
yang diperlukan PWA.

## Roadmap

- Phase 01 — Core Stabilization & Bug Fixes
- Phase 02 — Proverbs Migration
- Phase 03 — Reading Experience & Wisdom Journey UX
- Phase AI-01 — Provider-Agnostic AI Foundation
- Phase AI-01B — Bible Knowledge Base (RAG Preparation)
- Phase AI-03 — Semantic Search Engine
- Phase AI-07 — AI Reflection & Journal
- Phase CI-01 — Canonical Intelligence Layer

## Hak Cipta

Teks lengkap TB © Lembaga Alkitab Indonesia. Aplikasi hanya memuat kutipan
ayat emas singkat untuk keperluan pengajaran dan devosional. Teks pasal lengkap
dibuka melalui penyedia Alkitab eksternal.
