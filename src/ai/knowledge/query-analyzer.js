// =============================================================================
// query-analyzer.js — Analisis query untuk Semantic Search (offline).
// Tokenization, normalization, stopwords, synonym expansion, spell correction,
// language detection (id/en-ready), dan intent classification.
// =============================================================================

import { normalizeText } from "../ai-utils.js";

export const SEARCH_INTENTS = Object.freeze({
  NATURAL_LANGUAGE: "natural_language",
  CONCEPT: "concept",
  LIFE_SITUATION: "life_situation",
  QUESTION: "question",
  RELATED: "related",
  KEYWORD: "keyword",
});

const STOPWORDS_ID = new Set([
  "saya", "aku", "kami", "kita", "anda", "kamu", "yang", "dan", "atau", "dari",
  "dengan", "untuk", "pada", "ke", "di", "itu", "ini", "ada", "adalah", "akan",
  "sudah", "sedang", "bisa", "dapat", "bagaimana", "apa", "apakah", "mengapa",
  "kenapa", "siapa", "mana", "kalau", "jika", "saat", "ketika", "tentang",
  "mengenai", "lebih", "sangat", "juga", "tidak", "belum", "punya", "lagi", "sekali",
  "alkitab", "katakan", "ajarkan", "membuat", "menjadi", "dalam", "oleh", "agar",
  "the", "a", "an", "is", "are", "to", "of", "in", "on", "for", "my", "i", "me",
]);

const QUESTION_MARKERS = /\b(apa|apakah|bagaimana|mengapa|kenapa|siapa|dimana|kapan|what|how|why|who)\b/i;
const SITUATION_MARKERS = /\b(saya|aku|sedang|bingung|sulit|kehilangan|menghadapi|memilih|mendidik|mengatur)\b/i;

/**
 * @param {string} query
 * @param {object} [resources]
 * @param {{ synonyms?: object, situations?: object, topics?: object[] }} resources
 */
export function analyzeQuery(query, resources = {}) {
  const raw = String(query || "").trim();
  const language = detectLanguage(raw);
  const normalized = normalizeText(raw);
  const tokens = tokenize(normalized);
  const contentTokens = tokens.filter((t) => !STOPWORDS_ID.has(t) && t.length > 1);
  const expanded = expandSynonyms(contentTokens, resources.synonyms);
  const corrected = spellCorrect(contentTokens, resources);
  const situations = matchSituations(normalized, resources.situations);
  const topics = matchTopics(normalized, expanded, resources.topics);
  const intent = classifyIntent(raw, normalized, { situations, topics, contentTokens });

  return Object.freeze({
    raw,
    normalized,
    language,
    tokens,
    contentTokens,
    expandedTerms: Object.freeze([...new Set([...contentTokens, ...expanded, ...corrected])]),
    correctedTerms: Object.freeze(corrected),
    intent,
    topicIds: Object.freeze(topics.map((t) => t.id)),
    situationIds: Object.freeze(situations.map((s) => s.id)),
    situations: Object.freeze(situations),
    topics: Object.freeze(topics),
    isEmpty: contentTokens.length === 0 && situations.length === 0,
  });
}

export function tokenize(normalized) {
  return String(normalized || "").split(/\s+/).filter(Boolean);
}

export function detectLanguage(text) {
  const sample = String(text || "").toLowerCase();
  if (!sample) return "id";
  const enHits = (sample.match(/\b(the|what|how|why|wisdom|fear|lord|decision)\b/g) || []).length;
  const idHits = (sample.match(/\b(apa|bagaimana|hikmat|tuhan|saya|aku|tentang)\b/g) || []).length;
  if (enHits > idHits + 1) return "en";
  return "id";
}

function expandSynonyms(tokens, synonymsFile) {
  const entries = synonymsFile?.entries || [];
  const out = [];
  for (const token of tokens) {
    for (const entry of entries) {
      const canon = normalizeText(entry.canonical);
      const syns = (entry.synonyms || []).map(normalizeText);
      if (token === canon || syns.includes(token)) {
        out.push(canon, ...syns);
      }
    }
  }
  return out;
}

function spellCorrect(tokens, resources) {
  const dictionary = buildSpellDictionary(resources);
  const out = [];
  for (const token of tokens) {
    if (dictionary.has(token)) continue;
    let best = null;
    let bestDist = Infinity;
    for (const word of dictionary) {
      if (Math.abs(word.length - token.length) > 2) continue;
      const dist = levenshtein(token, word);
      const max = token.length <= 4 ? 1 : 2;
      if (dist <= max && dist < bestDist) {
        best = word;
        bestDist = dist;
      }
    }
    if (best) out.push(best);
  }
  return out;
}

function buildSpellDictionary(resources) {
  const set = new Set();
  for (const entry of resources.synonyms?.entries || []) {
    set.add(normalizeText(entry.canonical));
    for (const s of entry.synonyms || []) set.add(normalizeText(s));
  }
  for (const topic of resources.topics || []) {
    set.add(normalizeText(topic.name));
    for (const a of topic.aliases || []) set.add(normalizeText(a));
    for (const k of topic.keywords || []) set.add(normalizeText(k));
  }
  for (const sit of resources.situations?.situations || []) {
    for (const p of sit.phrases || []) {
      for (const t of normalizeText(p).split(/\s+/)) if (t.length > 2) set.add(t);
    }
  }
  return set;
}

function matchSituations(normalized, situationsFile) {
  const list = situationsFile?.situations || [];
  const hits = [];
  for (const sit of list) {
    for (const phrase of sit.phrases || []) {
      const p = normalizeText(phrase);
      if (!p) continue;
      // Query contains full phrase, or (for longer NL queries) phrase tokens cover the query.
      const queryHasPhrase = normalized.includes(p);
      const phraseHasQuery = p.split(/\s+/).length >= 3 && p.includes(normalized) && normalized.split(/\s+/).length >= 3;
      if (queryHasPhrase || phraseHasQuery) {
        hits.push({ id: sit.id, label: sit.label, topics: sit.topics || [], reason: sit.reason || "" });
        break;
      }
    }
  }
  return hits;
}

function matchTopics(normalized, expandedTerms, topics) {
  const list = topics || [];
  const hits = [];
  const termSet = new Set([normalized, ...expandedTerms]);
  for (const topic of list) {
    const aliases = [topic.name, ...(topic.aliases || []), ...(topic.keywords || [])].map(normalizeText).filter(Boolean);
    let score = 0;
    for (const alias of aliases) {
      if (normalized.includes(alias) || termSet.has(alias)) score += alias.split(" ").length >= 2 ? 3 : 2;
      else if (expandedTerms.some((t) => alias.includes(t) || t.includes(alias))) score += 1;
    }
    if (score > 0) hits.push({ id: topic.id, name: topic.name, score, description: topic.description });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 6);
}

function classifyIntent(raw, normalized, { situations, topics, contentTokens }) {
  if (/\b(terkait|mirip|related|lihat juga)\b/i.test(raw)) return SEARCH_INTENTS.RELATED;
  if (situations.length) return SEARCH_INTENTS.LIFE_SITUATION;
  if (QUESTION_MARKERS.test(raw) || raw.includes("?")) return SEARCH_INTENTS.QUESTION;
  if (SITUATION_MARKERS.test(raw) && contentTokens.length >= 2) return SEARCH_INTENTS.NATURAL_LANGUAGE;
  if (topics.length && contentTokens.length <= 3) return SEARCH_INTENTS.CONCEPT;
  if (contentTokens.length >= 4) return SEARCH_INTENTS.NATURAL_LANGUAGE;
  return SEARCH_INTENTS.KEYWORD;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
