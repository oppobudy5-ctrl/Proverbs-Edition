// =============================================================================
// lifecycle.js — Registry teardown antar-navigasi.
//
// Router memanggil runLeave() sebelum merender route baru. Modul UI yang
// memasang listener global (scroll, timer, keyboard) mendaftarkan pembersihnya
// via onLeave() agar tidak terjadi kebocoran memori / listener menumpuk.
// =============================================================================

let callbacks = [];

export function onLeave(fn) {
  if (typeof fn === "function") callbacks.push(fn);
}

export function runLeave() {
  const list = callbacks;
  callbacks = [];
  list.forEach((fn) => {
    try { fn(); } catch { /* noop */ }
  });
}
