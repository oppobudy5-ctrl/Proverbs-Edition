# Changelog

## Phase 006B — Production AI Provider Integration

### Perubahan
- Provider layer production-ready: interchangeable adapters untuk Mock, OpenAI,
  Gemini, Claude (Anthropic), Azure OpenAI, dan Ollama.
- `config/ai.config.js`: model registry, failover order, env-driven defaults
  (tanpa credential di client).
- `src/ai/providers/provider-selector.js`: prioritas configured → healthy → mock,
  plus failover untuk timeout / quota / offline / 429 / 500 / auth.
- Health check seragam (`reachable`, `authentication`, `modelExists`, `latency`,
  `status`, `healthTimestamp`).
- Streaming: proxy SSE + Ollama native, dengan fallback non-stream.
- Server proxy aman: `scripts/ai-proxy.mjs`, di-wire ke `scripts/dev-server.mjs`
  dan Cloudflare Pages `functions/api/ai/[[path]].js`.
- `AISettings`: provider, model, streaming, temperature, offlineMode, debugMode
  (+ UI di panel Pengaturan).
- Observability: log provider / model / latency / retries / tokens / streaming /
  failover reason melalui `AILogger`.
- Tes: `scripts/test-production-providers.mjs`.
- Dokumentasi: `docs/ai/PRODUCTION_PROVIDER.md`, `.env.example`.

### Batas perubahan
Tidak mengubah Bible Knowledge Base, Canonical Intelligence Layer, Biblical
Reasoning Engine, dataset editorial, AI Prompt Builder, AI Validation, atau
kontrak publik AIService. Perubahan berada di layer Provider, konfigurasi,
proxy server, dan settings.

## Phase 006A — End-to-End AI Execution Audit

### Perubahan
- Audit menyeluruh alur AI: tombol **"Kirim pertanyaan"** → `AIService.ask()` →
  Intent Analyzer → Context Builder → Reasoning Engine → AI Gateway → Provider
  (atau Offline Canonical Engine) → Canonical Validation → Response Formatter →
  UI Renderer. Semua terverifikasi memanggil pipeline nyata.
- `src/ai/ai-utils.js`: tambah `AIDebug` — DEBUG MODE opt-in (default OFF) via
  `localStorage.ai_debug`, `globalThis.__AI_DEBUG__`, atau env `AI_DEBUG`.
- `src/ai/reasoning/reasoning-engine.js`: stage markers (Intent Detected,
  Context Loaded, Knowledge Bundle Loaded, Cross References Loaded, Provider
  Called/Returned/Failed/Skipped, Validation, Reasoning Completed) + blok trace
  `[AI]` konsolidasi.
- `src/ai/ai-controller.js`: log Gateway Called/Provider Returned/Gateway Failed
  dengan alasan (offline, timeout, rate limit, quota, API error, configuration).
- `js/ui/ai-lesson-assist.js`: marker `Response Rendered` setelah render jawaban.
- `sw.js`: bump cache ke `bibletime-v30-ai-execution-audit`.
- Laporan lengkap di `docs/audit/AI_EXECUTION_AUDIT.md` (11 bagian + acceptance).

### Temuan
- Tidak ada sample/dummy/placeholder **response** yang dirender UI. Semua UI
  memakai `AIService`; tidak ada import provider/prompt/store langsung.
- Provider default `mock` adalah offline provider deterministik (bukan stub UI)
  dan diungkap jujur ke pengguna; offline fallback memakai canonical Knowledge
  Bundle, bukan teks hardcoded.

### Batas perubahan
Tidak mengubah Bible Knowledge Base, dataset editorial, Canonical Intelligence
Layer, Biblical Reasoning Engine, AI Gateway, provider, atau prompt. Hanya
menambah logging DEBUG opt-in yang tidak memengaruhi output.

## Phase 007 — Planning & Discipleship Engine

