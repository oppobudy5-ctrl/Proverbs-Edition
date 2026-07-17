// =============================================================================
// version-dropdown.js — Dropdown pilih versi Alkitab UTAMA (di hero).
// Lebar terbatas + scroll vertikal; menggantikan <select> bawaan.
// Aksesibel: listbox + panah keyboard + Escape + fokus restorasi.
// =============================================================================
import { el } from "../dom.js";
import { BIBLE_VERSIONS } from "../versions.js";
import { getMainVersion } from "../store.js";
import { restoreFocus } from "../a11y.js";

export function buildVersionDropdown(onPick) {
  const wrap = el("div", { class: "vdrop" });
  const cur = () => BIBLE_VERSIONS.find((v) => v.code === getMainVersion()) || BIBLE_VERSIONS[0];
  const labelEl = el("span", { class: "vdrop-label" }, cur().label);
  const listId = `vdrop-list-${Math.random().toString(36).slice(2, 8)}`;
  const btn = el("button", {
    class: "btn vdrop-trigger",
    type: "button",
    title: "Pilih versi Alkitab",
    "aria-label": "Pilih versi Alkitab",
    "aria-haspopup": "listbox",
    "aria-expanded": "false",
    "aria-controls": listId,
  }, labelEl, el("span", { class: "vdrop-caret", "aria-hidden": "true" }, "\u25BE"));

  const options = BIBLE_VERSIONS.map((v, index) => {
    const opt = el("button", {
      class: "vdrop-opt" + (v.code === getMainVersion() ? " is-sel" : ""),
      type: "button",
      role: "option",
      id: `${listId}-opt-${index}`,
      "aria-selected": v.code === getMainVersion() ? "true" : "false",
      onclick: (e) => { e.stopPropagation(); pick(v.code); },
    }, v.label);
    return opt;
  });

  const menu = el("div", {
    class: "vdrop-menu",
    role: "listbox",
    id: listId,
    "aria-label": "Versi Alkitab",
  }, ...options);

  function syncSelection() {
    const code = getMainVersion();
    options.forEach((opt, i) => {
      const selected = BIBLE_VERSIONS[i].code === code;
      opt.classList.toggle("is-sel", selected);
      opt.setAttribute("aria-selected", selected ? "true" : "false");
    });
    labelEl.textContent = cur().label;
  }

  function openMenu() {
    wrap.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    syncSelection();
    const sel = menu.querySelector(".is-sel") || options[0];
    if (sel) {
      requestAnimationFrame(() => {
        restoreFocus(sel);
        sel.scrollIntoView({ block: "nearest" });
      });
    }
    document.addEventListener("click", onDoc, true);
    document.addEventListener("keydown", onKey, true);
  }

  function close() {
    if (!wrap.classList.contains("open")) return;
    wrap.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDoc, true);
    document.removeEventListener("keydown", onKey, true);
    restoreFocus(btn);
  }

  function pick(code) {
    close();
    onPick(code);
    syncSelection();
  }

  function onDoc(e) { if (!wrap.contains(e.target)) close(); }

  function onKey(e) {
    if (!wrap.classList.contains("open")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const current = options.indexOf(document.activeElement);
      let next = current < 0 ? 0 : current;
      if (e.key === "ArrowDown") next = (current + 1) % options.length;
      else if (e.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = options.length - 1;
      restoreFocus(options[next]);
      options[next].scrollIntoView({ block: "nearest" });
    }
  }

  btn.onclick = (e) => {
    e.stopPropagation();
    wrap.classList.contains("open") ? close() : openMenu();
  };
  wrap.append(btn, menu);
  return wrap;
}
