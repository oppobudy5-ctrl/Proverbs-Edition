import { CONTENT } from "../../../data/content.js";
import { normalizeText } from "../ai-utils.js";
import { runBibleCompanion } from "../companion/companion-engine.js";
import { analyzeLearningGoal, PLANNING_GOALS } from "./goal-analyzer.js";
import { buildMilestones } from "./milestone-engine.js";
import { buildRecommendation } from "./recommendation-engine.js";

const CACHE_KEY = "bibletime:planning:v1";
const memoryCache = new Map();
const GOAL_LABELS = Object.freeze({
  [PLANNING_GOALS.LEARN_WISDOM]: "Belajar Hikmat",
  [PLANNING_GOALS.CHARACTER_STUDY]: "Studi Karakter",
  [PLANNING_GOALS.BOOK_STUDY]: "Studi Kitab",
  [PLANNING_GOALS.DAILY_READING]: "Bacaan Harian",
  [PLANNING_GOALS.TOPICAL_STUDY]: "Studi Topikal",
  [PLANNING_GOALS.SPIRITUAL_GROWTH]: "Pertumbuhan Rohani",
  [PLANNING_GOALS.MEMORIZATION]: "Menghafal Firman",
  [PLANNING_GOALS.PRAYER]: "Pertumbuhan Doa",
  [PLANNING_GOALS.LEADERSHIP]: "Kepemimpinan",
  [PLANNING_GOALS.DISCIPLESHIP]: "Pemuridan",
  [PLANNING_GOALS.GENERAL_LEARNING]: "Belajar Alkitab",
});

const GOAL_TERMS = Object.freeze({
  [PLANNING_GOALS.LEARN_WISDOM]: ["hikmat", "bijak", "takut akan tuhan"],
  [PLANNING_GOALS.CHARACTER_STUDY]: ["karakter", "integritas", "orang benar", "setia"],
  [PLANNING_GOALS.SPIRITUAL_GROWTH]: ["pertumbuhan", "disiplin", "ketaatan", "kerendahan hati"],
  [PLANNING_GOALS.MEMORIZATION]: ["firman", "ingat", "hati", "didikan"],
  [PLANNING_GOALS.PRAYER]: ["doa", "tuhan", "iman"],
  [PLANNING_GOALS.LEADERSHIP]: ["pemimpin", "raja", "keadilan", "integritas", "memimpin"],
  [PLANNING_GOALS.DISCIPLESHIP]: ["didikan", "murid", "nasihat", "mengajar", "ketaatan"],
});

const TOPIC_TERMS = Object.freeze({
  prayer: ["doa", "berdoa"],
  forgiveness: ["pengampunan", "mengampuni", "belas kasih"],
  hope: ["pengharapan", "harapan"],
  marriage: ["pernikahan", "suami", "istri", "kesetiaan"],
  parenting: ["orang tua", "anak", "keluarga", "didikan"],
  work: ["pekerjaan", "rajin", "kemalasan", "kerja"],
  leadership: ["pemimpin", "raja", "keadilan", "integritas"],
  wisdom: ["hikmat", "bijak", "takut akan tuhan"],
  faith: ["iman", "percaya", "tuhan", "kesetiaan"],
});

/**
 * Rule-based Planning & Discipleship orchestrator. It uses the local editorial
 * dataset and routes canonical context through Bible Companion/Reasoning once.
 */