### Perubahan
- `src/ai/planning/goal-analyzer.js`: klasifikasi offline untuk 11 tujuan belajar dan topik lokal.
- `src/ai/planning/planning-engine.js`: reading, daily, study, topical, dan book plan dari dataset chapter yang sudah ada.
- `src/ai/planning/recommendation-engine.js`: rekomendasi berikutnya berdasarkan lesson aktif, progres, tema, Companion, dan reasoning metadata.
- `src/ai/planning/milestone-engine.js`: milestone 7/14/21/31 lesson, book, theme, dan plan complete yang configurable.
- `src/ai/ai-service.js`: facade `plan()` dan `recommend()` dengan response envelope standar.
- `js/ui/planning.js`: Reading Plan, Study Plan, Daily Plan, Recommendation, dan Milestone memakai komponen Design System yang sudah tersedia.
- `js/router.js` dan `index.html`: route `/plans` beserta navigasi desktop, mobile, dan footer.
- Cache plan lokal, canonical-only fallback, dan precache Service Worker untuk operasi offline.
- `scripts/test-planning-engine.mjs`: goal, reading/study/book/topical plan, rekomendasi, milestone, cache, offline, AIService, router, dan UI boundary.
- Dokumentasi lengkap di `docs/ai/PLANNING_DISCIPLESHIP_ENGINE.md`.

### Batas perubahan
Tidak mengubah Bible Knowledge Base, dataset editorial, Canonical Reasoning
Engine, AI Gateway, provider, RAG, atau prompt. Planning hanya mengorkestrasi
kemampuan dan data yang sudah tersedia.

## Phase 006 — Biblical Reasoning Engine

### Perubahan
- `src/ai/reasoning/` (baru): Intent Analyzer, Context Builder, Theme Analyzer, Canonical Validator, structured formatter, dan Reasoning Engine.
- Intent Analyzer mencakup Meaning, Application, Reflection, Historical, Character Study, Theme, Cross Reference, Promise, Warning, Command, Prayer, Wisdom, Timeline, Doctrine, dan General Question.
- Context Builder memproyeksikan purpose, memory verse, keywords, historical context, citations, dan metadata chapter dari CIL.
- Response Formatter menstandarkan `summary`, `answer`, `application`, `cross_references`, `historical_context`, `memory_verse`, `prayer`, `next_step`, `citation`, `confidence`, `provider`, `reasoning_metadata`, dan `timestamp`.
- Bible Companion memakai Biblical Reasoning Engine; tidak lagi memanggil intent `summary` langsung.
- Review / Mentor memakai pipeline Reflection → Canonical Context → Reasoning → Review.
- Ask tetap melalui Reasoning Engine via `AIService.ask()` / `AIService.reason()`.
- `js/ui/ai-dialog.js` dan `js/ui/ai-lesson-assist.js`: panel **Dasar Jawaban** menampilkan bukti kanonik tanpa prompt internal.
- Tes regresi mencakup Companion + Review integration, offline fallback, dan schema output.
- Dokumentasi lengkap di `docs/ai/BIBLICAL_REASONING_ENGINE.md`.

### Batas perubahan
Tidak mengubah Bible Knowledge Base, dataset editorial, AI Gateway, AI Service
contract, RAG, atau prompt LLM baru. Pipeline memakai intent `qa` yang sudah ada.

## Phase 005B — Bible Companion Integration Refinement

### Perubahan
- Editorial challenge kini selalu diprioritaskan di atas template invitation.
- Memory verse dan keywords dipetakan dari dataset chapter dan dirender di card Chapter Overview.
- Historical context memakai chapter context dan timeline CIL terlebih dahulu; metadata kitab hanya fallback.
- Purpose, themes, book overview, dan chapter overview memiliki mapping yang terpisah dan eksplisit.
- Seluruh themes dan keywords memakai komponen chip yang sudah tersedia.
- Rendering kembali memakai empat card Companion yang sudah ada; tidak ada card atau komponen desain baru.
- Fallback palsu tidak dirender untuk chapter berstatus `available`.
- Laporan mapping tersedia di `docs/audit/COMPANION_MAPPING_REPORT.md`.

### Batas perubahan
Tidak ada perubahan pada dataset editorial, Proverbs bundle, Bible Knowledge
Base, Canonical Intelligence Layer, AI Engine, RAG, atau prompt.

## Phase 005A — Canonical Dataset Activation

