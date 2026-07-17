// =============================================================================
// main.js — Titik masuk aplikasi (ES module). Merangkai boot sequence.
// =============================================================================
import { Store, consumeLegacyBookmarkNotice } from "./store.js";
import { toast, $ } from "./dom.js";
import { initRouter } from "./router.js";
import { injectFooterIcons } from "./ui/about.js";
import { refreshStreak } from "./ui/streak.js";
import { Bgm } from "./ui/bgm.js";
import { initTheme } from "./theme.js";
import { initSettings } from "./settings.js";
import { installSkipLink } from "./a11y.js";
import { initOffline } from "./ui/offline.js";
import { openSettingsPanel } from "./ui/settings-panel.js";
import { evaluateAchievements } from "./achievement.js";

function wireSettingsButtons() {
  const open = (e) => { e.preventDefault(); openSettingsPanel(); };
  const btn = $("#settings-btn");
  const bn = $("#bn-settings");
  if (btn) btn.addEventListener("click", open);
  if (bn) bn.addEventListener("click", open);
}

function boot() {
  // Preferensi tampilan diterapkan sedini mungkin agar tidak ada kedip tema.
  initTheme();
  initSettings();
  installSkipLink();
  injectFooterIcons();
  initOffline();
  wireSettingsButtons();
  Bgm.init();

  // Tandai kunjungan hari ini (menaikkan streak saat app dibuka harian);
  // tidak menandai "sudah dibaca".
  const s = Store.load();
  Store.bumpStreak(s);
  Store.save(s);
  refreshStreak();

  initRouter();
  // Deep link / refresh ditangani di dalam initRouter() via History API.
  if (consumeLegacyBookmarkNotice()) {
    toast("Bookmark ini berasal dari versi sebelumnya dan tidak lagi tersedia.", 4200);
  }
  // Seed pencapaian dari data yang sudah ada secara diam-diam (tanpa memunculkan
  // dinding popup bagi pengguna lama). Perayaan hanya muncul saat aksi langsung.
  evaluateAchievements();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
