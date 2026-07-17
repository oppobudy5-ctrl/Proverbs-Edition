// =============================================================================
// save-actions.js — Tombol bookmark & favorite yang dapat dipakai ulang di
// berbagai section halaman "Hari" (ayat emas, renungan, tantangan, pasal).
// =============================================================================
import { el, toast } from "../dom.js";
import { announce } from "../a11y.js";
import { isBookmarked, toggleBookmark } from "../bookmark.js";
import { isFavorite, toggleFavorite } from "../favorites.js";
import { evaluateAchievements } from "../achievement.js";
import { showAchievements, pulse, burst } from "./celebrate.js";

function afterChange() {
  const newly = evaluateAchievements();
  if (newly.length) showAchievements(newly);
}

export function bookmarkButton({ day, chapter, type, text, label = "Simpan" }) {
  const on = isBookmarked(day, type);
  const btn = el("button", {
    class: "save-btn bookmark-btn" + (on ? " is-on" : ""),
    type: "button",
    "aria-pressed": on ? "true" : "false",
    title: "Bookmark",
    onclick: () => {
      const nowOn = toggleBookmark({ day, chapter, type, text });
      btn.classList.toggle("is-on", nowOn);
      btn.setAttribute("aria-pressed", nowOn ? "true" : "false");
      labelEl.textContent = nowOn ? "Tersimpan" : label;
      if (nowOn) { pulse(btn); toast("Ditambahkan ke bookmark"); afterChange(); }
      else toast("Bookmark dihapus");
      announce(nowOn ? "Ditambahkan ke bookmark" : "Bookmark dihapus");
    },
  }, el("span", { class: "save-ico", "aria-hidden": "true" }, "\u{1F516}"), el("span", { class: "save-label" }, on ? "Tersimpan" : label));
  const labelEl = btn.querySelector(".save-label");
  return btn;
}

export function favoriteButton({ day, chapter, type, text }) {
  const on = isFavorite(type, day);
  const btn = el("button", {
    class: "save-btn fav-btn" + (on ? " is-on" : ""),
    type: "button",
    "aria-pressed": on ? "true" : "false",
    title: "Favorit",
    "aria-label": "Tandai favorit",
    onclick: () => {
      const nowOn = toggleFavorite({ type, day, chapter, text });
      btn.classList.toggle("is-on", nowOn);
      btn.setAttribute("aria-pressed", nowOn ? "true" : "false");
      ico.textContent = nowOn ? "\u2764\uFE0F" : "\u{1F90D}";
      if (nowOn) { pulse(btn); burst(btn); toast("Ditandai favorit"); }
      else toast("Favorit dihapus");
      announce(nowOn ? "Ditandai favorit" : "Favorit dihapus");
    },
  }, el("span", { class: "save-ico", "aria-hidden": "true" }, on ? "\u2764\uFE0F" : "\u{1F90D}"));
  const ico = btn.querySelector(".save-ico");
  return btn;
}
