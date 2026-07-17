// =============================================================================
// celebrate.js — Umpan balik pencapaian & micro-interaction.
//
// showAchievements() memunculkan kartu "achievement unlocked" berurutan.
// pulse()/burst() adalah micro-interaction ringan yang menghormati
// prefers-reduced-motion.
// =============================================================================
import { el } from "../dom.js";
import { announce } from "../a11y.js";

const reduceMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let queue = [];
let showing = false;

export function showAchievements(list) {
  if (!list || !list.length) return;
  queue = queue.concat(list);
  if (!showing) next();
}

function next() {
  if (!queue.length) { showing = false; return; }
  showing = true;
  const a = queue.shift();
  announce(`Pencapaian terbuka: ${a.title}`);

  const card = el("div", { class: "ach-pop", role: "status" },
    el("span", { class: "ach-pop-icon" }, a.icon),
    el("div", { class: "ach-pop-body" },
      el("div", { class: "ach-pop-eyebrow" }, "Pencapaian terbuka"),
      el("div", { class: "ach-pop-title" }, a.title),
      el("div", { class: "ach-pop-desc" }, a.desc)
    )
  );
  document.body.append(card);
  requestAnimationFrame(() => card.classList.add("show"));
  const hold = reduceMotion() ? 1600 : 2600;
  setTimeout(() => {
    card.classList.remove("show");
    setTimeout(() => { card.remove(); next(); }, 240);
  }, hold);
}

// Denyut kecil pada elemen (mis. tombol bookmark/favorite saat aktif).
export function pulse(node) {
  if (!node || reduceMotion()) return;
  node.classList.remove("mi-pulse");
  void node.offsetWidth; // reflow untuk mengulang animasi
  node.classList.add("mi-pulse");
}

// Percikan bintang kecil di sekitar elemen (favorite/challenge selesai).
export function burst(node) {
  if (!node || reduceMotion()) return;
  const rect = node.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 6; i++) {
    const s = el("span", { class: "mi-spark" }, "\u2726");
    const angle = (Math.PI * 2 * i) / 6;
    s.style.left = cx + "px";
    s.style.top = cy + "px";
    s.style.setProperty("--dx", Math.cos(angle) * 26 + "px");
    s.style.setProperty("--dy", Math.sin(angle) * 26 + "px");
    document.body.append(s);
    setTimeout(() => s.remove(), 620);
  }
}