### Perubahan
- `src/ai/companion/companion-engine.js`: mengaktifkan source editorial `CONTENT` Amsal 1–31 sebagai resolver utama untuk chapter title, overview, summary, main theme, keywords, application, prayer, dan memory verse.
- Metadata pasal terkurasi dari `knowledge/metadata/chapter-overlays.json` dimuat sekali dan dipakai untuk historical context, literary context, struktur, serta tingkat kesulitan.
- Ringkasan editorial kanonik tidak lagi ditimpa oleh output provider/mock; hasil provider disimpan terpisah sebagai `ai_summary`.
- `js/ui/bible-companion.js`: menampilkan Book Overview, Chapter Overview, Canonical Context, Memory Verse, Cross Book References, Penerapan dan Doa, serta Dataset Metadata.
- Placeholder palsu dihapus dari jalur Amsal yang berstatus `available`; fallback tetap dipakai hanya untuk kitab `metadata-only`.
- `styles.css`: menonaktifkan drop cap artikel pada kartu Companion agar metadata tidak terpecah menjadi huruf awal besar.
- `scripts/test-proverbs-activation.mjs`: validasi 31 bundle JSON dan seluruh field aktif, termasuk sampel pasal 1, 5, 10, 15, 20, 25, dan 31.

### Batas perubahan
Tidak ada isi editorial, devosional, Bible Knowledge Base, Canonical Intelligence
Layer, atau AI Engine yang diubah. Fase ini hanya mengaktifkan dan memetakan
dataset yang sudah ada.

## Phase 005 — Multi-Book Bible Companion

### Perubahan
- `knowledge/canon/books-registry.json`: registry kanonik lengkap 66 kitab dengan nama, singkatan, testament, jumlah pasal, penulis, periode, kategori, bahasa, urutan kanonik, dan status ketersediaan.
- `src/ai/cil/gateway.js`: pencarian chapter, typed documents, retrieval, cross-reference, dan degraded fallback kini book-aware; memperbaiki binding `fetch` browser agar CIL tidak jatuh ke fallback secara keliru.
- `src/ai/knowledge/knowledge-base.js`: chapter bundle memakai key `book:chapter`, mencegah collision lintas kitab.
- `src/ai/companion/companion-engine.js` (baru): structured Bible Companion dengan Book Overview, Summary, Historical Context, Cross Book References, Application, Prayer, citation, dan metadata-only fallback.
- `src/ai/ai-service.js`: menambahkan `books()`, `book()`, dan `companion()` melalui standard response envelope.
- `js/ui/bible-companion.js` (baru): Book Selector 66 kitab, Chapter Selector, Book Overview, Book Summary, cross-book references, dan status offline yang jelas.
- `js/router.js` dan `index.html`: deep link `/companion/:book/:chapter` serta navigasi Companion yang accessible dan responsive.
- Semantic Search mencakup seluruh registry melalui 66 dokumen `canon-book`.
- `scripts/test-multi-book.mjs` (baru): registry, isolasi chapter lintas kitab, CIL leakage, Companion, cross-book references, semantic search, navigation, offline fallback, dan UI boundary.
- `docs/ai/MULTI_BOOK_COMPANION.md`: dokumentasi arsitektur dan ekspansi.
- `sw.js`: cache `bibletime-v22-multi-book` dan precache modul Companion/Review.

### Ketersediaan data
Struktur mendukung 66 kitab. Amsal adalah satu-satunya kitab dengan konten
pasal terkurasi dan tersedia offline saat ini. Kitab lain menampilkan metadata
kanonik serta status `metadata-only`; aplikasi tidak mengarang atau meminjam
konten Amsal.

## Phase 004 — AI Review Engine & Bible Mentor

### Perubahan
- `src/ai/review/review-engine.js` (baru): orchestrator Review Engine — satu panggilan CIL + optional LLM enrichment + formatter; fallback canonical-only jika provider gagal.
- `src/ai/review/review-formatter.js` (baru): memetakan CanonicalContext DTO ke immutable ReviewOutput schema.
- `src/ai/ai-service.js`: `review()` diganti ke ReviewEngine; `mentor()` ditambahkan (mode mentor dari engine yang sama). Envelope Phase 002 tetap dipertahankan; field `review` berisi output terstruktur.
- `js/ui/ai-reflection-panel.js`: tombol **Review AI** memakai `AIService.review`; tombol **Bible Mentor** memakai `AIService.mentor`; render terstruktur (ayat hafalan, tema, kekuatan, aplikasi, referensi silang, doa, dll.).
- `scripts/test-review-engine.mjs` (baru): 12 assertion — schema, tema via topics, memory verse, crossrefs, historical, prayer, mentor mode, provider-failure fallback, UI boundary.
- `docs/ai/AI_REVIEW_ENGINE.md`: dokumentasi pipeline, schema, error handling, integrasi.
- `sw.js`: cache bump ke `bibletime-v21-ai-review`.

