// =============================================================================
// a11y.js — Utilitas aksesibilitas: focus trap, region ARIA-live, skip link.
// =============================================================================
import { $ } from "./dom.js";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", '[tabindex]:not([tabindex="-1"])',
].join(",");

// Pasang focus trap pada sebuah container overlay. Mengembalikan fungsi release.
export function trapFocus(container, { onEscape } = {}) {
  const previouslyFocused = document.activeElement;

  function focusables() {
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }

  function onKey(e) {
    if (e.key === "Escape") { onEscape && onEscape(); return; }
    if (e.key !== "Tab") return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  container.addEventListener("keydown", onKey);
  const first = focusables()[0];
  if (first) requestAnimationFrame(() => first.focus());

  return function release() {
    container.removeEventListener("keydown", onKey);
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
  };
}

// Umumkan pesan ke pembaca layar tanpa memindahkan fokus.
export function announce(message) {
  let region = $("#a11y-live");
  if (!region) {
    region = document.createElement("div");
    region.id = "a11y-live";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    document.body.appendChild(region);
  }
  region.textContent = "";
  requestAnimationFrame(() => { region.textContent = message; });
}

// Skip-to-content link (dibuat sekali).
export function installSkipLink() {
  if ($("#skip-to-content")) return;
  const link = document.createElement("a");
  link.id = "skip-to-content";
  link.className = "skip-link";
  link.href = "#app";
  link.textContent = "Lewati ke konten";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const app = $("#app");
    if (app) { app.setAttribute("tabindex", "-1"); app.focus(); }
  });
  document.body.insertBefore(link, document.body.firstChild);
}
