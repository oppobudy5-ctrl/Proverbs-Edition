// =============================================================================
// router.js — SPA router dengan History API (PR-004).
// Route: home | calendar | about | day | library.
// Public API tetap: go(route, params), initRouter().
// =============================================================================
import { $, $$ } from "./dom.js";
import { renderHome, renderDay } from "./ui/day.js";
import { renderCalendar } from "./ui/calendar.js";
import { renderAbout } from "./ui/about.js";
import { renderLibrary } from "./ui/library.js";
import { renderBibleCompanion } from "./ui/bible-companion.js";
import { runLeave } from "./lifecycle.js";
import { announce } from "./a11y.js";
import { planCount } from "./plan.js";

const BASE_TITLE = "Bible Time Bible Companion";

const ROUTE_META = Object.freeze({
  home: Object.freeze({ id: "home", path: "/", title: "Hari Ini" }),
  calendar: Object.freeze({ id: "calendar", path: "/calendar", title: "Kalender" }),
  library: Object.freeze({ id: "library", path: "/library", title: "Koleksi" }),
  about: Object.freeze({ id: "about", path: "/about", title: "Tentang" }),
  day: Object.freeze({ id: "day", path: "/lesson/:day", title: "Bacaan" }),
  companion: Object.freeze({ id: "companion", path: "/companion/:book/:chapter", title: "Bible Companion" }),
});

const routes = {
  home: renderHome,
  calendar: renderCalendar,
  about: renderAbout,
  day: renderDay,
  library: renderLibrary,
  companion: renderBibleCompanion,
};

let initialized = false;
let navigating = false;
let current = Object.freeze({ route: "home", params: Object.freeze({}) });

/**
 * Bangun path URL dari route + params. Diekspor untuk pengujian.
 */
export function buildPath(route, params = {}) {
  const id = routes[route] ? route : "home";
  if (id === "day") {
    const day = normalizeDay(params.day);
    return day ? `/lesson/${day}` : "/";
  }
  if (id === "companion") {
    const book = normalizeBook(params.book) || "proverbs";
    const chapter = normalizePositiveInt(params.chapter) || 1;
    return `/companion/${encodeURIComponent(book)}/${chapter}`;
  }
  if (id === "home") return "/";
  return ROUTE_META[id]?.path || "/";
}

/**
 * Parse pathname → { route, params }. Unknown → home (aman).
 */
export function parsePath(pathname = "/") {
  let path = String(pathname || "/").split("?")[0].split("#")[0] || "/";
  try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  path = path.replace(/\/+$/, "") || "/";

  if (path === "/" || path === "/home" || path === "/index.html") {
    return { route: "home", params: {} };
  }
  if (path === "/calendar") return { route: "calendar", params: {} };
  if (path === "/library" || path === "/journal" || path === "/bookmark" || path === "/bookmarks") {
    return { route: "library", params: {} };
  }
  if (path === "/about" || path === "/profile") return { route: "about", params: {} };

  const lesson = path.match(/^\/(?:lesson|day)\/(\d{1,2})$/i);
  if (lesson) {
    const day = normalizeDay(lesson[1]);
    if (day) return { route: "day", params: { day } };
  }

  const companion = path.match(/^\/companion\/([a-z0-9-]+)(?:\/(\d{1,3}))?$/i);
  if (companion) {
    return {
      route: "companion",
      params: {
        book: normalizeBook(companion[1]) || "proverbs",
        chapter: normalizePositiveInt(companion[2]) || 1,
      },
    };
  }

  return { route: "home", params: {} };
}

export function getCurrentRoute() {
  return current;
}

export function getRouteMeta(route) {
  return ROUTE_META[route] || ROUTE_META.home;
}

/**
 * Navigasi SPA. Kompatibel dengan pemanggilan lama: go(route, params).
 * options.replace — replaceState; options.skipHistory — untuk popstate.
 */
export function go(route, params, options = {}) {
  if (navigating) return;
  navigating = true;
  try {
    const requested = String(route || "home");
    const safeRoute = routes[requested] ? requested : "home";
    const nextParams = normalizeParams(safeRoute, params || {});
    const fn = routes[safeRoute] || renderHome;

    runLeave();
    const app = $("#app");
    if (app) app.innerHTML = "";
    fn(nextParams);

    current = Object.freeze({
      route: safeRoute,
      params: Object.freeze({ ...nextParams }),
    });

    syncActiveNav(safeRoute);
    updateDocumentTitle(safeRoute, nextParams);
    restoreScroll(safeRoute, nextParams);
    focusMainContent(safeRoute, nextParams);
    syncHistory(safeRoute, nextParams, options);
  } finally {
    navigating = false;
  }
}

