// =============================================================================
// versions.js — Konstanta versi Alkitab & tata letak reader.
// =============================================================================

// Versi utama yang bisa dipilih di dropdown hero (kode = parameter SABDA).
export const BIBLE_VERSIONS = [
  { code: "tb", label: "TB" },
  { code: "nkjv", label: "NKJV" },
  { code: "niv", label: "NIV" },
  { code: "kjv", label: "KJV" },
  { code: "amp", label: "AMP" },
  { code: "bimk", label: "BIMK" },
  { code: "jawa", label: "Jawa" },
  { code: "bali", label: "Bali" },
  { code: "sunda", label: "Sunda" },
  { code: "toba", label: "Batak" },
];

// Versi pendamping (kolom kedua) pada popup baca paralel.
export const COMPANION_VERSIONS = [
  { code: "nkjv", label: "NKJV" },
  { code: "niv", label: "NIV" },
  { code: "kjv", label: "KJV" },
  { code: "amp", label: "AMP" },
  { code: "bimk", label: "BIMK" },
  { code: "jawa", label: "Jawa" },
  { code: "bali", label: "Bali" },
  { code: "sunda", label: "Sunda" },
  { code: "toba", label: "Batak" },
];

// Versi yang teksnya tersedia via API proxy (untuk baca paralel di dalam app).
export const TEXT_API_VERSIONS = new Set(["tb", "nkjv", "niv", "kjv", "amp", "jawa", "bali", "sunda", "toba"]);

// Pemetaan kode versi -> kode versi SABDA (untuk tautan diglot).
export const SABDA_VER = {
  tb: "TB", nkjv: "NKJV", niv: "NIV", kjv: "KJV", amp: "AMP",
  bimk: "BIS", jawa: "JAWA2006", bali: "BALI", sunda: "SUNDA", toba: "TOBA",
};

export const READER_LAYOUTS = [
  { id: "interleave", label: "Berselang" },
  { id: "cols", label: "2 kolom" },
];

export const DEFAULT_MAIN_VERSION = "tb";
export const DEFAULT_SECONDARY_VERSION = "nkjv";