export async function buildDiscipleshipPlan(input = {}) {
  const goalText = String(input.goal || "").trim() || "Belajar hikmat setiap hari";
  const analysis = analyzeLearningGoal(goalText);
  const duration = normalizeDuration(input.duration, analysis.goal);
  const difficulty = normalizeDifficulty(input.difficulty);
  const book = normalizeBook(input.book);
  const cacheId = `${analysis.goal}|${analysis.topic || ""}|${book}|${duration}|${difficulty}`;
  const skeleton = getCached(cacheId) || createPlanSkeleton({
    analysis,
    duration,
    difficulty,
    book,
  });
  if (!getCached(cacheId)) setCached(cacheId, skeleton);

  const completedLessons = normalizeCompleted(input.completedLessons);
  const completedInPlan = skeleton.lessons
    .filter((lesson) => completedLessons.includes(lesson.chapter))
    .length;
  const milestones = buildMilestones({
    lessonCount: skeleton.lessons.length,
    completedCount: completedInPlan,
    thresholds: input.milestoneThresholds,
    book,
    topic: analysis.topic,
    includeBookComplete: skeleton.type === "book" && skeleton.lessons.length === 31,
  });
  const completion = Object.freeze({
    completed: completedInPlan,
    total: skeleton.lessons.length,
    percent: skeleton.lessons.length
      ? Math.round((completedInPlan / skeleton.lessons.length) * 100)
      : 0,
    status: completedInPlan >= skeleton.lessons.length ? "completed" : "in_progress",
  });

  let companion = null;
  if (skeleton.lessons[0]) {
    try {
      companion = await runBibleCompanion({
        book,
        chapter: skeleton.lessons[0].chapter,
        // Provider use is explicit opt-in and receives chapter context only;
        // goal text and completion history remain local.
        llmEnabled: input.llmEnabled === true,
        cache: true,
        persist: false,
      });
    } catch {
      companion = null;
    }
  }

  const bookPlan = {
    ...skeleton.book_plan,
    overview: companion?.book_overview || null,
    purpose: companion?.purpose || "",
    major_themes: companion?.themes?.length
      ? companion.themes
      : skeleton.book_plan.major_themes,
  };
  const plan = {
    ...skeleton,
    book_plan: bookPlan,
    milestones,
    completion,
  };
  const recommendation = buildRecommendation({
    plan,
    completedLessons,
    currentLesson: input.currentLesson,
    currentTheme: input.currentTheme,
    companion,
  });

  return deepFreeze({
    ...plan,
    recommendation,
    canonical_context: companion
      ? {
          source: "bible-companion+reasoning",
          confidence: companion.confidence,
          reasoning_metadata: companion.reasoning_metadata,
          citations: companion.citations,
        }
      : {
          source: "local-knowledge-bundle",
          confidence: 0,
          reasoning_metadata: null,
          citations: [],
        },
    offline_compatible: true,
  });
}

export function clearPlanningCache() {
  memoryCache.clear();
  try {
    globalThis.localStorage?.removeItem(CACHE_KEY);
  } catch {
    // Storage is optional; memory cache remains cleared.
  }
}

function createPlanSkeleton({ analysis, duration, difficulty, book }) {
  const ranked = rankContent(analysis);
  const selected = ranked.slice(0, duration);
  const lessons = selected.map((content, index) => createLesson(content, index + 1));
  const first = lessons[0] || null;
  const type = planType(analysis.goal);
  const titleSuffix = analysis.topic
    ? ` · ${capitalize(analysis.topic)}`
    : "";
  const planId = `plan-${analysis.goal}-${analysis.topic || book}-${duration}`;

  return deepFreeze({
    plan_id: planId,
    title: `${GOAL_LABELS[analysis.goal]}${titleSuffix}`,
    goal: analysis.goal,
    goal_analysis: analysis,
    type,
    book,
    duration,
    difficulty,
    estimated_time: lessons.reduce((sum, lesson) => sum + lesson.estimated_time, 0),
    lessons,
    reading_plan: lessons,
    daily_plan: lessons,
    study_path: buildStudyPath(lessons),
    topical_plan: type === "topical" ? lessons : [],
    book_plan: buildBookPlan(lessons, book),
    reflection: first?.reflection || "",
    prayer: first?.prayer || "",
    application: first?.application || "",
    memory_verse: first?.memory_verse || null,
    review: first?.review || "",
    version: 1,
  });
}

function rankContent(analysis) {
  const content = Object.values(CONTENT).sort((a, b) => a.chapter - b.chapter);
  const terms = [
    ...(GOAL_TERMS[analysis.goal] || []),
    ...(TOPIC_TERMS[analysis.topic] || []),
  ];
  if (!terms.length || [
    PLANNING_GOALS.BOOK_STUDY,
    PLANNING_GOALS.DAILY_READING,
    PLANNING_GOALS.GENERAL_LEARNING,
  ].includes(analysis.goal)) {
    return content;
  }
  return content
    .map((item) => ({
      item,
      score: scoreContent(item, terms),
    }))
    .sort((a, b) => b.score - a.score || a.item.chapter - b.item.chapter)
    .map(({ item }) => item);
}