### Output schema
`summary`, `strengths`, `missing_points`, `application`, `memory_verse`,
`cross_references`, `historical_context`, `themes`, `wisdom`, `encouragement`,
`prayer`, `next_step`, `reflection_question`, `confidence`, `citations`,
`provider`, `timestamp`, `canonical_only`.

### Batas perubahan
Tidak mengubah CIL, Bible Knowledge Base, RAG, Prompt templates, atau Design System.
Tidak membuat model AI baru.

## Phase 002 — AI Service Layer

### Perubahan
- `src/ai/ai-service.js`: menjadi facade tunggal dengan response envelope seragam dan error aman (tidak melempar ke UI).
- Method tersedia: `summary`/`summarize`, `ask`, `reflect`, `reflectJournal`, `review`, `search`, `semanticSearch`, `explain`, `wisdom`, `crossReference`, dan `buildCanonicalContext`.
- `prayer()` mengembalikan status `not_implemented` secara aman karena Prayer Engine belum tersedia.
- `src/ai/ai-utils.js`: logging production tidak lagi mencetak detail error sensitif.
- `scripts/test-ai-service.mjs`: contract test seluruh method, kompatibilitas field lama, error handling, dan larangan import engine/provider langsung dari UI.
- `validate-ai.mjs` dan `test-journal.mjs`: diperbarui untuk kontrak error-as-response.
- `docs/AI-SERVICE-LAYER.md`: dokumentasi arsitektur, method, response, dan error.

### Standard response
Semua capability utama mengembalikan:
`success`, `status`, `provider`, `source`, `citation`, `citations`, `content`,
`metadata`, `error`, dan `timestamp`.

Field hasil lama (`results`, `analysis`, `crossrefs`, confidence/guardrails)
tetap dipertahankan untuk kompatibilitas UI tanpa perubahan.

### Engine terhubung
- Generatif: Summary, Ask/Q&A, Reflection, Review (Reflection Engine), Explain, Wisdom, LLM Search.
- Lokal/CIL: Semantic Search, Cross Reference, Canonical Context.
- Belum tersedia: Prayer Engine (`NOT_IMPLEMENTED`, tidak crash).

### Batas perubahan
Tidak ada perubahan UI, Prompt, RAG, CIL, atau Bible Knowledge Base.

## Phase 001 — AI UI Integration

### Perubahan
- `js/ui/ai-dialog.js` (baru): dialog AI reusable (pola `reader-overlay` + focus trap, loading/error/answer).
- `js/ui/ai-lesson-assist.js` (baru): toolbar + kartu Lesson — Ringkas AI, Tanyakan AI, Jelaskan, Wisdom Coach, Cari Hikmat, Referensi Silang.
- `js/ui/day.js`: mount AI assist setelah teks pasal.
- `js/ui/ai-reflection-panel.js`: tombol **Review Renungan** memakai `AIService.reflect` (Reflection Engine yang sudah ada), dengan consent jurnal.
- `src/ai/ai-service.js`: facade tipis `wisdom()` agar intent/prompt wisdom yang sudah ada dapat dipanggil UI (tanpa mengubah engine/prompt).
- `styles.css` + `sw.js`: gaya assist (reuse reading/journal/reader) dan precache modul UI baru.

### Engine yang dihubungkan
| UI | Engine / API |
| --- | --- |
| Ringkas AI | `AIService.summarize` |
| Tanyakan AI | `AIService.ask` |
| Jelaskan | `AIService.explain` |
| Review Renungan | `AIService.reflect` |
| Bantu refleksi (AI) | `AIService.reflectJournal` (sudah ada) |
| Wisdom Coach | `AIService.wisdom` → intent `wisdom` |
| Referensi Silang | `AIService.buildCanonicalContext` → `crossrefs` |
| Cari Hikmat | `AIService.semanticSearch` via `mountSemanticSearch` (+ panel Kalender) |

