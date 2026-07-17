// =============================================================================
// reading-time.js — Estimasi waktu baca dari konten hari.
// =============================================================================

const WPM = 200;

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

export function estimateMinutes(content) {
  if (!content) return 1;
  const words =
    countWords(content.summary) +
    countWords(content.renungan) +
    countWords(content.exegesis) +
    countWords(content.prayer) +
    countWords(content.challenge) +
    (content.reflection || []).reduce((n, q) => n + countWords(q), 0);
  return Math.max(1, Math.round(words / WPM));
}

export function formatDuration(ms) {
  const totalMin = Math.round((ms || 0) / 60000);
  if (totalMin < 1) return "< 1 menit";
  if (totalMin < 60) return `${totalMin} menit`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}
