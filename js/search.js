// =============================================================================
// search.js — Indeks pencarian konten Amsal.
// Mencakup judul, tema, kata kunci, ayat emas, ringkasan, renungan, eksegesis,
// dan tantangan. Menyediakan highlight kata kunci + snippet.
// =============================================================================
import { CONTENT } from "../data/content.js";
import { escapeHTML } from "./utils/security.js";

export function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .trim();
}

function keywordsText(item) {
  return (item.keywords || [])
    .map((k) => (typeof k === "string" ? k : k.term || ""))
    .join(" ");
}

const INDEX = Object.values(CONTENT).map((item) => ({
  item,
  title: normalize(item.title),
  fields: {
    theme: normalize(item.theme),
    keywords: normalize(keywordsText(item)),
    verse: normalize(`${item.goldenVerse?.ref || ""} ${item.goldenVerse?.text || ""}`),
    summary: normalize(item.summary),
    renungan: normalize(item.renungan),
    exegesis: normalize(item.exegesis),
    challenge: normalize(item.challenge),
  },
  haystack: normalize([
    item.title, item.theme, keywordsText(item),
    item.goldenVerse?.ref, item.goldenVerse?.text,
    item.summary, item.renungan, item.exegesis, item.challenge,
  ].join(" ")),
}));

// Kembalikan item yang cocok (setiap term harus muncul di suatu tempat).
export function searchContent(query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return INDEX
    .filter(({ haystack }) => terms.every((t) => haystack.includes(t)))
    .map(({ item }) => item);
}

// Versi kaya: menyertakan label field tempat kecocokan pertama ditemukan.
export function searchDetailed(query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const LABEL = { theme: "Tema", keywords: "Kata kunci", verse: "Ayat emas", summary: "Ringkasan", renungan: "Renungan", exegesis: "Eksegesis", challenge: "Tantangan" };
  return INDEX
    .filter(({ haystack }) => terms.every((t) => haystack.includes(t)))
    .map(({ item, fields }) => {
      const hits = Object.keys(fields).filter((f) => terms.some((t) => fields[f].includes(t)));
      return { item, matchedIn: hits.map((h) => LABEL[h]).filter(Boolean) };
    });
}

// Bungkus kemunculan term dengan <mark> pada sebuah string (aman dari HTML).
export function highlight(text, query) {
  const raw = String(text || "");
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return escapeHTML(raw);
  const normalized = normalize(raw);
  const ranges = [];
  terms.forEach((term) => {
    let from = 0;
    let idx;
    while ((idx = normalized.indexOf(term, from)) !== -1) {
      ranges.push([idx, idx + term.length]);
      from = idx + term.length;
    }
  });
  if (!ranges.length) return escapeHTML(raw);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  ranges.forEach(([s, e]) => {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  });
  let out = "";
  let cursor = 0;
  merged.forEach(([s, e]) => {
    out += escapeHTML(raw.slice(cursor, s)) + "<mark>" + escapeHTML(raw.slice(s, e)) + "</mark>";
    cursor = e;
  });
  out += escapeHTML(raw.slice(cursor));
  return out;
}
