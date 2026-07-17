// =============================================================================
// version-dropdown.js — Dropdown pilih versi Alkitab UTAMA (di hero).
// Lebar terbatas + scroll vertikal; menggantikan <select> bawaan.
// =============================================================================
import { el } from "../dom.js";
import { BIBLE_VERSIONS } from "../versions.js";
import { getMainVersion } from "../store.js";

export function buildVersionDropdown(onPick) {
  const wrap = el("div", { class: "vdrop" });
  const cur = () => BIBLE_VERSIONS.find((v) => v.code === getMainVersion()) || BIBLE_VERSIONS[0];
  const labelEl = el("span", { class: "vdrop-label" }, cur().label);
  const btn = el("button", {
    class: "btn vdrop-trigger",
    type: "button",
    title: "Pilih versi Alkitab",
    "aria-label": "Pilih versi Alkitab",
    "aria-haspopup": "listbox",
    "aria-expanded": "false",
  }, labelEl, el("span", { class: "vdrop-caret" }, "\u25BE"));

  const menu = el("div", { class: "vdrop-menu", role: "listbox" },
    ...BIBLE_VERSIONS.map((v) =>
      el("button", {
        class: "vdrop-opt" + (v.code === getMainVersion() ? " is-sel" : ""),
        type: "button",
        role: "option",
        onclick: (e) => { e.stopPropagation(); close(); onPick(v.code); },
      }, v.label)
    )
  );

  function openMenu() {
    wrap.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    const sel = menu.querySelector(".is-sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
    document.addEventListener("click", onDoc, true);
    document.addEventListener("keydown", onKey);
  }
  function close() {
    wrap.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDoc, true);
    document.removeEventListener("keydown", onKey);
  }
  function onDoc(e) { if (!wrap.contains(e.target)) close(); }
  function onKey(e) { if (e.key === "Escape") close(); }

  btn.onclick = (e) => { e.stopPropagation(); wrap.classList.contains("open") ? close() : openMenu(); };
  wrap.append(btn, menu);
  return wrap;
}