### Halaman
- Lesson / Day / Home lesson body
- Journal (panel AI)
- Semantic Search juga tetap di Kalender

### Belum punya UI khusus (sengaja ditunda)
- Provider/model settings UI
- Conversation history UI
- Review Engine produk (belum ada engine terpisah)
- Vector/embeddings search

### Alasan
Audit AI-07A: engine sudah ada; Phase 001 hanya mengekspos ke UI.

### Kompatibilitas
- Tidak mengubah RAG, KB, CIL engines, atau prompt templates.
- Provider default tetap mock bila cloud belum dikonfigurasi.

## PR-010 Production Verification & Release Candidate

### Perubahan
- `sw.js`: bump `CACHE_VERSION` `bibletime-v9-sw-pr002` → `bibletime-v10-rc` (app shell berubah sejak PR-002) dan menambahkan `js/utils/security.js` ke precache shell.
- `_redirects` + `_headers` (baru): konfigurasi Cloudflare Pages aditif (SPA fallback + header `sw.js`/manifest); tidak memengaruhi Vercel.
- `LICENSE` (baru): MIT, selaras dengan `package.json`.
- `ROADMAP.md` (baru): fase produk + jejak PR produksi (PR-001…PR-010).
- `docs/RELEASE_CANDIDATE_REPORT.md` (baru): ringkasan audit, checklist 15 kategori, analisis risiko, keputusan rilis, kompatibilitas browser, hasil offline & PWA, rekomendasi.
- `README.md`: perbaikan penyebutan `CACHE_VERSION`, bagian Quality Gate, dan catatan deploy Cloudflare Pages.

### Alasan
Gerbang kualitas akhir sebelum Release Candidate. Perubahan dibatasi pada konfigurasi produksi & dokumentasi — tanpa mengubah fitur, UI/UX, atau business logic.

### Dampak
- Pengguna lama menerima app shell terbaru karena cache di-bump.
- Aplikasi dapat dideploy ke Vercel maupun Cloudflare Pages (dengan catatan proxy `/bible/*`).
- Kesiapan rilis terdokumentasi dan dapat diaudit ulang.

### Kompatibilitas
- Tidak ada perubahan API publik, storage key, atau perilaku runtime.
- Bump cache SW hanya memicu refresh shell standar (cache lama dibersihkan saat activate).

### Hasil verifikasi
- `npm install` / `npm run build` / `npm run lint` / `npm test` → semua PASS (14 suite).
- Keputusan: **READY FOR RELEASE CANDIDATE** — tag `v2.0.0-rc.1`. Tidak ada blocker kritis.

## PR-007 Accessibility Enhancement

### Perubahan
- `js/a11y.js`: memperluas helper — `getFocusableElements`, `restoreFocus`, `trapFocus` (Escape + Tab cycle), `announce`, skip link “Lewati ke konten utama”.
- `js/ui/reader.js`: modal pembaca paralel memakai `role="dialog"`, `aria-labelledby`, focus trap, restore focus, status loading/`aria-busy`, dan pengumuman screen reader.
- `js/ui/version-dropdown.js`: navigasi panah/Home/End, `aria-selected`, restore fokus ke trigger.
- `js/ui/library.js`: tablist/tabpanel dengan `aria-controls`, Home/End, `replaceChildren`.
- `js/ui/settings-panel.js`: nama aksesibel untuk Mode Baca; swatch dekoratif `aria-hidden`.
- `js/ui/calendar.js` + `js/ui/semantic-search-ui.js` + `js/ui/streak.js` + `js/ui/offline.js`: label/status/live region lebih jelas.
- `index.html`: landmark nav berlabel, streak `role="status"`, ikon dekoratif `aria-hidden`, `#app` dapat difokuskan.
- `styles.css`: fokus keyboard tetap terlihat pada slider BGM dan saran pencarian (`:focus-visible` saja — tanpa mengubah tampilan mouse).
- `scripts/test-a11y.mjs` + `npm run test-a11y`.

### Alasan
Audit menemukan fokus modal pembaca belum ter-trap, beberapa kontrol ikon/landmark kurang nama aksesibel, dan indikator fokus hilang pada beberapa kontrol. Perbaikan ini menegakkan Perceivable / Operable / Understandable / Robust menuju WCAG 2.2 AA tanpa mengubah desain visual.

