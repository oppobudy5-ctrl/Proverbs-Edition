// =============================================================================
// ai-dialog.js — Dialog AI ringan (reuse pola reader-overlay + focus trap).
// =============================================================================
import { el } from "../dom.js";
import { trapFocus, announce } from "../a11y.js";

/**
 * Buka dialog modal memakai kelas reader yang sudah ada.
 * @returns {{ close: Function, setBody: Function, body: HTMLElement }}
 */
export function openAiDialog({ title, subtitle = "", initialFocus } = {}) {
  const titleId = `ai-dialog-title-${Date.now().toString(36)}`;
  const body = el("div", { class: "reader-body ai-dialog-body", "aria-live": "polite" });
  const closeBtn = el("button", {
    type: "button",
    class: "reader-close",
    title: "Tutup",
    "aria-label": "Tutup dialog AI",
    onclick: close,
  }, "\u2715");

  const modal = el("div", {
    class: "reader-modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": titleId,
  },
    el("div", { class: "reader-head" },
      el("div", { class: "reader-titles" },
        el("h2", { id: titleId }, title),
        subtitle ? el("div", { class: "reader-sub" }, subtitle) : null,
      ),
      closeBtn,
    ),
    body,
  );

  const overlay = el("div", { class: "reader-overlay" }, modal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  let releaseFocus = () => {};
  function close() {
    releaseFocus();
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 180);
  }

  function setBody(...nodes) {
    body.replaceChildren(...nodes.filter(Boolean));
  }

  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));
  releaseFocus = trapFocus(modal, {
    onEscape: close,
    initialFocus: initialFocus || closeBtn,
  });
  announce(title);

  return { close, setBody, body, modal, overlay };
}

export function aiLoading(message = "Memuat\u2026") {
  return el("div", {
    class: "reader-loading",
    role: "status",
    "aria-live": "polite",
  },
    el("span", { class: "reader-spin", "aria-hidden": "true" }),
    message,
  );
}

export function aiError(message) {
  return el("div", { class: "reader-error", role: "alert" },
    el("p", {}, message || "Terjadi kesalahan. Coba lagi."),
  );
}

export function aiAnswerBlock(label, text) {
  return el("div", { class: "journal-ai-answer ai-dialog-answer" },
    label ? el("p", { class: "journal-label" }, label) : null,
    el("div", { class: "journal-ai-body" }, text || "AI tidak mengembalikan teks."),
  );
}

export function extractAiText(result) {
  return String(result?.content || result?.answer || result?.text || "").trim();
}
