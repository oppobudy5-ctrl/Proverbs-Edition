// =============================================================================
// theme.js — Manajemen tema tampilan.
//
// Pilihan tema: system | dark | light | sepia | warm | night.
// - "system" mengikuti prefers-color-scheme (dark/light) secara live.
// - Tema diterapkan sebagai atribut data-theme pada <html> sehingga CSS dapat
//   mengganti token warna dengan transisi halus.
// =============================================================================
import { readJSON, writeJSON, emitChange } from "./safe-store.js";

const THEME_KEY = "bibleTime.theme.v3";

export const THEMES = [
  { id: "system", label: "Sistem", hint: "Ikuti perangkat", swatch: "linear-gradient(135deg,#0b0d12 50%,#f5ecd2 50%)" },
  { id: "dark", label: "Gelap", hint: "Sapphire malam", swatch: "linear-gradient(135deg,#0b0d12,#1a2240)" },
  { id: "light", label: "Terang", hint: "Bersih & lembut", swatch: "linear-gradient(135deg,#f7f4ec,#e7e0cf)" },
  { id: "sepia", label: "Sepia", hint: "Hangat klasik", swatch: "linear-gradient(135deg,#f1e2c4,#d8bf95)" },
  { id: "warm", label: "Warm Paper", hint: "Kertas krem", swatch: "linear-gradient(135deg,#f6ecd6,#e3cfa6)" },
  { id: "night", label: "Night Reading", hint: "Kontras rendah", swatch: "linear-gradient(135deg,#05060a,#12161f)" },
];

const VALID = new Set(THEMES.map((t) => t.id));
const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;

export function getTheme() {
  const value = readJSON(THEME_KEY, "dark");
  return VALID.has(value) ? value : "dark";
}

export function resolveTheme(theme = getTheme()) {
  if (theme === "system") return media && media.matches ? "light" : "dark";
  return theme;
}

export function applyTheme(theme = getTheme()) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-choice", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[resolved] || "#0b0d12");
}

export function setTheme(theme) {
  if (!VALID.has(theme)) return;
  writeJSON(THEME_KEY, theme);
  // transisi warna sesaat agar pergantian tema terasa halus
  const root = document.documentElement;
  root.classList.add("theme-anim");
  applyTheme(theme);
  window.clearTimeout(setTheme._t);
  setTheme._t = window.setTimeout(() => root.classList.remove("theme-anim"), 320);
  emitChange("theme", { theme });
}

const THEME_COLORS = {
  dark: "#0b0d12",
  light: "#f2ecdd",
  sepia: "#e9d8b5",
  warm: "#efe2c6",
  night: "#05060a",
};

export function initTheme() {
  applyTheme();
  if (media) {
    const onChange = () => { if (getTheme() === "system") applyTheme("system"); };
    if (media.addEventListener) media.addEventListener("change", onChange);
    else if (media.addListener) media.addListener(onChange);
  }
}
