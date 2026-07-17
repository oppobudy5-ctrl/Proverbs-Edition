// =============================================================================
// security.js — Utilitas keamanan frontend bersama (Security Baseline).
//
// Prinsip: Default Safe, Escape Before Render, Validate Before Use, Fail Safe.
// Semua modul yang perlu escape/sanitasi/validasi URL WAJIB memakai helper ini
// agar konsisten dan tidak ada duplikasi.
// =============================================================================

const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Escape karakter HTML sensitif sebelum dirender ke markup.
export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
}

// Normalisasi teks: buang karakter kontrol, batasi panjang. Aman untuk
// textContent (tidak pernah dieksekusi sebagai HTML). Fail safe → string.
export function sanitizeString(value, { maxLength = 10000, allowNewlines = true } = {}) {
  try {
    let text = String(value ?? "");
    text = allowNewlines
      ? text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      : text.replace(/[\u0000-\u001F\u007F]/g, "");
    if (Number.isFinite(maxLength) && text.length > maxLength) {
      text = text.slice(0, maxLength);
    }
    return text;
  } catch {
    return "";
  }
}

// Teks aman untuk ditampilkan sebagai konten (tetap sebagai text, bukan HTML).
export function safeText(value) {
  return sanitizeString(value);
}

// Protokol yang dianggap aman untuk href/navigasi.
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function isSafeProtocol(url) {
  const raw = String(url ?? "").trim();
  if (raw === "") return false;
  // Anchor internal & path relatif tidak punya skema berbahaya.
  if (raw.startsWith("#") || raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) {
    return true;
  }
  try {
    const parsed = new URL(raw, "https://localhost/");
    return SAFE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

// Kembalikan URL bila aman, jika tidak kembalikan null (Fail Safe).
export function validateURL(url) {
  const raw = String(url ?? "").trim();
  if (raw === "") return null;
  // Skema berbahaya eksplisit ditolak lebih dulu.
  if (/^\s*(javascript|data|vbscript|file|blob):/i.test(raw)) return null;
  return isSafeProtocol(raw) ? raw : null;
}

// Versi fail-safe: selalu mengembalikan string yang layak dipakai di href.
export function safeURL(url, fallback = "#") {
  return validateURL(url) ?? fallback;
}