function scoreContent(content, terms) {
  const title = normalizeText(content.title);
  const theme = normalizeText(content.theme);
  const keywords = normalizeText((content.keywords || []).join(" "));
  const summary = normalizeText(content.summary);
  return terms.reduce((score, term) => {
    const needle = normalizeText(term);
    return score
      + (theme.includes(needle) ? 5 : 0)
      + (keywords.includes(needle) ? 4 : 0)
      + (title.includes(needle) ? 3 : 0)
      + (summary.includes(needle) ? 1 : 0);
  }, 0);
}

function createLesson(content, order) {
  const wordCount = String(content.summary || "").split(/\s+/).filter(Boolean).length
    + String(content.renungan || "").split(/\s+/).filter(Boolean).length;
  return deepFreeze({
    id: `lesson-proverbs-${String(content.chapter).padStart(2, "0")}`,
    order,
    day: order,
    book: "Amsal",
    book_slug: "proverbs",
    chapter: content.chapter,
    title: content.title,
    theme: content.theme,
    keywords: [...(content.keywords || [])],
    estimated_time: Math.max(8, Math.min(20, Math.ceil(wordCount / 180))),
    objective: content.lead || content.theme,
    reflection: content.reflection?.[0] || "",
    prayer: content.prayer || "",
    application: content.challenge || "",
    memory_verse: content.goldenVerse ? { ...content.goldenVerse } : null,
    review: content.quiz?.[0]?.q || `Tinjau kembali tema ${content.theme}`,
    milestone: [7, 14, 21, 31].includes(order) ? `${order} Lesson` : null,
  });
}

function buildStudyPath(lessons) {
  const path = [];
  for (const lesson of lessons) {
    const theme = String(lesson.theme || "").trim();
    if (theme && !path.includes(theme)) path.push(theme);
  }
  return path;
}

function buildBookPlan(lessons, book) {
  const themes = [...new Set(lessons.map((lesson) => lesson.theme).filter(Boolean))];
  return deepFreeze({
    book,
    overview: null,
    purpose: "",
    reading_order: lessons.map((lesson) => lesson.chapter),
    major_themes: themes,
    review_checkpoints: lessons
      .filter((lesson) => lesson.order % 7 === 0 || lesson.order === lessons.length)
      .map((lesson) => lesson.order),
    completion: lessons.length,
  });
}

function planType(goal) {
  if (goal === PLANNING_GOALS.BOOK_STUDY) return "book";
  if (goal === PLANNING_GOALS.TOPICAL_STUDY) return "topical";
  if (goal === PLANNING_GOALS.CHARACTER_STUDY) return "study";
  return "reading";
}

function normalizeDuration(value, goal) {
  const fallback = goal === PLANNING_GOALS.BOOK_STUDY ? 31 : 7;
  const duration = Number(value || fallback);
  if (!Number.isInteger(duration)) return fallback;
  return Math.max(1, Math.min(31, duration));
}

function normalizeDifficulty(value) {
  return ["pemula", "menengah", "lanjutan"].includes(value) ? value : "pemula";
}

function normalizeBook(value) {
  const book = String(value || "proverbs").trim().toLowerCase();
  return ["proverbs", "amsal"].includes(book) ? "proverbs" : "proverbs";
}

function normalizeCompleted(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(Number).filter((item) => Number.isInteger(item) && item > 0))];
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, done]) => Boolean(done))
      .map(([chapter]) => Number(chapter))
      .filter((item) => Number.isInteger(item) && item > 0);
  }
  return [];
}

function getCached(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(CACHE_KEY) || "{}");
    if (parsed[key]) {
      const frozen = deepFreeze(parsed[key]);
      memoryCache.set(key, frozen);
      return frozen;
    }
  } catch {
    // Corrupt or blocked storage falls back to deterministic regeneration.
  }
  return null;
}

function setCached(key, plan) {
  memoryCache.set(key, plan);
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(CACHE_KEY) || "{}");
    parsed[key] = plan;
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Planning remains fully usable with memory-only cache.
  }
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
