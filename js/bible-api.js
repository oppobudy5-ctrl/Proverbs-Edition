// =============================================================================
// bible-api.js — Tautan Amsal & pengambilan teks pasal (baca paralel).
//
// Teks diambil via proxy /bible/* (lihat vercel.json) ke API mayicu.id.
// Strategi jaringan:
//   - Cache in-memory per (versi, pasal) — sekali dimuat tidak diambil ulang.
//   - Concurrency 1 (tanpa hedging paralel yang agresif).
//   - Retry dengan exponential backoff + jitter.
// =============================================================================
import { getMainVersion } from "./store.js";

const BOOK = {
  name: "Amsal",
  sabdaId: 20,
  apiCode: "Ams",
  alkitabCode: "Pro",
};

// Jumlah ayat Amsal per pasal.
const VERSE_COUNTS = {
  1: 33, 2: 22, 3: 35, 4: 27, 5: 23, 6: 35, 7: 27, 8: 36,
  9: 18, 10: 32, 11: 31, 12: 28, 13: 25, 14: 35, 15: 33, 16: 33,
  17: 28, 18: 24, 19: 29, 20: 30, 21: 31, 22: 29, 23: 35, 24: 34,
  25: 28, 26: 28, 27: 27, 28: 28, 29: 27, 30: 33, 31: 31,
};

export function chapterFromRefs(refs) {
  const m = String((refs && refs[0]) || "").match(/(\d+)/);
  return m ? m[1] : "1";
}

export function sabdaURL(refs) {
  const ref = String((refs && refs[0]) || "");
  const chapter = (ref.match(/(\d+)/) || [, "1"])[1];
  const vs = ref.match(/:(\d+)/);
  const base = `https://alkitab.sabda.org/bible.php?book=${BOOK.sabdaId}&chapter=${chapter}&tab=text&version=${getMainVersion()}`;
  return vs ? `${base}&verse=${vs[1]}` : base;
}

export function fullChapterLabel(refs) {
  const chapter = chapterFromRefs(refs);
  const last = VERSE_COUNTS[chapter];
  return last ? `${BOOK.name} ${chapter}:1-${last}` : `${BOOK.name} ${chapter}`;
}

export function alkitabAppURL(refs) {
  const first = String(refs[0]).replace("Amsal ", `${BOOK.alkitabCode}.`).replace(":", ".");
  return `https://www.alkitab.app/bible/TB/${encodeURIComponent(first)}`;
}

export function sabdaPassageURL(ref) {
  return `https://alkitab.sabda.org/passage.php?passage=${encodeURIComponent(ref)}`;
}

export function sabdaDiglotURL(chapter, ver2, sabdaMap) {
  const v2 = sabdaMap[ver2] || String(ver2 || "").toUpperCase();
  return `https://alkitab.sabda.org/bible.php?book=${BOOK.sabdaId}&chapter=${chapter}&tab=diglot&version2=${v2}`;
}

// Bersihkan penanda perikop/superscription (mis. "< >") dan spasi berlebih.
export function cleanVerse(s) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cache in-memory: "version:chapter" -> { number: text }.
const chapterCache = new Map();

async function fetchChapterOnce(version, chapter, signal) {
  const cb = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const res = await fetch(`/bible/${version}/${BOOK.apiCode}/${chapter}/1/200?t=${cb}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  const text = await res.text();
  // mayicu.id memakai proteksi bot Imunify360 yang kadang membalas status 200 + pesan blokir.
  if (/Imunify360|Access denied|bot-protection/i.test(text)) throw new Error("blocked");
  if (!res.ok) throw new Error("HTTP " + res.status);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Format tak terduga"); }
  if (!Array.isArray(data)) throw new Error("Format tak terduga");
  const map = {};
  data.forEach((v) => { map[v.number] = cleanVerse(v.text); });
  return map;
}

// Ambil satu pasal dengan cache + retry (exponential backoff + jitter).
// Concurrency 1: satu permintaan aktif per pemanggilan.
export async function fetchChapter(version, chapter, { attempts = 4, baseDelay = 250, signal } = {}) {
  const key = `${version}:${chapter}`;
  if (chapterCache.has(key)) return chapterCache.get(key);

  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const map = await fetchChapterOnce(version, chapter, signal);
      chapterCache.set(key, map);
      return map;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        const backoff = baseDelay * 2 ** i;      // 250, 500, 1000, ...
        const jitter = Math.random() * baseDelay; // hindari thundering herd
        await sleep(backoff + jitter);
      }
    }
  }
  throw lastErr || new Error("gagal memuat");
}
