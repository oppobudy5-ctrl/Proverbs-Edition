// =============================================================================
// settings-panel.js — Drawer preferensi membaca: reading mode, tema, tipografi.
// =============================================================================
import { el } from "../dom.js";
import { trapFocus, announce } from "../a11y.js";
import {
  getSettings, updateSettings, toggleReadingMode,
  FONT_SIZES, LINE_HEIGHTS, COMFORT_WIDTHS, FONT_FAMILIES,
} from "../settings.js";
import { THEMES, getTheme, setTheme } from "../theme.js";

let openEl = null;

function segmented({ options, activeId, getId = (o) => o.id, getLabel = (o) => o.label, onPick, ariaLabel }) {
  const group = el("div", { class: "seg", role: "group", "aria-label": ariaLabel });
  const btns = [];
  options.forEach((opt) => {
    const id = getId(opt);
    const btn = el("button", {
      type: "button",
      class: "seg-btn" + (id === activeId ? " is-active" : ""),
      "aria-pressed": id === activeId ? "true" : "false",
      onclick: () => {
        btns.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-pressed", "false"); });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        onPick(id);
      },
    }, getLabel(opt));
    btns.push(btn);
    group.append(btn);
  });
  return group;
}

function field(label, control) {
  return el("div", { class: "sp-field" }, el("div", { class: "sp-label" }, label), control);
}

export function openSettingsPanel() {
  if (openEl) return;
  const s = getSettings();

  const readingToggle = el("button", {
    class: "sp-toggle" + (s.readingMode ? " is-on" : ""),
    type: "button",
    role: "switch",
    "aria-checked": s.readingMode ? "true" : "false",
    onclick: () => {
      const on = toggleReadingMode();
      readingToggle.classList.toggle("is-on", on);
      readingToggle.setAttribute("aria-checked", on ? "true" : "false");
      announce(on ? "Mode baca aktif" : "Mode baca nonaktif");
    },
  }, el("span", { class: "sp-toggle-track" }, el("span", { class: "sp-toggle-thumb" })));

  const themeGrid = el("div", { class: "theme-grid", role: "group", "aria-label": "Pilih tema" });
  const themeBtns = [];
  THEMES.forEach((t) => {
    const btn = el("button", {
      type: "button",
      class: "theme-chip" + (t.id === getTheme() ? " is-active" : ""),
      "aria-pressed": t.id === getTheme() ? "true" : "false",
      title: t.hint,
      onclick: () => {
        themeBtns.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-pressed", "false"); });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        setTheme(t.id);
        announce("Tema " + t.label);
      },
    },
      el("span", { class: "theme-swatch", style: `background:${t.swatch}` }),
      el("span", { class: "theme-name" }, t.label)
    );
    themeBtns.push(btn);
    themeGrid.append(btn);
  });

  const body = el("div", { class: "sp-body" },
    el("div", { class: "sp-row" },
      el("div", {},
        el("div", { class: "sp-label" }, "Mode Baca"),
        el("div", { class: "sp-hint" }, "Sembunyikan distraksi, fokus penuh pada teks.")
      ),
      readingToggle
    ),
    field("Tema", themeGrid),
    field("Ukuran huruf", segmented({
      options: FONT_SIZES, activeId: s.fontSize, ariaLabel: "Ukuran huruf",
      onPick: (id) => updateSettings({ fontSize: id }),
    })),
    field("Tinggi baris", segmented({
      options: LINE_HEIGHTS, activeId: s.lineHeight, ariaLabel: "Tinggi baris",
      onPick: (id) => updateSettings({ lineHeight: id }),
    })),
    field("Lebar teks", segmented({
      options: COMFORT_WIDTHS, activeId: s.comfortWidth, ariaLabel: "Lebar area teks",
      onPick: (id) => updateSettings({ comfortWidth: id }),
    })),
    field("Jenis huruf", segmented({
      options: FONT_FAMILIES, activeId: s.fontFamily, ariaLabel: "Jenis huruf",
      onPick: (id) => updateSettings({ fontFamily: id }),
    }))
  );

  const closeBtn = el("button", { class: "sp-close", type: "button", "aria-label": "Tutup pengaturan", onclick: close }, "\u2715");
  const panel = el("div", { class: "sp-panel", role: "dialog", "aria-modal": "true", "aria-label": "Pengaturan membaca" },
    el("div", { class: "sp-head" }, el("h2", {}, "Pengaturan Membaca"), closeBtn),
    body
  );
  const overlay = el("div", { class: "sp-overlay" }, panel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  let release = () => {};
  function close() {
    if (!openEl) return;
    release();
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
    openEl = null;
  }

  document.body.append(overlay);
  openEl = overlay;
  requestAnimationFrame(() => overlay.classList.add("show"));
  release = trapFocus(panel, { onEscape: close });
}
