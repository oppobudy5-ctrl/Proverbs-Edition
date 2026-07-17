import { normalizeText } from "../ai-utils.js";

export const PLANNING_GOALS = Object.freeze({
  LEARN_WISDOM: "learn_wisdom",
  CHARACTER_STUDY: "character_study",
  BOOK_STUDY: "book_study",
  DAILY_READING: "daily_reading",
  TOPICAL_STUDY: "topical_study",
  SPIRITUAL_GROWTH: "spiritual_growth",
  MEMORIZATION: "memorization",
  PRAYER: "prayer",
  LEADERSHIP: "leadership",
  DISCIPLESHIP: "discipleship",
  GENERAL_LEARNING: "general_learning",
});

const GOAL_RULES = Object.freeze([
  [PLANNING_GOALS.CHARACTER_STUDY, /\b(studi karakter|character study|tokoh|karakter)\b/i],
  [PLANNING_GOALS.BOOK_STUDY, /\b(studi kitab|book study|seluruh kitab|pasal demi pasal)\b/i],
  [PLANNING_GOALS.DAILY_READING, /\b(bacaan harian|daily reading|setiap hari|rutin membaca)\b/i],
  [PLANNING_GOALS.TOPICAL_STUDY, /\b(studi topik|topical study|topikal|tema khusus)\b/i],
  [PLANNING_GOALS.SPIRITUAL_GROWTH, /\b(pertumbuhan rohani|spiritual growth|bertumbuh rohani|kedewasaan)\b/i],
  [PLANNING_GOALS.MEMORIZATION, /\b(hafal|menghafal|memorization|memory verse)\b/i],
  [PLANNING_GOALS.PRAYER, /\b(doa|berdoa|prayer)\b/i],
  [PLANNING_GOALS.LEADERSHIP, /\b(kepemimpinan|pemimpin|leadership|memimpin)\b/i],
  [PLANNING_GOALS.DISCIPLESHIP, /\b(pemuridan|murid|discipleship|memuridkan)\b/i],
  [PLANNING_GOALS.LEARN_WISDOM, /\b(hikmat|bijaksana|wisdom|amsal)\b/i],
]);

const TOPICS = Object.freeze([
  ["prayer", /\b(doa|berdoa|prayer)\b/i],
  ["forgiveness", /\b(pengampunan|mengampuni|forgiveness)\b/i],
  ["hope", /\b(pengharapan|harapan|hope)\b/i],
  ["marriage", /\b(pernikahan|suami|istri|marriage)\b/i],
  ["parenting", /\b(orang tua|anak|parenting|keluarga)\b/i],
  ["work", /\b(pekerjaan|kerja|rajin|work)\b/i],
  ["leadership", /\b(kepemimpinan|pemimpin|leadership|raja)\b/i],
  ["wisdom", /\b(hikmat|bijaksana|wisdom)\b/i],
  ["faith", /\b(iman|percaya|faith)\b/i],
]);

/**
 * Deterministic, offline goal classification. It never sends user history or
 * goal text to a provider.
 */
export function analyzeLearningGoal(goal) {
  const raw = String(goal || "").trim();
  const normalized = normalizeText(raw);
  const matches = GOAL_RULES
    .filter(([, pattern]) => pattern.test(raw))
    .map(([name]) => name);
  const topic = TOPICS.find(([, pattern]) => pattern.test(raw))?.[0] || null;
  let primary = matches[0] || PLANNING_GOALS.GENERAL_LEARNING;
  if (topic && primary === PLANNING_GOALS.GENERAL_LEARNING) {
    primary = PLANNING_GOALS.TOPICAL_STUDY;
  }

  return Object.freeze({
    goal: primary,
    topic,
    normalized,
    original: raw,
    secondary: Object.freeze(matches.slice(1, 4)),
    confidence: matches.length || topic ? Math.min(0.98, 0.76 + matches.length * 0.05) : 0.55,
  });
}
