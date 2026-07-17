import { getNextMilestone } from "./milestone-engine.js";

export function buildRecommendation({
  plan,
  completedLessons = [],
  currentLesson = null,
  currentTheme = "",
  reasoningResult = null,
  companion = null,
} = {}) {
  const completed = new Set(normalizeLessons(completedLessons));
  const lessons = Array.isArray(plan?.lessons) ? plan.lessons : [];
  const currentNumber = Number(currentLesson);
  const next = lessons.find((lesson) => !completed.has(lesson.chapter)
    && (!Number.isInteger(currentNumber) || lesson.chapter >= currentNumber))
    || lessons.find((lesson) => !completed.has(lesson.chapter))
    || null;
  const reviewDue = completed.size > 0 && completed.size % 7 === 0;
  const milestone = getNextMilestone(plan?.milestones || []);
  const theme = next?.theme
    || currentTheme
    || reasoningResult?.reasoning_metadata?.theme
    || companion?.main_theme
    || "";

  return Object.freeze({
    next_lesson: next ? Object.freeze({ ...next }) : null,
    current_theme: theme,
    review_due: reviewDue,
    next_milestone: milestone ? Object.freeze({ ...milestone }) : null,
    reason: next
      ? `Lanjutkan ke ${next.book} ${next.chapter} untuk meneruskan jalur tema yang tersedia.`
      : "Semua lesson dalam plan ini telah selesai.",
    source: reasoningResult ? "reasoning+plan" : companion ? "companion+plan" : "local-plan",
  });
}

function normalizeLessons(values) {
  if (Array.isArray(values)) {
    return values.map(Number).filter((value) => Number.isInteger(value) && value > 0);
  }
  if (values && typeof values === "object") {
    return Object.entries(values)
      .filter(([, done]) => Boolean(done))
      .map(([chapter]) => Number(chapter))
      .filter((value) => Number.isInteger(value) && value > 0);
  }
  return [];
}