### Dampak
- Keyboard: Tab / Shift+Tab / Enter / Space / Esc / panah berfungsi pada navigasi, modal, dropdown, dan tab koleksi.
- Screen reader: landmark, judul halaman, status loading/offline/streak, dan nama tombol lebih jelas.
- UI visual dan business logic tidak diubah.

### Kompatibilitas
- API publik `trapFocus` / `announce` / `installSkipLink` tetap tersedia; helper baru bersifat tambahan.
- AI, Journal storage, Database/Supabase, Router History API, dan Service Worker tidak diubah secara fungsional.

### Hasil audit accessibility
- Landmark: `header`, `nav` (atas + bawah), `main`, `footer` + `lang="id"`.
- Modal: settings + reader dialog dengan focus trap, Escape, restore focus.
- Form: jurnal/search/bookmark memakai label atau `aria-label` (placeholder bukan satu-satunya nama).
- Gambar/ikon dekoratif: `aria-hidden`; kontrol ikon-only: `aria-label`.
- Skip link + live region toast/status sudah ada dan diverifikasi.

## PR-006 Security & DOM Hardening

### Perubahan
- `js/utils/security.js` (baru): utilitas keamanan bersama — `escapeHTML`, `sanitizeString`, `safeText`, `isSafeProtocol`, `validateURL`, `safeURL`.
- `js/search.js` + `js/journal/export.js`: menghapus definisi `escapeHTML`/`escapeHtml` duplikat, memakai util bersama.
- `js/ui/quiz.js`: mengganti seluruh `innerHTML` (feedback + clear) dengan node DOM aman (`el()`, `textContent`, `replaceChildren()`).
- `js/ui/reader.js`: clear via `replaceChildren()`, href SABDA lewat `safeURL()`, dan `rel="noopener noreferrer"`.
- `js/ui/about.js`: href sosial lewat `safeURL()` dan `rel="noopener noreferrer"`.
- `index.html`: tautan eksternal `target="_blank"` memakai `rel="noopener noreferrer"`.
- `js/dom.js`: dokumentasi keamanan pada atribut `html` (hanya markup tepercaya statis).
- `scripts/test-security.mjs` + `npm run test-security`.

### Alasan
Audit menemukan `escapeHTML` terduplikasi, `quiz.js` memakai `innerHTML`, serta beberapa `target="_blank"` tanpa `rel` lengkap. Menyatukan escape util, memindahkan render ke DOM API, dan memvalidasi URL menegakkan prinsip Escape Before Render, Validate Before Use, dan Default Safe.

### Dampak
- Render tetap identik secara visual (konten kuis/refleksi murni statis), namun kini aman by default.
- Teks user (jurnal/refleksi/pencarian) tetap dirender sebagai teks, tag HTML tidak dieksekusi.
- Kode lebih siap CSP (tanpa `eval`/`new Function`/`set*(string)`; tidak menambah global baru).

### Kompatibilitas
- Public API tidak berubah; hanya deduplikasi internal + hardening.
- AI, Journal, Database/Supabase, Router, dan Service Worker tidak diubah.
- Inline script di `index.html` dibatasi pada bootstrap first-party tepercaya (injeksi manifest + registrasi SW) tanpa data dinamis; ekstraksi penuh ditunda agar tidak meregresi SW/boot.

