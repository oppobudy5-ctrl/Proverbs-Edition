// =============================================================================
// insights.js — Insight deskriptif lokal (tanpa menghakimi).
// =============================================================================
import { listEntries, prayerItemCount, gratitudeCount, entryCount } from "./store.js";
import { listHistory } from "../history.js";

const THEME_WORDS = Object.freeze([
  ["hikmat", "Hikmat"],
  ["pengampunan", "Pengampunan"],
  ["doa", "Doa"],
  ["iman", "Iman"],
  ["sabar", "Kesabaran"],
  ["syukur", "Syukur"],
  ["kasih", "Kasih"],
  ["keluarga", "Keluarga"],
  ["kerja", "Pekerjaan"],
  ["harap", "Pengharapan"],
  ["integritas", "Integritas"],
  ["rendah hati", "Kerendahan hati"],
]);

export function buildJournalInsights({ days = 30 } = {}) {
  const since = daysAgoISO(days);
  const all = listEntries();
  const recent = all.filter((e) => (e.updatedAt || e.createdAt || "") >= since);
  const corpus = recent.length ? recent : all;

  const tagCounts = countMap();
  const bookCounts = countMap();
  const typeCounts = countMap();
  const themeCounts = countMap();

  corpus.forEach((e) => {
    typeCounts.inc(e.type || "reflection");
    if (e.book) bookCounts.inc(e.book);
    (e.tags || []).forEach((t) => tagCounts.inc(t));
    const text = [
      e.body, e.gratitude, e.actionPlan, e.title,
      ...(e.prayer?.requests || []),
      ...(e.prayer?.thanks || []),
    ].join(" ").toLowerCase();
    THEME_WORDS.forEach(([needle, label]) => {
      if (text.includes(needle)) themeCounts.inc(label);
    });
  });

  const topTheme = themeCounts.top(1)[0];
  const topTag = tagCounts.top(1)[0];
  const topBook = bookCounts.top(1)[0];
  const historyDays = listHistory().filter((h) => (h.lastAt || h.finishedAt || "") >= since).length;

  const cards = [];

  if (topTheme) {
    cards.push({
      id: "theme",
      text: `Tema yang paling sering Anda renungkan ${recent.length ? `dalam ${days} hari terakhir` : "sejauh ini"} adalah ${topTheme.key.toLowerCase()}.`,
    });
  }
  if (topTag && (!topTheme || topTag.key.toLowerCase() !== topTheme.key.toLowerCase())) {
    cards.push({
      id: "tag",
      text: `Anda beberapa kali menulis tentang ${topTag.key.toLowerCase()} (${topTag.count} catatan bertag).`,
    });
  }
  if (topBook) {
    cards.push({
      id: "book",
      text: `${recent.length ? `Dalam ${days} hari terakhir` : "Sejauh ini"} Anda paling banyak mengaitkan jurnal dengan ${topBook.key}.`,
    });
  }
  if (historyDays > 0) {
    cards.push({
      id: "reading",
      text: `Dalam ${days} hari terakhir Anda mencatat aktivitas baca pada ${historyDays} hari.`,
    });
  }

  const prayers = prayerItemCount();
  if (prayers > 0) {
    cards.push({
      id: "prayer",
      text: `Anda telah menuliskan ${prayers} butir doa di jurnal.`,
    });
  }
  const gratitude = gratitudeCount();
  if (gratitude > 0) {
    cards.push({
      id: "gratitude",
      text: `Ada ${gratitude} catatan yang memuat ucapan syukur.`,
    });
  }
  if (!cards.length) {
    cards.push({
      id: "empty",
      text: "Insight akan muncul setelah Anda menulis beberapa jurnal. Semua ringkasan bersifat deskriptif, bukan penilaian.",
    });
  }

  return {
    days,
    entryCount: entryCount(),
    recentCount: recent.length,
    prayerCount: prayers,
    gratitudeCount: gratitude,
    themes: themeCounts.top(8),
    tags: tagCounts.top(8),
    books: bookCounts.top(5),
    types: typeCounts.top(5),
    cards,
  };
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, days));
  return d.toISOString();
}

function countMap() {
  const map = new Map();
  return {
    inc(key) {
      const k = String(key || "").trim();
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    },
    top(n) {
      return [...map.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
        .slice(0, n);
    },
  };
}
