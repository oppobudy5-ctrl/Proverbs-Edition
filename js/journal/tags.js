// =============================================================================
// tags.js — Saran tag otomatis (dapat diedit pengguna).
// =============================================================================
import { SUGGESTED_TAGS, entrySearchText } from "./schema.js";

const HEURISTICS = Object.freeze([
  { tag: "Hikmat", patterns: [/hikmat/i, /bijak/i, /kebijaksanaan/i] },
  { tag: "Doa", patterns: [/doa/i, /berdoa/i, /permohonan/i] },
  { tag: "Iman", patterns: [/iman/i, /percaya/i, /kepercayaan/i] },
  { tag: "Pengampunan", patterns: [/ampun/i, /pengampunan/i, /maaf/i] },
  { tag: "Kesabaran", patterns: [/sabar/i, /kesabaran/i] },
  { tag: "Keluarga", patterns: [/keluarga/i, /anak/i, /suami/i, /istri/i, /orang\s*tua/i] },
  { tag: "Pekerjaan", patterns: [/kerja/i, /pekerjaan/i, /kantor/i, /usaha/i] },
  { tag: "Syukur", patterns: [/syukur/i, /bersyukur/i, /ucapan\s*syukur/i] },
  { tag: "Pengharapan", patterns: [/harap/i, /pengharapan/i] },
  { tag: "Kasih", patterns: [/kasih/i, /mengasihi/i, /cinta/i] },
  { tag: "Integritas", patterns: [/integritas/i, /jujur/i, /kejujuran/i] },
  { tag: "Kerendahan hati", patterns: [/rendah\s*hati/i, /kerendahan/i] },
]);

export function suggestTags(entryOrText, { limit = 6 } = {}) {
  const text = typeof entryOrText === "string"
    ? entryOrText.toLowerCase()
    : entrySearchText(entryOrText);
  const hits = [];
  HEURISTICS.forEach(({ tag, patterns }) => {
    if (patterns.some((re) => re.test(text))) hits.push(tag);
  });
  const existing = new Set(
    (typeof entryOrText === "object" && entryOrText?.tags ? entryOrText.tags : [])
      .map((t) => String(t).toLowerCase()),
  );
  return hits.filter((tag) => !existing.has(tag.toLowerCase())).slice(0, limit);
}

export function mergeTags(current = [], suggested = []) {
  const seen = new Set();
  const out = [];
  [...current, ...suggested].forEach((tag) => {
    const text = String(tag || "").trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}

export function allSuggestedTags() {
  return [...SUGGESTED_TAGS];
}
