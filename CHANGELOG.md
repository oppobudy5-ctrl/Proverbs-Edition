# Changelog

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
