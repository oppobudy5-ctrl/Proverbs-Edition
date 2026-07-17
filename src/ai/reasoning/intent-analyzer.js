import { normalizeText } from "../ai-utils.js";

export const BIBLICAL_INTENTS = Object.freeze({
  MEANING: "meaning",
  APPLICATION: "application",
  REFLECTION: "reflection",
  DOCTRINE: "doctrine",
  HISTORICAL: "historical",
  CHARACTER: "character",
  PLACE: "place",
  PROMISE: "promise",
  WARNING: "warning",
  COMMAND: "command",
  PRAYER: "prayer",
  WISDOM: "wisdom",
  CROSS_REFERENCE: "cross_reference",
  TIMELINE: "timeline",
  PROPHECY: "prophecy",
  THEME: "theme",
  GENERAL: "general",
});

const RULES = Object.freeze([
  [BIBLICAL_INTENTS.CROSS_REFERENCE, /\b(referensi silang|ayat (?:lain|terkait|pendukung)|hubungan antar ayat|cross[- ]?reference|lihat juga)\b/i],
  [BIBLICAL_INTENTS.HISTORICAL, /\b(sejarah|latar belakang|konteks historis|penulis|pembaca|audience|budaya|zaman)\b/i],
  [BIBLICAL_INTENTS.TIMELINE, /\b(kapan|urutan waktu|garis waktu|timeline|kronologi|masa pemerintahan)\b/i],
  [BIBLICAL_INTENTS.PROPHECY, /\b(nubuat|profesi|penggenapan|mesias|akhir zaman|prophecy|prophetic)\b/i],
  [BIBLICAL_INTENTS.DOCTRINE, /\b(doktrin|teologi|keselamatan|tritunggal|dosa|anugerah|pembenaran|pengudusan|kebangkitan)\b/i],
  [BIBLICAL_INTENTS.PRAYER, /\b(doa|berdoa|doakan|prayer)\b/i],
  [BIBLICAL_INTENTS.PROMISE, /\b(janji|promise|pengharapan yang dijanjikan)\b/i],
  [BIBLICAL_INTENTS.WARNING, /\b(peringatan|larangan|bahaya|waspada|warning|jangan)\b/i],
  [BIBLICAL_INTENTS.COMMAND, /\b(perintah|ketaatan|harus kulakukan|diperintahkan|command)\b/i],
  [BIBLICAL_INTENTS.PLACE, /\b(tempat|lokasi|di mana|dimana|kota|negeri|gunung|sungai)\b/i],
  [BIBLICAL_INTENTS.CHARACTER, /\b(studi karakter|character study|siapa|tokoh|karakter|orang bernama|raja|nabi|rasul)\b/i],
  [BIBLICAL_INTENTS.REFLECTION, /\b(refleksi|renungan|merenungkan|reflection)\b/i],
  [BIBLICAL_INTENTS.APPLICATION, /\b(terapkan|penerapan|aplikasi|praktik|lakukan|kehidupan sehari|langkah nyata)\b/i],
  [BIBLICAL_INTENTS.WISDOM, /\b(hikmat|bijak|keputusan|nasihat|discernment|kebijaksanaan)\b/i],
  [BIBLICAL_INTENTS.THEME, /\b(tema|gagasan utama|benang merah|topik utama|theme)\b/i],
  [BIBLICAL_INTENTS.MEANING, /\b(arti|makna|maksud|jelaskan|mengapa|kenapa|meaning|what does)\b/i],
]);

/**
 * Deterministic, offline intent analysis for biblical questions.
 * Returns classification evidence, never hidden model reasoning.
 */
export function analyzeBiblicalIntent(question) {
  const raw = String(question || "").trim();
  const normalized = normalizeText(raw);
  const matches = [];

  for (const [intent, pattern] of RULES) {
    const hit = raw.match(pattern);
    if (hit) matches.push({ intent, marker: hit[0] });
  }

  const primary = matches[0]?.intent || BIBLICAL_INTENTS.GENERAL;
  return Object.freeze({
    intent: primary,
    secondary: Object.freeze(matches.slice(1, 4).map((item) => item.intent)),
    markers: Object.freeze(matches.slice(0, 4).map((item) => item.marker)),
    language: /\b(what|why|how|meaning|prayer|wisdom)\b/i.test(raw) ? "en" : "id",
    normalized,
    confidence: matches.length ? Math.min(0.98, 0.72 + matches.length * 0.06) : 0.55,
  });
}
