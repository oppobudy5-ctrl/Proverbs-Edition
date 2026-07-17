// =============================================================================
// hero-title.js — Auto-fit ukuran judul hero.
//
// Memakai SATU listener resize (singleton) untuk seluruh masa hidup app.
// renderDay cukup memanggil fitHeroTitle(h1) setiap render; referensi judul
// aktif diperbarui, sehingga tidak ada penumpukan listener (memory leak).
// =============================================================================

let currentH1 = null;
let resizeTimer;

function apply() {
  const h1 = currentH1;
  if (!h1 || !h1.isConnected) return;
  h1.classList.remove("is-long", "is-xlong");
  const lh = parseFloat(getComputedStyle(h1).lineHeight) || h1.offsetHeight;
  const lines = Math.round(h1.offsetHeight / lh);
  // Ambang class dipertahankan sama persis seperti versi lama agar tampilan
  // (ukuran tipografi judul) tidak berubah.
  if (lines > 1) h1.classList.add("is-long");
  if (lines > 1) h1.classList.add("is-xlong");
}

// Dipasang sekali saat modul dimuat.
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(apply, 120);
});

export function fitHeroTitle(h1) {
  currentH1 = h1 || null;
  apply();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
}
