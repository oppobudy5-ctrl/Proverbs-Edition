// =============================================================================
// settings.js — Preferensi membaca (tipografi + reading mode).
//
// Semua nilai disimpan di localStorage dan diterapkan sebagai CSS custom
// properties / atribut pada <html> sehingga berlaku global tanpa render ulang.
// =============================================================================
import { readJSON, writeJSON, emitChange } from "./safe-store.js";

const SETTINGS_KEY = "bibleTime.readerSettings.v3";

export const FONT_SIZES = [
  { id: "sm", label: "Kecil", scale: 0.92 },
  { id: "md", label: "Sedang", scale: 1 },
  { id: "lg", label: "Besar", scale: 1.12 },
  { id: "xl", label: "Ekstra", scale: 1.26 },
];

export const LINE_HEIGHTS = [
  { id: "tight", label: "Rapat", value: 1.55 },
  { id: "normal", label: "Normal", value: 1.75 },
  { id: "relaxed", label: "Lega", value: 1.95 },
];

export const COMFORT_WIDTHS = [
  { id: "narrow", label: "Sempit", value: 620 },
  { id: "medium", label: "Sedang", value: 720 },
  { id: "wide", label: "Lebar", value: 860 },
];

export const FONT_FAMILIES = [
  { id: "serif", label: "Serif", stack: '"Cormorant Garamond", "Times New Roman", serif' },
  { id: "sans", label: "Sans", stack: '"Plus Jakarta Sans", system-ui, sans-serif' },
];

const DEFAULTS = {
  fontSize: "md",
  lineHeight: "normal",
  comfortWidth: "medium",
  fontFamily: "sans",
  readingMode: false,
};

let current = null;

export function getSettings() {
  if (!current) current = { ...DEFAULTS, ...readJSON(SETTINGS_KEY, {}) };
  return { ...current };
}

export function updateSettings(patch) {
  current = { ...getSettings(), ...patch };
  writeJSON(SETTINGS_KEY, current);
  applySettings();
  emitChange("settings", { settings: { ...current } });
  return { ...current };
}

export function toggleReadingMode(force) {
  const next = typeof force === "boolean" ? force : !getSettings().readingMode;
  updateSettings({ readingMode: next });
  return next;
}

const byId = (list, id) => list.find((x) => x.id === id) || list[0];

export function applySettings() {
  const s = getSettings();
  const root = document.documentElement;
  root.style.setProperty("--reader-scale", String(byId(FONT_SIZES, s.fontSize).scale));
  root.style.setProperty("--reader-leading", String(byId(LINE_HEIGHTS, s.lineHeight).value));
  root.style.setProperty("--reader-measure", byId(COMFORT_WIDTHS, s.comfortWidth).value + "px");
  root.style.setProperty("--reader-font", byId(FONT_FAMILIES, s.fontFamily).stack);
  root.setAttribute("data-reading-mode", s.readingMode ? "on" : "off");
}

export function initSettings() {
  applySettings();
}