### Risiko yang dikurangi
- Reflected/stored XSS sederhana lewat teks (jurnal, pencarian, highlight, ekspor markdown).
- Tabnabbing pada tautan `target="_blank"`.
- Navigasi ke skema berbahaya (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`).
- Divergensi perilaku escape akibat helper terduplikasi.

## PR-005 Data Validation & Import Safety

### Perubahan
- `js/safe-store.js`: helper reusable `safeParse` / `safeStringify`, pemeriksaan tipe/date/ukuran UTF-8, schema placeholder, dan konstanta batas validasi.
- `js/store.js`: sanitasi bentuk progress dan bookmark pada load/save, termasuk batas 500 bookmark.
- `js/journal/schema.js`: validasi envelope/schema v4, struktur entri, tanggal, tipe field, panjang field, array, unknown field, data legacy, dan deduplikasi ID.
- `js/journal/import.js` + `js/ui/library.js`: menolak file di atas 2 MiB sebelum parse/read serta membatasi impor hingga 2.000 entri.
- `js/journal/export.js`: sanitasi payload dan serialisasi aman agar circular/invalid object tetap menghasilkan JSON UTF-8 valid.
- `scripts/test-validation.mjs` + `npm run test-validation`: regresi untuk JSON rusak, ukuran/jumlah berlebih, tipe salah, legacy/future schema, unknown field, duplikat, tanggal, dan circular export.

### Alasan
Data valid secara sintaks JSON belum tentu memiliki struktur aman. Validasi boundary mencegah persisted/imported data yang rusak atau terlalu besar menyebabkan crash maupun browser freeze.

### Dampak
- Import invalid dibatalkan dengan pesan yang jelas; aplikasi tetap berjalan.
- Data tersimpan disanitasi dan unknown field diabaikan.
- Tidak ada perubahan visual, UX, routing, service worker, AI, database, atau business flow.

### Kompatibilitas
- Public API dan format `version: 4` tetap tersedia; `schemaVersion` dan `dataVersion` ditambahkan secara backward-compatible.
- Array export legacy dan object export versi lama yang kompatibel tetap dapat dibaca.
- Future schema ditolak secara aman agar data tidak ditafsirkan keliru.

## PR-004 Router & Navigation

### Perubahan
- `js/router.js`: History API (`pushState` / `replaceState` / `popstate`), deep link path, title, fokus a11y, dan sinkronisasi nav aktif.
- Path publik: `/`, `/calendar`, `/library`, `/about`, `/lesson/:day` (alias `/day/:day`, `/journal`, `/bookmark`, `/profile`).
- `js/main.js`: boot menghormati URL (tidak lagi memaksa `go("home")`).
- `vercel.json` + `serve.json`: rewrite SPA agar refresh/deep link tidak 404.
- `scripts/test-router.mjs` + `npm run test-router`.

### Alasan
Router sebelumnya hanya navigasi in-memory tanpa History API, sehingga Back/Forward browser, URL shareable, dan deep link/refresh tidak andal.

### Dampak
- Back/Forward bekerja tanpa full reload.
- URL dapat dibagikan dan di-refresh dengan aman.
- Unknown route jatuh ke home tanpa crash.
- UI/UX visual, AI, journal, storage, dan service worker tidak diubah.
- API publik `go(route, params)` dan `initRouter()` tetap kompatibel.

### Kompatibilitas
- Pemanggilan `go("day", { day })` / `data-route` lama tetap valid.
- Fallback aman bila History API tidak tersedia (`file:` protocol).

## PR-002 Service Worker Reliability

### Perubahan
- Menambahkan sumber versioning tunggal (`CACHE_VERSION` / `CACHE_STATIC`) dan bump ke `bibletime-v9-sw-pr002`.
- `networkFirst`, `cacheFirst`, dan `staleWhileRevalidate` hanya menulis cache bila `response.ok`.
- Fallback offline: `index.html` hanya untuk `navigate`; request non-HTML mengembalikan `Response.error()` (mencegah MIME error pada `.js`/`.css`/`.json`).
- Instalasi precache toleran: tiap asset di-cache sendiri; kegagalan satu file tidak membatalkan install SW.
- Activate tetap membersihkan cache versi lama.
- Bypass eksplisit untuk `/bible/*`, `/api/ai/*`, dan `/api/*` agar respons AI/API sensitif tidak di-cache.

### Alasan
Audit production readiness menemukan bahwa error HTTP bisa tersimpan, fallback HTML merusak MIME asset, dan `cache.addAll()` bersifat all-or-nothing sehingga satu asset hilang menggagalkan seluruh install.

### Dampak
- Offline reading (lesson, konten Amsal, journal/bookmark lokal) tetap tersedia dari cache/storage yang sudah ada.
- Update SW lebih aman: cache lama dibuang, response error tidak menimpa cache sehat.
- UI/UX/Design System/AI/CIL/BKB tidak berubah.

### Kompatibilitas
- Backward compatible: strategi fetch yang sama (network-first untuk HTML/JS/CSS, cache-first untuk aset lain).
- Public API aplikasi tidak berubah.
- Registrasi `navigator.serviceWorker.register("./sw.js")` tetap sama.
