// =============================================================================
// router.js — Router hash-less berbasis fungsi (tidak diubah dari perilaku lama).
// Route: home | calendar | about | day.
// =============================================================================
import { $, $$ } from "./dom.js";
import { renderHome, renderDay } from "./ui/day.js";
import { renderCalendar } from "./ui/calendar.js";
import { renderAbout } from "./ui/about.js";
import { renderLibrary } from "./ui/library.js";
import { runLeave } from "./lifecycle.js";

const routes = {
  home: renderHome, calendar: renderCalendar, about: renderAbout,
  day: renderDay, library: renderLibrary,
};

// Dideklarasikan sebagai function declaration (hoisted) agar aman untuk
// import melingkar (day.js / quiz.js / about.js mengimpor `go`).
export function go(route, params) {
  runLeave(); // bersihkan listener runtime dari route sebelumnya
  const fn = routes[route] || renderHome;
  $("#app").innerHTML = "";
  fn(params || {});
  const activeRoute = routes[route] ? route : "home";
  $$(".nav-btn, .bn-btn").forEach((b) => b.classList.toggle("active", b.dataset.route === activeRoute));
  if (route === "home" || route === "day") window.scrollTo({ top: 0, behavior: "smooth" });
}

export function initRouter() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-route]");
    if (!t) return;
    e.preventDefault();
    go(t.dataset.route, t.dataset.day ? { day: +t.dataset.day } : null);
  });
}
