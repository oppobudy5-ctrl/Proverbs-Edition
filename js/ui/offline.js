// =============================================================================
// offline.js — Indikator "Mode Offline" + isyarat kembali online.
// Konten lokal tetap dapat dibaca; teks paralel daring butuh koneksi.
// =============================================================================
import { announce } from "../a11y.js";

let badge = null;

function ensureBadge() {
  if (badge) return badge;
  badge = document.createElement("div");
  badge.id = "offline-badge";
  badge.className = "offline-badge";
  badge.setAttribute("role", "status");
  badge.innerHTML = '<span class="offline-dot"></span><span class="offline-text"></span>';
  document.body.appendChild(badge);
  return badge;
}

function render(online, transient) {
  const b = ensureBadge();
  const text = b.querySelector(".offline-text");
  if (online) {
    b.classList.remove("is-offline");
    b.classList.toggle("is-online", !!transient);
    text.textContent = "Kembali online";
    if (transient) setTimeout(() => b.classList.remove("show", "is-online"), 2200);
    else b.classList.remove("show");
  } else {
    b.classList.add("show", "is-offline");
    b.classList.remove("is-online");
    text.textContent = "Mode Offline";
  }
}

export function initOffline() {
  if (!navigator.onLine) render(false);
  window.addEventListener("offline", () => { render(false); announce("Mode offline. Konten lokal tetap tersedia."); });
  window.addEventListener("online", () => {
    ensureBadge().classList.add("show");
    render(true, true);
    announce("Kembali online.");
  });
}
