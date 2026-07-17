// =============================================================================
// a11y.js — Utilitas aksesibilitas: focus trap, live region, skip link.
// Target: fondasi WCAG 2.2 AA (keyboard, focus, screen reader).
// =============================================================================
import { $ } from "./dom.js";

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function getFocusableElements(container = document) {
  if (!container || typeof container.querySelectorAll !== "function") return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false;
    // Elemen tersembunyi (display:none / hidden) tidak boleh menerima fokus.
    if (el.closest("[hidden]")) return false;
    const style = typeof window !== "undefined" && window.getComputedStyle
      ? window.getComputedStyle(el)
      : null;
    if (style && (style.visibility === "hidden" || style.display === "none")) return false;
    return el.offsetParent !== null || el === document.activeElement || el.getClientRects().length > 0;
  });
}

/** Kembalikan fokus ke elemen sebelumnya secara aman. */
export function restoreFocus(element) {
  if (!element || typeof element.focus !== "function") return false;
  try {
    element.focus({ preventScroll: true });
    return true;
  } catch {
    try {
      element.focus();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Pasang focus trap pada container (modal/dialog).
 * Mengembalikan fungsi release yang juga memanggil restoreFocus.
 */
export function trapFocus(container, { onEscape, initialFocus } = {}) {
  const previouslyFocused = document.activeElement;

  function focusables() {
    return getFocusableElements(container);
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (typeof onEscape === "function") onEscape();
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusables();
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  container.addEventListener("keydown", onKey);

  const preferred = initialFocus && container.contains(initialFocus)
    ? initialFocus
    : focusables()[0];
  if (preferred) requestAnimationFrame(() => restoreFocus(preferred));

  return function release() {
    container.removeEventListener("keydown", onKey);
    restoreFocus(previouslyFocused);
  };
}

/** Umumkan pesan ke pembaca layar tanpa memindahkan fokus. */
export function announce(message, { polite = true } = {}) {
  const text = String(message || "").trim();
  if (!text) return;
  let region = $("#a11y-live");
  if (!region) {
    region = document.createElement("div");
    region.id = "a11y-live";
    region.setAttribute("aria-live", polite ? "polite" : "assertive");
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    document.body.appendChild(region);
  } else {
    region.setAttribute("aria-live", polite ? "polite" : "assertive");
  }
  region.textContent = "";
  requestAnimationFrame(() => { region.textContent = text; });
}

/** Skip-to-content link (dibuat sekali). */
export function installSkipLink() {
  if ($("#skip-to-content")) return;
  const link = document.createElement("a");
  link.id = "skip-to-content";
  link.className = "skip-link";
  link.href = "#app";
  link.textContent = "Lewati ke konten utama";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const app = $("#app");
    if (!app) return;
    app.setAttribute("tabindex", "-1");
    restoreFocus(app);
  });
  document.body.insertBefore(link, document.body.firstChild);
}