export function initRouter() {
  if (initialized) return;
  initialized = true;

  if (typeof history !== "undefined" && "scrollRestoration" in history) {
    try { history.scrollRestoration = "manual"; } catch { /* noop */ }
  }

  document.addEventListener("click", onRouteClick);

  if (historySupported()) {
    window.addEventListener("popstate", onPopState);
  }

  // Boot dari URL saat ini (deep link / refresh) atau home.
  const boot = parsePath(currentPathname());
  go(boot.route, boot.params, { replace: true, skipHistory: false, boot: true });
}

function onRouteClick(e) {
  const t = e.target.closest("[data-route]");
  if (!t) return;
  // Biarkan klik termodifikasi (tab baru, dll.) berjalan normal bila ada href.
  if (e.defaultPrevented) return;
  if (e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const route = t.dataset.route;
  const params = t.dataset.day
    ? { day: Number(t.dataset.day) }
    : (t.dataset.book
        ? { book: t.dataset.book, chapter: Number(t.dataset.chapter) || 1 }
        : {});
  go(route, params);
}

function onPopState(event) {
  const state = event.state;
  if (state && state.route && routes[state.route]) {
    go(state.route, state.params || {}, { skipHistory: true });
    return;
  }
  const parsed = parsePath(currentPathname());
  go(parsed.route, parsed.params, { skipHistory: true });
}

function syncHistory(route, params, options = {}) {
  if (options.skipHistory) return;
  if (!historySupported()) return;

  const path = buildPath(route, params);
  const state = { route, params };
  const currentFull = `${location.pathname}${location.search}` || "/";
  const same = normalizeComparePath(currentFull) === normalizeComparePath(path);

  try {
    if (options.replace || options.boot || same) {
      history.replaceState(state, "", path);
    } else {
      history.pushState(state, "", path);
    }
  } catch {
    // History bisa gagal di beberapa konteks sandboxed — navigasi in-app tetap jalan.
  }
}

function syncActiveNav(activeRoute) {
  $$(".nav-btn, .bn-btn, .footer-nav-btn[data-route]").forEach((b) => {
    const isActive = b.dataset.route === activeRoute;
    b.classList.toggle("active", isActive);
    if (isActive) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

function updateDocumentTitle(route, params) {
  let label = ROUTE_META[route]?.title || "Bible Time";
  if (route === "day" && params.day) label = `Amsal ${params.day}`;
  if (route === "companion" && params.book) label = `Bible Companion · ${params.book} ${params.chapter || 1}`;
  document.title = `${label} — ${BASE_TITLE}`;
}

function restoreScroll(route, params) {
  // Pertahankan perilaku lama: scroll ke atas untuk home/day.
  if (route === "home" || route === "day") {
    if (params.resume) return; // day-runtime menangani scroll resume
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function focusMainContent(route, params) {
  const app = $("#app");
  if (!app) return;
  if (!app.hasAttribute("tabindex")) app.setAttribute("tabindex", "-1");
  // Hindari mencuri fokus saat boot pertama (bisa ganggu screen reader).
  if (!document.body.dataset.routerReady) {
    document.body.dataset.routerReady = "1";
  } else {
    try { app.focus({ preventScroll: true }); } catch { try { app.focus(); } catch { /* noop */ } }
  }
  const label = route === "day" && params.day
    ? `Amsal ${params.day}`
    : route === "companion" && params.book
      ? `Bible Companion ${params.book} ${params.chapter || 1}`
    : (ROUTE_META[route]?.title || "Halaman");
  announce(`${label}`);
}

function normalizeParams(route, params) {
  if (route === "companion") {
    return {
      book: normalizeBook(params?.book) || "proverbs",
      chapter: normalizePositiveInt(params?.chapter) || 1,
    };
  }
  if (route !== "day") return { ...(params || {}) };
  const day = normalizeDay(params.day);
  const next = { ...(params || {}) };
  if (day) next.day = day;
  else delete next.day;
  return next;
}

function normalizeBook(value) {
  const book = String(value || "").trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(book) ? book : null;
}

function normalizePositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeDay(value) {
  const day = Number(value);
  if (!Number.isInteger(day)) return null;
  const max = typeof planCount === "function" ? planCount() : 31;
  if (day < 1 || day > max) return null;
  return day;
}

function historySupported() {
  return (
    typeof window !== "undefined" &&
    typeof history !== "undefined" &&
    typeof history.pushState === "function" &&
    typeof history.replaceState === "function" &&
    location.protocol !== "file:"
  );
}

function currentPathname() {
  try { return location.pathname || "/"; } catch { return "/"; }
}

function normalizeComparePath(path) {
  const bare = String(path || "/").split("?")[0].split("#")[0];
  return bare.replace(/\/+$/, "") || "/";
}
