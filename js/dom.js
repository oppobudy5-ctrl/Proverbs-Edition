// =============================================================================
// dom.js — Helper DOM ringan (tanpa framework).
// =============================================================================

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

// el("div", { class: "x", onclick: fn, html: "<b>hi</b>" }, child, "text", [more])
//
// KEAMANAN: atribut `html` menetapkan innerHTML dan HANYA boleh menerima markup
// tepercaya statis (ikon SVG internal atau hasil `highlight()` yang sudah
// meng-escape teks). JANGAN pernah memasukkan data user/jaringan lewat `html`;
// untuk data dinamis gunakan child text (textContent) yang aman secara default.
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return n;
}

// Pecah teks menjadi paragraf <p> berdasarkan baris kosong ganda.
export function paragraphs(text) {
  if (!text) return [];
  return text.split(/\n\s*\n/).map((p) => el("p", {}, p.trim()));
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
