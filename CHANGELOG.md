# Changelog

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
